import { ConvexError, v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  assertUserOwns,
  requireAuthenticatedActionUser,
  requireAuthenticatedUser,
} from "./authz";

// GitHub API configuration (matches readme.ts)
const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";

// LLM API configuration
const CLAUDE_API_BASE = "https://api.anthropic.com/v1/messages";
const CLAUDE_API_VERSION = "2023-06-01";
const OPENAI_API_BASE = "https://api.openai.com/v1/chat/completions";
const CEREBRAS_API_BASE = "https://api.cerebras.ai/v1/chat/completions";

// Rate limiting between GitHub API calls
const RATE_LIMIT_DELAY_MS = 100;

// Model pricing (per million tokens) — mirrors claudeAi.ts / openaiAi.ts
const CLAUDE_PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-opus-4-6": { input: 15.0, output: 75.0 },
};

const OPENAI_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-5.4-nano": { input: 0.10, output: 0.40 },
  "gpt-5.4-mini": { input: 0.40, output: 1.60 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4o": { input: 2.50, output: 10.0 },
};

// Cerebras pricing — approximate, verify against dashboard before committing to large batches
const CEREBRAS_PRICING: Record<string, { input: number; output: number }> = {
  "llama-3.3-70b": { input: 0.85, output: 1.20 },
  "llama-4-scout-17b-16e-instruct": { input: 0.65, output: 0.85 },
  "qwen-3-32b": { input: 0.40, output: 0.80 },
};

function calculateCost(
  provider: "claude" | "openai" | "cerebras",
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  let pricing;
  if (provider === "claude") {
    pricing = CLAUDE_PRICING[model] || CLAUDE_PRICING["claude-haiku-4-5"];
  } else if (provider === "cerebras") {
    pricing = CEREBRAS_PRICING[model] || CEREBRAS_PRICING["llama-3.3-70b"];
  } else {
    pricing = OPENAI_PRICING[model] || OPENAI_PRICING["gpt-5.4-nano"];
  }
  return (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output;
}

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface LLMDistillationResponse {
  summary: string;
  keyFeatures: string[];
  stack: {
    languages: string[];
    keyDeps: string[];
    runtime?: string;
  };
  whyNotable: string[];
  suggestedRelatedTopics: string[];
}

interface GraphNode {
  id: string;
  label: string;
  language: string | null;
  stars: number;
  status: "processed" | "failed" | "no_readme" | "unprocessed";
  summary: string;
  categoryNames: string[];
}

interface GraphEdge {
  source: string;
  target: string;
  reason: string;
  edgeType: "llm_discovered" | "shared_topic" | "shared_language" | "same_owner";
}

interface ProcessRepositoryResult {
  success: boolean;
  status: "processed" | "failed" | "no_readme";
  repositoryId: Id<"repositories">;
  processingTimeMs?: number;
  error?: string;
}

interface ProcessBatchResult {
  processed: number;
  failed: number;
  total: number;
}

interface BuildCrossReferencesResult {
  crossReferencesAdded: number;
}

// ────────────────────────────────────────────────────────────────
// Markdown Assembly (from SPEC.md)
// ────────────────────────────────────────────────────────────────

function assembleMarkdown(
  repo: { fullName: string; language?: string | null; stargazersCount: number; htmlUrl: string },
  knowledge: LLMDistillationResponse
): string {
  const lines: string[] = [];
  lines.push(`# ${repo.fullName}`);
  lines.push('');
  lines.push(knowledge.summary);
  lines.push('');
  lines.push(`**Language:** ${repo.language || 'Unknown'} | **Stars:** ${repo.stargazersCount} | **Source:** [GitHub](${repo.htmlUrl})`);
  lines.push('');
  lines.push('## Key Features');
  lines.push('');
  for (const feature of knowledge.keyFeatures) {
    lines.push(`- ${feature}`);
  }
  lines.push('');
  lines.push('## Stack');
  lines.push('');
  lines.push(`- **Languages:** ${knowledge.stack.languages.join(', ')}`);
  lines.push(`- **Key deps:** ${knowledge.stack.keyDeps.join(', ')}`);
  if (knowledge.stack.runtime) {
    lines.push(`- **Runtime:** ${knowledge.stack.runtime}`);
  }
  lines.push('');
  lines.push('## Why Notable');
  lines.push('');
  for (const point of knowledge.whyNotable) {
    lines.push(`- ${point}`);
  }
  lines.push('');
  lines.push('## Related Repos');
  lines.push('');
  // Cross-references are added after the cross-reference pass
  lines.push('*Cross-references populated after graph build.*');
  return lines.join('\n');
}

/**
 * Rebuild the Related Repos section with actual cross-references.
 */
function updateMarkdownCrossRefs(
  markdown: string,
  crossRefs: Array<{ fullName: string; reason: string }>
): string {
  const marker = '## Related Repos';
  const idx = markdown.indexOf(marker);
  if (idx === -1) return markdown;

  const before = markdown.substring(0, idx + marker.length);
  const lines: string[] = [before, ''];
  if (crossRefs.length === 0) {
    lines.push('*No cross-references found.*');
  } else {
    for (const ref of crossRefs) {
      lines.push(`- [[${ref.fullName}]] — ${ref.reason}`);
    }
  }
  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────
// Clean markdown — reused from readme.ts pattern
// ────────────────────────────────────────────────────────────────

function cleanMarkdown(content: string): string {
  let cleaned = content;
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '[code block]');
  cleaned = cleaned.replace(/`[^`]+`/g, '[code]');
  cleaned = cleaned.replace(/!\[.*?\]\(.*?\)/g, '');
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  cleaned = cleaned.replace(/<[^>]+>/g, '');
  cleaned = cleaned.replace(/\[!\[.*?\].*?\]/g, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.trim();
  return cleaned;
}

// ────────────────────────────────────────────────────────────────
// LLM Prompt
// ────────────────────────────────────────────────────────────────

function buildDistillationPrompt(repo: {
  fullName: string;
  description?: string | null;
  language?: string | null;
  topics: string[];
  stargazersCount: number;
  owner: { login: string };
  pushedAt?: string | null;
  archived: boolean;
}, readmeContent: string): string {
  return `You are distilling a GitHub repository into a structured knowledge page for a developer's personal knowledge base. The developer starred this repo because they found it interesting or useful. Your job is to extract the essential information so they can understand the repo at a glance months later.

## Repository Metadata
- **Name:** ${repo.fullName}
- **Description:** ${repo.description || 'None'}
- **Language:** ${repo.language || 'Unknown'}
- **Topics:** ${repo.topics.length > 0 ? repo.topics.join(', ') : 'None'}
- **Stars:** ${repo.stargazersCount}
- **Owner:** ${repo.owner.login}
- **Last pushed:** ${repo.pushedAt || 'Unknown'}
- **Archived:** ${repo.archived}

## README Content
${readmeContent}

## Instructions

Analyze the repository and return a JSON object with these fields:

1. **summary** (string): 2-4 sentences explaining what this repo does and its approach. Written for a developer who will read this months later. Be specific — tool names, algorithms, protocols, not marketing language.

2. **keyFeatures** (string[]): 3-7 concrete features or capabilities. Each bullet should be specific enough to differentiate this repo from similar tools. Include version numbers, performance claims, or notable technical details when present in the README.

3. **stack** (object):
   - **languages** (string[]): Programming languages used
   - **keyDeps** (string[]): Notable dependencies, frameworks, or libraries
   - **runtime** (string, optional): Runtime environment if relevant (e.g., "Node.js 18+", "Python 3.10+", "Rust nightly")

4. **whyNotable** (string[]): 1-3 bullets on what makes this repo worth remembering. What problem does it solve? What approach is distinctive? What decision does it inform? Be specific to this repo, not generic.

5. **suggestedRelatedTopics** (string[]): 3-5 topic keywords that could connect this repo to other repos in a knowledge graph. Use specific technical terms (e.g., "force-directed-graph", "oauth-pkce", "convex-backend") rather than generic ones (e.g., "web", "tool").

Return ONLY valid JSON. No markdown fencing, no explanation outside the JSON.

{
  "summary": "...",
  "keyFeatures": ["...", "..."],
  "stack": { "languages": [...], "keyDeps": [...], "runtime": "..." },
  "whyNotable": ["...", "..."],
  "suggestedRelatedTopics": ["...", "..."]
}`;
}

// ────────────────────────────────────────────────────────────────
// LLM Response Parsing
// ────────────────────────────────────────────────────────────────

function parseLLMResponse(content: string): LLMDistillationResponse {
  let jsonStr = content.trim();

  // Handle markdown code blocks
  if (jsonStr.includes("```json")) {
    const match = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
    if (match) jsonStr = match[1];
  } else if (jsonStr.includes("```")) {
    const match = jsonStr.match(/```\s*([\s\S]*?)\s*```/);
    if (match) jsonStr = match[1];
  }

  // Find the JSON object
  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (!objectMatch) {
    throw new Error("No JSON object found in LLM response");
  }

  const parsed = JSON.parse(objectMatch[0]);

  // Validate and sanitize
  return {
    summary: String(parsed.summary || "No summary provided"),
    keyFeatures: Array.isArray(parsed.keyFeatures)
      ? parsed.keyFeatures.map(String)
      : ["No features extracted"],
    stack: {
      languages: Array.isArray(parsed.stack?.languages)
        ? parsed.stack.languages.map(String)
        : [],
      keyDeps: Array.isArray(parsed.stack?.keyDeps)
        ? parsed.stack.keyDeps.map(String)
        : [],
      runtime: parsed.stack?.runtime ? String(parsed.stack.runtime) : undefined,
    },
    whyNotable: Array.isArray(parsed.whyNotable)
      ? parsed.whyNotable.map(String)
      : ["No notable aspects extracted"],
    suggestedRelatedTopics: Array.isArray(parsed.suggestedRelatedTopics)
      ? parsed.suggestedRelatedTopics.map(String)
      : [],
  };
}

// ────────────────────────────────────────────────────────────────
// LLM API Callers (match claudeAi.ts / openaiAi.ts patterns)
// ────────────────────────────────────────────────────────────────

async function callClaude(
  apiKey: string,
  model: string,
  prompt: string
): Promise<{ content: string; inputTokens: number; outputTokens: number; requestId?: string }> {
  let response: Response | undefined;
  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    try {
      response = await fetch(CLAUDE_API_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": CLAUDE_API_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (response.ok) break;

      if (response.status === 429) {
        const retryAfter = response.headers.get("retry-after");
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        retries++;
        continue;
      }

      const errorBody = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${errorBody}`);
    } catch (error) {
      if (retries >= maxRetries - 1) throw error;
      retries++;
      await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
    }
  }

  const data = await response!.json();
  return {
    content: data.content?.[0]?.text || "",
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
    requestId: data.id,
  };
}

async function callOpenAI(
  apiKey: string,
  model: string,
  prompt: string
): Promise<{ content: string; inputTokens: number; outputTokens: number; requestId?: string }> {
  const response = await fetch(OPENAI_API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 2048,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
    requestId: data.id,
  };
}

async function callCerebras(
  apiKey: string,
  model: string,
  prompt: string
): Promise<{ content: string; inputTokens: number; outputTokens: number; requestId?: string }> {
  const response = await fetch(CEREBRAS_API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 2048,
      temperature: 0.3,
      // Cerebras honors OpenAI's JSON mode — helps small models stick to the schema
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Cerebras API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
    requestId: data.id,
  };
}

async function callLLM(
  provider: "claude" | "openai" | "cerebras",
  model: string,
  prompt: string
): Promise<{ content: string; inputTokens: number; outputTokens: number; requestId?: string }> {
  if (provider === "claude") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new ConvexError("ANTHROPIC_API_KEY not configured");
    return callClaude(apiKey, model, prompt);
  } else if (provider === "cerebras") {
    const apiKey = process.env.CEREBRAS_API_KEY;
    if (!apiKey) throw new ConvexError("CEREBRAS_API_KEY not configured");
    return callCerebras(apiKey, model, prompt);
  } else {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new ConvexError("OPENAI_API_KEY not configured");
    return callOpenAI(apiKey, model, prompt);
  }
}

// ────────────────────────────────────────────────────────────────
// Internal Queries
// ────────────────────────────────────────────────────────────────

export const getRepositoryById = internalQuery({
  args: { repositoryId: v.id("repositories") },
  handler: async (ctx, { repositoryId }) => {
    const repository = await ctx.db.get(repositoryId);
    if (!repository) return null;

    // Internal callers do not have a Clerk identity, but still must not operate
    // on orphaned repository records.
    const owner = await ctx.db.get(repository.userId);
    if (!owner) {
      throw new ConvexError("Repository not found or access denied");
    }
    return repository;
  },
});

export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId);
  },
});

export const getKnowledgeByUserAndRepo = internalQuery({
  args: {
    userId: v.id("users"),
    repositoryId: v.id("repositories"),
  },
  handler: async (ctx, { userId, repositoryId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("User not found");

    const repository = await ctx.db.get(repositoryId);
    if (!repository) return null;
    assertUserOwns(repository.userId, userId, "Repository");

    return await ctx.db
      .query("repoKnowledge")
      .withIndex("by_user_and_repository", (q) =>
        q.eq("userId", userId).eq("repositoryId", repositoryId)
      )
      .first();
  },
});

export const getAllKnowledgeForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("User not found");

    return await ctx.db
      .query("repoKnowledge")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getAllRepositoriesForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("User not found");

    return await ctx.db
      .query("repositories")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getRepoCategoriesForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("User not found");

    return await ctx.db
      .query("repositoryCategories")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getCategoriesForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("User not found");

    return await ctx.db
      .query("categories")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();
  },
});

/**
 * Validates the resource relationship for both public action wrappers and
 * scheduled workers. Scheduler-triggered actions have no Clerk identity, so
 * their authority is the user/job/repository relationship created by the
 * authenticated mutation that scheduled them.
 */
export const validateKnowledgeResources = internalQuery({
  args: {
    userId: v.id("users"),
    repositoryIds: v.array(v.id("repositories")),
    jobId: v.optional(v.id("aiProcessingJobs")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new ConvexError("User not found");

    for (const repositoryId of args.repositoryIds) {
      const repository = await ctx.db.get(repositoryId);
      if (!repository) {
        throw new ConvexError("Repository not found or access denied");
      }
      assertUserOwns(repository.userId, user._id, "Repository");
    }

    if (args.jobId) {
      const job = await ctx.db.get(args.jobId);
      if (!job) {
        throw new ConvexError("Processing job not found or access denied");
      }
      assertUserOwns(job.userId, user._id, "Processing job");

      if (job.jobType !== "knowledge_build" && job.jobType !== "knowledge_update") {
        throw new ConvexError("Processing job not found or access denied");
      }

      for (const repositoryId of args.repositoryIds) {
        if (!job.repositoryIds?.some((jobRepositoryId) => jobRepositoryId === repositoryId)) {
          throw new ConvexError("Repository not found or access denied");
        }
      }
    }

    return user;
  },
});

// ────────────────────────────────────────────────────────────────
// Internal Mutations
// ────────────────────────────────────────────────────────────────

export const storeKnowledgePage = internalMutation({
  args: {
    userId: v.id("users"),
    repositoryId: v.id("repositories"),
    markdownContent: v.string(),
    summary: v.string(),
    keyFeatures: v.array(v.string()),
    stack: v.object({
      languages: v.array(v.string()),
      keyDeps: v.array(v.string()),
      runtime: v.optional(v.string()),
    }),
    whyNotable: v.array(v.string()),
    crossReferences: v.array(v.object({
      targetRepositoryId: v.id("repositories"),
      reason: v.string(),
      edgeType: v.union(
        v.literal("llm_discovered"),
        v.literal("shared_topic"),
        v.literal("shared_language"),
        v.literal("same_owner"),
      ),
    })),
    processedAt: v.number(),
    readmeSha: v.optional(v.string()),
    readmeLength: v.optional(v.number()),
    processingModel: v.string(),
    processingTokens: v.optional(v.object({
      input: v.number(),
      output: v.number(),
    })),
    processingTimeMs: v.optional(v.number()),
    status: v.union(
      v.literal("processed"),
      v.literal("failed"),
      v.literal("no_readme"),
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new ConvexError("User not found");

    const repository = await ctx.db.get(args.repositoryId);
    if (!repository) {
      throw new ConvexError("Repository not found or access denied");
    }
    assertUserOwns(repository.userId, user._id, "Repository");

    for (const crossReference of args.crossReferences) {
      const targetRepository = await ctx.db.get(crossReference.targetRepositoryId);
      if (!targetRepository) {
        throw new ConvexError("Repository not found or access denied");
      }
      assertUserOwns(targetRepository.userId, user._id, "Repository");
    }

    // Upsert — check for existing entry
    const existing = await ctx.db
      .query("repoKnowledge")
      .withIndex("by_user_and_repository", (q) =>
        q.eq("userId", args.userId).eq("repositoryId", args.repositoryId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        markdownContent: args.markdownContent,
        summary: args.summary,
        keyFeatures: args.keyFeatures,
        stack: args.stack,
        whyNotable: args.whyNotable,
        crossReferences: args.crossReferences,
        processedAt: args.processedAt,
        readmeSha: args.readmeSha,
        readmeLength: args.readmeLength,
        processingModel: args.processingModel,
        processingTokens: args.processingTokens,
        processingTimeMs: args.processingTimeMs,
        status: args.status,
        errorMessage: args.errorMessage,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("repoKnowledge", {
        userId: args.userId,
        repositoryId: args.repositoryId,
        markdownContent: args.markdownContent,
        summary: args.summary,
        keyFeatures: args.keyFeatures,
        stack: args.stack,
        whyNotable: args.whyNotable,
        crossReferences: args.crossReferences,
        processedAt: args.processedAt,
        readmeSha: args.readmeSha,
        readmeLength: args.readmeLength,
        processingModel: args.processingModel,
        processingTokens: args.processingTokens,
        processingTimeMs: args.processingTimeMs,
        status: args.status,
        errorMessage: args.errorMessage,
      });
    }
  },
});

export const updateJobProgress = internalMutation({
  args: {
    jobId: v.id("aiProcessingJobs"),
    processed: v.number(),
    total: v.number(),
    currentRepository: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    )),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) return;

    const owner = await ctx.db.get(job.userId);
    if (!owner) {
      throw new ConvexError("Processing job not found or access denied");
    }

    const patch: Record<string, any> = {
      progress: {
        processed: args.processed,
        total: args.total,
        currentRepository: args.currentRepository,
      },
    };

    if (args.status) {
      patch.status = args.status;
    }
    if (args.status === "completed" || args.status === "failed") {
      patch.completedAt = Date.now();
    }
    if (args.errorMessage) {
      patch.errorMessage = args.errorMessage;
    }

    await ctx.db.patch(args.jobId, patch);
  },
});

export const updateKnowledgeCrossRefs = internalMutation({
  args: {
    knowledgeId: v.id("repoKnowledge"),
    crossReferences: v.array(v.object({
      targetRepositoryId: v.id("repositories"),
      reason: v.string(),
      edgeType: v.union(
        v.literal("llm_discovered"),
        v.literal("shared_topic"),
        v.literal("shared_language"),
        v.literal("same_owner"),
      ),
    })),
    markdownContent: v.string(),
  },
  handler: async (ctx, args) => {
    const knowledge = await ctx.db.get(args.knowledgeId);
    if (!knowledge) {
      throw new ConvexError("Knowledge page not found or access denied");
    }

    const sourceRepository = await ctx.db.get(knowledge.repositoryId);
    if (!sourceRepository) {
      throw new ConvexError("Repository not found or access denied");
    }
    assertUserOwns(sourceRepository.userId, knowledge.userId, "Repository");

    for (const crossReference of args.crossReferences) {
      const targetRepository = await ctx.db.get(crossReference.targetRepositoryId);
      if (!targetRepository) {
        throw new ConvexError("Repository not found or access denied");
      }
      assertUserOwns(targetRepository.userId, knowledge.userId, "Repository");
    }

    await ctx.db.patch(args.knowledgeId, {
      crossReferences: args.crossReferences,
      markdownContent: args.markdownContent,
    });
  },
});

export const recordKnowledgeUsage = internalMutation({
  args: {
    userId: v.id("users"),
    jobId: v.optional(v.id("aiProcessingJobs")),
    provider: v.union(v.literal("claude"), v.literal("openai"), v.literal("cerebras")),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    estimatedCostUsd: v.number(),
    requestType: v.union(
      v.literal("knowledge_distillation"),
      v.literal("knowledge_crossref"),
    ),
    providerRequestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new ConvexError("User not found");

    if (args.jobId) {
      const job = await ctx.db.get(args.jobId);
      if (!job) {
        throw new ConvexError("Processing job not found or access denied");
      }
      assertUserOwns(job.userId, user._id, "Processing job");
    }

    return await ctx.db.insert("aiUsage", {
      userId: args.userId,
      jobId: args.jobId,
      provider: args.provider,
      model: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      totalTokens: args.totalTokens,
      estimatedCostUsd: args.estimatedCostUsd,
      requestType: args.requestType,
      providerRequestId: args.providerRequestId,
      createdAt: Date.now(),
    });
  },
});

// ────────────────────────────────────────────────────────────────
// Public Queries
// ────────────────────────────────────────────────────────────────

// Get all processed knowledge pages for a user
export const getKnowledgePages = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, args.clerkUserId);

    const pages = await ctx.db
      .query("repoKnowledge")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    // Join with repository data
    const enriched = await Promise.all(
      pages.map(async (page) => {
        const repo = await ctx.db.get(page.repositoryId);
        return {
          ...page,
          repository: repo && repo.userId === user._id
            ? {
                name: repo.name,
                fullName: repo.fullName,
                language: repo.language,
                stargazersCount: repo.stargazersCount,
                htmlUrl: repo.htmlUrl,
              }
            : null,
        };
      })
    );

    return enriched;
  },
});

// Get a single knowledge page by repository ID
export const getKnowledgePage = query({
  args: {
    clerkUserId: v.string(),
    repositoryId: v.id("repositories"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, args.clerkUserId);

    const repository = await ctx.db.get(args.repositoryId);
    if (!repository) {
      throw new ConvexError("Repository not found or access denied");
    }
    assertUserOwns(repository.userId, user._id, "Repository");

    const page = await ctx.db
      .query("repoKnowledge")
      .withIndex("by_user_and_repository", (q) =>
        q.eq("userId", user._id).eq("repositoryId", args.repositoryId)
      )
      .first();

    if (!page) return null;

    // Enrich cross-references with repo names
    const enrichedCrossRefs = await Promise.all(
      page.crossReferences.map(async (ref) => {
        const targetRepo = await ctx.db.get(ref.targetRepositoryId);
        if (!targetRepo) {
          throw new ConvexError("Repository not found or access denied");
        }
        assertUserOwns(targetRepo.userId, user._id, "Repository");
        return {
          ...ref,
          targetRepoName: targetRepo.fullName,
          targetRepoLanguage: targetRepo.language || null,
        };
      })
    );

    return {
      ...page,
      crossReferences: enrichedCrossRefs,
      repository: {
        name: repository.name,
        fullName: repository.fullName,
        language: repository.language,
        stargazersCount: repository.stargazersCount,
        htmlUrl: repository.htmlUrl,
        description: repository.description,
        defaultBranch: repository.defaultBranch,
      },
    };
  },
});

// Get graph data (nodes + edges) for visualization
export const getGraphData = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> => {
    const user = await requireAuthenticatedUser(ctx, args.clerkUserId);

    // Get all repos and knowledge pages
    const repos = await ctx.db
      .query("repositories")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();
    const repoMap = new Map(repos.map((repo) => [repo._id.toString(), repo]));

    const knowledgePages = await ctx.db
      .query("repoKnowledge")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    // Get category mappings
    const repoCats = await ctx.db
      .query("repositoryCategories")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    const categories = await ctx.db
      .query("categories")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    const categoryMap = new Map(categories.map((c) => [c._id.toString(), c.name]));

    // Build repo-to-categories lookup
    const repoCategoryNames = new Map<string, string[]>();
    for (const rc of repoCats) {
      const repoId = rc.repositoryId.toString();
      if (!repoMap.has(repoId)) continue;
      const catName = categoryMap.get(rc.categoryId.toString());
      if (catName) {
        const existing = repoCategoryNames.get(repoId) || [];
        existing.push(catName);
        repoCategoryNames.set(repoId, existing);
      }
    }

    // Build knowledge lookup
    const knowledgeMap = new Map(
      knowledgePages
        .filter((knowledge) => repoMap.has(knowledge.repositoryId.toString()))
        .map((knowledge) => [knowledge.repositoryId.toString(), knowledge])
    );

    // Build nodes
    const nodes: GraphNode[] = repos.map((repo) => {
      const knowledge = knowledgeMap.get(repo._id.toString());
      return {
        id: repo._id.toString(),
        label: repo.fullName,
        language: repo.language || null,
        stars: repo.stargazersCount,
        status: knowledge?.status || "unprocessed",
        summary: knowledge?.summary || "",
        categoryNames: repoCategoryNames.get(repo._id.toString()) || [],
      };
    });

    // Build edges from cross-references
    const edges: GraphEdge[] = [];
    const edgeSet = new Set<string>(); // Dedupe bidirectional edges
    for (const knowledge of knowledgePages) {
      if (!repoMap.has(knowledge.repositoryId.toString())) continue;
      for (const ref of knowledge.crossReferences) {
        if (!repoMap.has(ref.targetRepositoryId.toString())) continue;
        const edgeKey = [knowledge.repositoryId.toString(), ref.targetRepositoryId.toString()]
          .sort()
          .join("-");
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          edges.push({
            source: knowledge.repositoryId.toString(),
            target: ref.targetRepositoryId.toString(),
            reason: ref.reason,
            edgeType: ref.edgeType,
          });
        }
      }
    }

    return { nodes, edges };
  },
});

// Get processing status
export const getKnowledgeStatus = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, args.clerkUserId);

    const totalRepos = await ctx.db
      .query("repositories")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    const knowledgePages = await ctx.db
      .query("repoKnowledge")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    const processed = knowledgePages.filter((k) => k.status === "processed").length;
    const failed = knowledgePages.filter((k) => k.status === "failed").length;
    const noReadme = knowledgePages.filter((k) => k.status === "no_readme").length;
    const unprocessed = totalRepos.length - knowledgePages.length;

    return {
      total: totalRepos.length,
      processed,
      failed,
      noReadme,
      unprocessed,
    };
  },
});

// Search knowledge pages
export const searchKnowledge = query({
  args: {
    clerkUserId: v.string(),
    searchText: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, args.clerkUserId);

    const results = await ctx.db
      .query("repoKnowledge")
      .withSearchIndex("search_knowledge", (q) =>
        q.search("markdownContent", args.searchText).eq("userId", user._id)
      )
      .take(50);

    // Enrich with repo data
    const enriched = await Promise.all(
      results.map(async (page) => {
        const repo = await ctx.db.get(page.repositoryId);
        return {
          ...page,
          repository: repo && repo.userId === user._id
            ? {
                name: repo.name,
                fullName: repo.fullName,
                language: repo.language,
                stargazersCount: repo.stargazersCount,
              }
            : null,
        };
      })
    );

    return enriched;
  },
});


// Resolve wikilinks by fullName — used by the document reader
export const resolveWikilinks = query({
  args: {
    clerkUserId: v.string(),
    fullNames: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, args.clerkUserId);
    if (args.fullNames.length === 0) return [];

    // Load user's repositories and build a lookup by fullName
    const repos = await ctx.db
      .query("repositories")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();
    const repoByName = new Map(repos.map((r) => [r.fullName, r]));

    // Load knowledge pages for the user
    const knowledgePages = await ctx.db
      .query("repoKnowledge")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();
    const knowledgeByRepoId = new Map(
      knowledgePages.map((k) => [k.repositoryId.toString(), k])
    );

    return args.fullNames.map((fullName) => {
      const repo = repoByName.get(fullName);
      if (!repo) {
        return { fullName, status: "not_found" as const };
      }
      const knowledge = knowledgeByRepoId.get(repo._id.toString());
      if (knowledge && knowledge.status === "processed") {
        return {
          fullName,
          status: "has_knowledge" as const,
          repositoryId: repo._id,
          knowledgeId: knowledge._id,
        };
      }
      return {
        fullName,
        status: "no_knowledge" as const,
        repositoryId: repo._id,
      };
    });
  },
});

// ────────────────────────────────────────────────────────────────
// Public Mutations
// ────────────────────────────────────────────────────────────────

// Start a full knowledge build
export const startKnowledgeBuild = mutation({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, args.clerkUserId);

    // Check AI settings
    const settings = await ctx.db
      .query("aiSettings")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .first();
    if (!settings?.enableAI) {
      throw new ConvexError("AI features are not enabled");
    }

    // Get all repos
    const allRepos = await ctx.db
      .query("repositories")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    // Get existing knowledge entries — failed repos should be retried, so we only
    // treat "processed" and "no_readme" as truly done for Build Graph purposes.
    const existing = await ctx.db
      .query("repoKnowledge")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();
    const completedSet = new Set(
      existing
        .filter((k) => k.status === "processed" || k.status === "no_readme")
        .map((k) => k.repositoryId.toString())
    );

    // Filter to unprocessed + previously-failed
    const unprocessedIds = allRepos
      .filter((r) => !completedSet.has(r._id.toString()))
      .map((r) => r._id);

    if (unprocessedIds.length === 0) {
      throw new ConvexError("All repositories have already been processed");
    }

    // Create job
    const batchId = `kb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const jobId = await ctx.db.insert("aiProcessingJobs", {
      userId: user._id,
      jobType: "knowledge_build",
      status: "pending",
      repositoryIds: unprocessedIds,
      batchId,
      progress: {
        processed: 0,
        total: unprocessedIds.length,
      },
      startedAt: Date.now(),
    });

    // Scheduler calls do not carry Clerk identities, so execute the internal
    // worker with the user/job/repository relationship created above.
    await ctx.scheduler.runAfter(0, internal.knowledge.processBatchInternal, {
      userId: user._id,
      repositoryIds: unprocessedIds,
      jobId,
    });

    return {
      jobId,
      batchId,
      totalToProcess: unprocessedIds.length,
    };
  },
});

// Recent processed knowledge entries for the live progress ticker.
// Returns the most recently processed entries joined with their repo fullName.
export const getRecentKnowledgeEntries = query({
  args: {
    clerkUserId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, args.clerkUserId);

    const limit = args.limit ?? 5;
    const entries = await ctx.db
      .query("repoKnowledge")
      .withIndex("by_user_and_processed_at", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    return await Promise.all(
      entries.map(async (k) => {
        const repo = await ctx.db.get(k.repositoryId);
        return {
          _id: k._id,
          repositoryId: k.repositoryId,
          fullName: repo && repo.userId === user._id ? repo.fullName : "Unknown",
          status: k.status,
          processedAt: k.processedAt,
          processingTimeMs: k.processingTimeMs,
          summary: k.summary,
        };
      })
    );
  },
});

// Cancel any stuck or orphaned processing jobs. Marks all "processing" and "pending"
// jobs as "cancelled" so the scheduler releases them and the UI shows a clean state.
// Use when Build Graph was tapped multiple times or a job stalled mid-batch.
export const cancelStuckJobs = mutation({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, args.clerkUserId);

    const stuckJobs = await ctx.db
      .query("aiProcessingJobs")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "processing"),
          q.eq(q.field("status"), "pending")
        )
      )
      .collect();

    for (const job of stuckJobs) {
      await ctx.db.patch(job._id, {
        status: "cancelled",
        completedAt: Date.now(),
        errorMessage: "Cancelled via cleanup — job was stuck or orphaned",
      });
    }

    return { cancelled: stuckJobs.length };
  },
});

// Reset repos stuck in wrong states so Build Graph can retry them.
// Use when a prior run produced many false "no_readme" entries from token/rate-limit
// failures. Deletes knowledge entries for repos with status "failed" (always) and
// "no_readme" (when includeNoReadme is true) so Build Graph treats them as unprocessed.
export const resetFailedKnowledge = mutation({
  args: {
    clerkUserId: v.string(),
    includeNoReadme: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, args.clerkUserId);

    const entries = await ctx.db
      .query("repoKnowledge")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    const targets = entries.filter((k) => {
      if (k.status === "failed") return true;
      if (args.includeNoReadme && k.status === "no_readme") return true;
      return false;
    });

    for (const entry of targets) {
      await ctx.db.delete(entry._id);
    }

    return { deleted: targets.length };
  },
});

// Start an incremental knowledge update
export const startKnowledgeUpdate = mutation({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, args.clerkUserId);

    const settings = await ctx.db
      .query("aiSettings")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .first();
    if (!settings?.enableAI) {
      throw new ConvexError("AI features are not enabled");
    }

    // Get all repos
    const allRepos = await ctx.db
      .query("repositories")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    // Get existing knowledge pages
    const existing = await ctx.db
      .query("repoKnowledge")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();
    const knowledgeMap = new Map(
      existing.map((k) => [k.repositoryId.toString(), k])
    );

    // Find repos needing processing:
    // 1. Never processed
    // 2. starredAt > processedAt (re-starred)
    // 3. readmeSha changed
    const needsProcessing = allRepos.filter((repo) => {
      const knowledge = knowledgeMap.get(repo._id.toString());
      if (!knowledge) return true; // Never processed
      if (knowledge.status === "no_readme") return false; // Skip no-readme unless forced

      // Check if starred more recently than processed
      const starredTime = new Date(repo.starredAt).getTime();
      if (starredTime > knowledge.processedAt) return true;

      // Check if README SHA changed (will be verified during fetch)
      if (repo.readmeSha && knowledge.readmeSha && repo.readmeSha !== knowledge.readmeSha) {
        return true;
      }

      return false;
    });

    const repoIds = needsProcessing.map((r) => r._id);

    if (repoIds.length === 0) {
      return {
        jobId: null,
        batchId: null,
        totalToProcess: 0,
        message: "All repositories are up to date",
      };
    }

    const batchId = `ku_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const jobId = await ctx.db.insert("aiProcessingJobs", {
      userId: user._id,
      jobType: "knowledge_update",
      status: "pending",
      repositoryIds: repoIds,
      batchId,
      progress: {
        processed: 0,
        total: repoIds.length,
      },
      startedAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.knowledge.processBatchInternal, {
      userId: user._id,
      repositoryIds: repoIds,
      jobId,
    });

    return {
      jobId,
      batchId,
      totalToProcess: repoIds.length,
    };
  },
});

// ────────────────────────────────────────────────────────────────
// Actions (external API calls)
// ────────────────────────────────────────────────────────────────

// Fetch full README content for a repository
export const fetchFullReadme = internalAction({
  args: {
    repositoryId: v.id("repositories"),
    githubToken: v.string(),
  },
  handler: async (ctx, args): Promise<{
    content: string | null;
    sha: string | null;
    size: number;
    error?: string;
  }> => {
    const repository = await ctx.runQuery(internal.knowledge.getRepositoryById, {
      repositoryId: args.repositoryId,
    });

    if (!repository) {
      return { content: null, sha: null, size: 0, error: "Repository not found" };
    }

    try {
      const response = await fetch(
        `${GITHUB_API_BASE}/repos/${repository.fullName}/readme`,
        {
          headers: {
            Authorization: `Bearer ${args.githubToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": GITHUB_API_VERSION,
          },
        }
      );

      if (response.status === 404) {
        return { content: null, sha: null, size: 0 };
      }

      if (!response.ok) {
        return {
          content: null,
          sha: null,
          size: 0,
          error: `GitHub API error: ${response.status}`,
        };
      }

      const data = await response.json();
      // GitHub returns line-wrapped base64; atob() doesn't tolerate whitespace.
      // Decode base64 -> bytes -> UTF-8 string using V8-safe primitives (no Node Buffer).
      const base64 = (data.content ?? "").replace(/\s/g, "");
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const rawContent = new TextDecoder("utf-8").decode(bytes);
      const cleaned = cleanMarkdown(rawContent);

      return {
        content: cleaned,
        sha: data.sha,
        size: rawContent.length,
      };
    } catch (error) {
      return {
        content: null,
        sha: null,
        size: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// Process a single repository through the LLM
export const processRepository = internalAction({
  args: {
    userId: v.id("users"),
    repositoryId: v.id("repositories"),
    githubToken: v.string(),
    provider: v.union(v.literal("claude"), v.literal("openai"), v.literal("cerebras")),
    model: v.string(),
    jobId: v.optional(v.id("aiProcessingJobs")),
  },
  handler: async (ctx, args): Promise<ProcessRepositoryResult> => {
    const startTime = Date.now();

    const user = await ctx.runQuery(internal.knowledge.validateKnowledgeResources, {
      userId: args.userId,
      repositoryIds: [args.repositoryId],
      jobId: args.jobId,
    });

    const repo = await ctx.runQuery(internal.knowledge.getRepositoryById, {
      repositoryId: args.repositoryId,
    });
    if (!repo) {
      throw new ConvexError("Repository not found");
    }
    assertUserOwns(repo.userId, user._id, "Repository");

    // 1. Fetch full README
    const readme = await ctx.runAction(internal.knowledge.fetchFullReadme, {
      repositoryId: args.repositoryId,
      githubToken: args.githubToken,
    });

    if (!readme.content) {
      // Distinguish legitimate 404 (no README exists) from fetch failures
      // (auth error, rate limit, network, etc.). Only a true 404 has no error field.
      const isTrue404 = !readme.error;
      if (isTrue404) {
        await ctx.runMutation(internal.knowledge.storeKnowledgePage, {
          userId: args.userId,
          repositoryId: args.repositoryId,
          markdownContent: `# ${repo.fullName}\n\n*No README available for this repository.*`,
          summary: "No README available",
          keyFeatures: [],
          stack: { languages: [repo.language || "Unknown"], keyDeps: [] },
          whyNotable: [],
          crossReferences: [],
          processedAt: Date.now(),
          readmeSha: undefined,
          readmeLength: 0,
          processingModel: args.model,
          status: "no_readme",
        });
        return { success: true, status: "no_readme" as const, repositoryId: args.repositoryId };
      }
      // Fetch failed — mark as failed so it can be retried
      await ctx.runMutation(internal.knowledge.storeKnowledgePage, {
        userId: args.userId,
        repositoryId: args.repositoryId,
        markdownContent: `# ${repo.fullName}\n\n*README fetch failed: ${readme.error}*`,
        summary: "README fetch failed",
        keyFeatures: [],
        stack: { languages: [repo.language || "Unknown"], keyDeps: [] },
        whyNotable: [],
        crossReferences: [],
        processedAt: Date.now(),
        readmeSha: undefined,
        readmeLength: 0,
        processingModel: args.model,
        status: "failed",
        errorMessage: readme.error,
      });
      return {
        success: false,
        status: "failed" as const,
        repositoryId: args.repositoryId,
        error: readme.error,
      };
    }

    // 2. Build distillation prompt
    const prompt = buildDistillationPrompt(repo, readme.content);

    // 3. Call LLM
    let llmResult;
    try {
      llmResult = await callLLM(args.provider, args.model, prompt);
    } catch (error) {
      // Store as failed
      await ctx.runMutation(internal.knowledge.storeKnowledgePage, {
        userId: args.userId,
        repositoryId: args.repositoryId,
        markdownContent: `# ${repo.fullName}\n\n*Processing failed.*`,
        summary: "Processing failed",
        keyFeatures: [],
        stack: { languages: [], keyDeps: [] },
        whyNotable: [],
        crossReferences: [],
        processedAt: Date.now(),
        readmeSha: readme.sha ?? undefined,
        readmeLength: readme.size,
        processingModel: args.model,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "LLM call failed",
      });
      return {
        success: false,
        status: "failed" as const,
        repositoryId: args.repositoryId,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }

    // 4. Parse structured JSON response
    let parsed: LLMDistillationResponse;
    try {
      parsed = parseLLMResponse(llmResult.content);
    } catch (error) {
      await ctx.runMutation(internal.knowledge.storeKnowledgePage, {
        userId: args.userId,
        repositoryId: args.repositoryId,
        markdownContent: `# ${repo.fullName}\n\n*Failed to parse LLM response.*`,
        summary: "Parse error",
        keyFeatures: [],
        stack: { languages: [], keyDeps: [] },
        whyNotable: [],
        crossReferences: [],
        processedAt: Date.now(),
        readmeSha: readme.sha ?? undefined,
        readmeLength: readme.size,
        processingModel: args.model,
        status: "failed",
        errorMessage: `Parse error: ${error instanceof Error ? error.message : "Unknown"}`,
      });
      return {
        success: false,
        status: "failed" as const,
        repositoryId: args.repositoryId,
        error: `Parse error: ${error instanceof Error ? error.message : "Unknown"}`,
      };
    }

    // 5. Assemble markdown
    const markdown = assembleMarkdown(repo, parsed);
    const processingTime = Date.now() - startTime;

    // 6. Store in repoKnowledge
    await ctx.runMutation(internal.knowledge.storeKnowledgePage, {
      userId: args.userId,
      repositoryId: args.repositoryId,
      markdownContent: markdown,
      summary: parsed.summary,
      keyFeatures: parsed.keyFeatures,
      stack: parsed.stack,
      whyNotable: parsed.whyNotable,
      crossReferences: [],
      processedAt: Date.now(),
      readmeSha: readme.sha ?? undefined,
      readmeLength: readme.size,
      processingModel: args.model,
      processingTokens: {
        input: llmResult.inputTokens,
        output: llmResult.outputTokens,
      },
      processingTimeMs: processingTime,
      status: "processed",
    });

    // 7. Record usage
    await ctx.runMutation(internal.knowledge.recordKnowledgeUsage, {
      userId: args.userId,
      jobId: args.jobId,
      provider: args.provider,
      model: args.model,
      inputTokens: llmResult.inputTokens,
      outputTokens: llmResult.outputTokens,
      totalTokens: llmResult.inputTokens + llmResult.outputTokens,
      estimatedCostUsd: calculateCost(args.provider, args.model, llmResult.inputTokens, llmResult.outputTokens),
      requestType: "knowledge_distillation",
      providerRequestId: llmResult.requestId,
    });

    return {
      success: true,
      status: "processed" as const,
      repositoryId: args.repositoryId,
      processingTimeMs: processingTime,
    };
  },
});

// Batch process repositories. This public wrapper only establishes the caller's
// identity and resource ownership; the scheduler uses the internal worker below.
export const processBatch = action({
  args: {
    clerkUserId: v.string(),
    repositoryIds: v.array(v.id("repositories")),
    jobId: v.id("aiProcessingJobs"),
  },
  handler: async (ctx, args): Promise<ProcessBatchResult> => {
    const user = await requireAuthenticatedActionUser(ctx, args.clerkUserId);
    await ctx.runQuery(internal.knowledge.validateKnowledgeResources, {
      userId: user._id,
      repositoryIds: args.repositoryIds,
      jobId: args.jobId,
    });

    return await ctx.runAction(internal.knowledge.processBatchInternal, {
      userId: user._id,
      repositoryIds: args.repositoryIds,
      jobId: args.jobId,
    });
  },
});

export const processBatchInternal = internalAction({
  args: {
    userId: v.id("users"),
    repositoryIds: v.array(v.id("repositories")),
    jobId: v.id("aiProcessingJobs"),
  },
  handler: async (ctx, args): Promise<ProcessBatchResult> => {
    const user = await ctx.runQuery(internal.knowledge.validateKnowledgeResources, {
      userId: args.userId,
      repositoryIds: args.repositoryIds,
      jobId: args.jobId,
    });

    const settings = await ctx.runQuery(internal.knowledge.getAiSettings, {
      userId: user._id,
    });
    if (!settings) throw new ConvexError("AI settings not found");

    // Knowledge pipeline only supports cloud providers (not local ollama).
    if (settings.aiProvider !== "claude" && settings.aiProvider !== "openai" && settings.aiProvider !== "cerebras") {
      throw new ConvexError(
        `Knowledge pipeline does not support provider "${settings.aiProvider}". Use Claude, OpenAI, or Cerebras.`
      );
    }

    const tokenInfo = await ctx.runQuery(internal.github.getGithubTokenInfo, {
      clerkUserId: user.clerkUserId,
    });
    if (!tokenInfo?.accessToken) {
      throw new ConvexError("GitHub token not available");
    }

    await ctx.runMutation(internal.knowledge.updateJobProgress, {
      jobId: args.jobId,
      processed: 0,
      total: args.repositoryIds.length,
      status: "processing",
    });

    let processed = 0;
    let failed = 0;

    for (const repositoryId of args.repositoryIds) {
      try {
        if (processed > 0) {
          await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
        }

        const repo = await ctx.runQuery(internal.knowledge.getRepositoryById, {
          repositoryId,
        });
        if (!repo) {
          throw new ConvexError("Repository not found or access denied");
        }
        assertUserOwns(repo.userId, user._id, "Repository");

        await ctx.runMutation(internal.knowledge.updateJobProgress, {
          jobId: args.jobId,
          processed,
          total: args.repositoryIds.length,
          currentRepository: repo.fullName,
        });

        const result = await ctx.runAction(internal.knowledge.processRepository, {
          userId: user._id,
          repositoryId,
          githubToken: tokenInfo.accessToken,
          provider: settings.aiProvider as "claude" | "openai" | "cerebras",
          model: settings.aiModel,
          jobId: args.jobId,
        });

        processed++;
        if (!result.success) failed++;
      } catch (error) {
        console.error(`Error processing repo ${repositoryId}:`, error);
        processed++;
        failed++;
      }
    }

    await ctx.runMutation(internal.knowledge.updateJobProgress, {
      jobId: args.jobId,
      processed,
      total: args.repositoryIds.length,
      status: "completed",
    });

    await ctx.scheduler.runAfter(0, internal.knowledge.buildCrossReferencesInternal, {
      userId: user._id,
    });

    return {
      processed,
      failed,
      total: args.repositoryIds.length,
    };
  },
});

// Build cross-references between repos. A public call is authenticated before
// dispatching to the worker, while scheduled calls target the worker directly.
export const buildCrossReferences = action({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args): Promise<BuildCrossReferencesResult> => {
    const user = await requireAuthenticatedActionUser(ctx, args.clerkUserId);
    return await ctx.runAction(internal.knowledge.buildCrossReferencesInternal, {
      userId: user._id,
    });
  },
});

export const buildCrossReferencesInternal = internalAction({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<BuildCrossReferencesResult> => {
    const user = await ctx.runQuery(internal.knowledge.getUserById, {
      userId: args.userId,
    });
    if (!user) throw new ConvexError("User not found");

    const knowledgePages = await ctx.runQuery(internal.knowledge.getAllKnowledgeForUser, {
      userId: user._id,
    });

    const repos = await ctx.runQuery(internal.knowledge.getAllRepositoriesForUser, {
      userId: user._id,
    });

    const repoMap = new Map(repos.map((r) => [r._id.toString(), r]));
    const processedPages = knowledgePages.filter(
      (page) => page.status === "processed" && repoMap.has(page.repositoryId.toString())
    );

    if (processedPages.length < 2) {
      return { crossReferencesAdded: 0 };
    }

    let totalCrossRefs = 0;

    for (const page of processedPages) {
      const repo = repoMap.get(page.repositoryId.toString());
      if (!repo) continue;

      const crossRefs: Array<{
        targetRepositoryId: Id<"repositories">;
        reason: string;
        edgeType: "shared_topic" | "shared_language" | "same_owner" | "llm_discovered";
      }> = [];

      for (const otherPage of processedPages) {
        if (otherPage._id === page._id) continue;
        const otherRepo = repoMap.get(otherPage.repositoryId.toString());
        if (!otherRepo) continue;

        if (repo.owner.login === otherRepo.owner.login) {
          crossRefs.push({
            targetRepositoryId: otherPage.repositoryId,
            reason: `Same owner: ${repo.owner.login}`,
            edgeType: "same_owner",
          });
          continue;
        }

        if (repo.language && otherRepo.language && repo.language === otherRepo.language) {
          const sharedTopics = repo.topics.filter((t) => otherRepo.topics.includes(t));
          if (sharedTopics.length > 0) {
            crossRefs.push({
              targetRepositoryId: otherPage.repositoryId,
              reason: `Shared: ${repo.language} + topics: ${sharedTopics.slice(0, 3).join(', ')}`,
              edgeType: "shared_topic",
            });
            continue;
          }
        }

        const sharedTopics = repo.topics.filter((t) => otherRepo.topics.includes(t));
        if (sharedTopics.length >= 2) {
          crossRefs.push({
            targetRepositoryId: otherPage.repositoryId,
            reason: `Shared topics: ${sharedTopics.slice(0, 3).join(', ')}`,
            edgeType: "shared_topic",
          });
        }
      }

      const limitedCrossRefs = crossRefs.slice(0, 10);
      const enrichedRefs = limitedCrossRefs.map((ref) => {
        const targetRepo = repoMap.get(ref.targetRepositoryId.toString());
        return {
          fullName: targetRepo?.fullName || "Unknown",
          reason: ref.reason,
        };
      });
      const updatedMarkdown = updateMarkdownCrossRefs(page.markdownContent, enrichedRefs);

      await ctx.runMutation(internal.knowledge.updateKnowledgeCrossRefs, {
        knowledgeId: page._id,
        crossReferences: limitedCrossRefs,
        markdownContent: updatedMarkdown,
      });

      totalCrossRefs += limitedCrossRefs.length;
    }

    return { crossReferencesAdded: totalCrossRefs };
  },
});

// ────────────────────────────────────────────────────────────────
// Internal helper queries used by processBatch
// ────────────────────────────────────────────────────────────────

export const getAiSettings = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new ConvexError("User not found");

    const settings = await ctx.db
      .query("aiSettings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();

    if (!settings) {
      return {
        aiProvider: "claude" as const,
        aiModel: "claude-haiku-4-5",
        enableAI: false,
        batchSize: 10,
      };
    }

    return settings;
  },
});
