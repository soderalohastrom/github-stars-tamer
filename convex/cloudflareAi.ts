import { ConvexError, v } from "convex/values";
import { action, internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { assertUserOwns, requireAuthenticatedActionUser } from "./authz";

const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const DEFAULT_TIMEOUT_MS = 30_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 60_000;
const MAX_README_CHARS = 1_500;
const MAX_CATEGORIES = 100;

type WorkerRepository = {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  topics: string[];
  stars: number;
  readmeExcerpt?: string;
};

type WorkerSuggestion = {
  repoId: string;
  category: string;
  confidence: number;
  reasoning: string;
  isNewCategory?: boolean;
  suggestedColor?: string;
  suggestedIcon?: string;
};

type WorkerResponse = {
  suggestions: WorkerSuggestion[];
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  requestId?: string;
};

function workerCategorizeUrl(): string {
  const baseUrl = process.env.CLOUDFLARE_AI_WORKER_URL?.trim();
  if (!baseUrl) {
    throw new ConvexError(
      "CLOUDFLARE_AI_WORKER_URL is not configured in Convex environment variables."
    );
  }

  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Unsupported protocol");
    }
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/v1/categorize`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    throw new ConvexError("CLOUDFLARE_AI_WORKER_URL must be a valid HTTP(S) URL.");
  }
}

function timeoutFor(value?: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.floor(value!)));
}

function asRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ConvexError(message);
  }
  return value as Record<string, unknown>;
}

function requiredString(
  value: unknown,
  field: string,
  maxLength = 2_000
): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maxLength) {
    throw new ConvexError(`Cloudflare AI Worker returned an invalid ${field}.`);
  }
  return value.trim();
}

function optionalString(value: unknown, field: string, maxLength = 2_000): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value, field, maxLength);
}

function requiredConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new ConvexError("Cloudflare AI Worker returned an invalid confidence.");
  }
  return value;
}

function parseWorkerResponse(value: unknown): WorkerResponse {
  const response = asRecord(value, "Cloudflare AI Worker returned an invalid JSON response.");
  if (!Array.isArray(response.suggestions)) {
    throw new ConvexError("Cloudflare AI Worker response must include a suggestions array.");
  }

  const seenRepoIds = new Set<string>();
  const suggestions = response.suggestions.map((value) => {
    const suggestion = asRecord(value, "Cloudflare AI Worker returned an invalid suggestion.");
    const repoId = requiredString(suggestion.repoId, "repoId", 256);
    if (seenRepoIds.has(repoId)) {
      throw new ConvexError("Cloudflare AI Worker returned duplicate repository suggestions.");
    }
    seenRepoIds.add(repoId);

    const isNewCategory = suggestion.isNewCategory;
    if (isNewCategory !== undefined && typeof isNewCategory !== "boolean") {
      throw new ConvexError("Cloudflare AI Worker returned an invalid isNewCategory value.");
    }

    const suggestedColor = optionalString(suggestion.suggestedColor, "suggestedColor", 7);
    if (suggestedColor && !/^#[0-9a-fA-F]{6}$/.test(suggestedColor)) {
      throw new ConvexError("Cloudflare AI Worker returned an invalid suggestedColor.");
    }

    return {
      repoId,
      category: requiredString(suggestion.category, "category", 120),
      confidence: requiredConfidence(suggestion.confidence),
      reasoning: requiredString(suggestion.reasoning, "reasoning", 1_000),
      isNewCategory: isNewCategory as boolean | undefined,
      suggestedColor,
      suggestedIcon: optionalString(suggestion.suggestedIcon, "suggestedIcon", 64),
    };
  });

  let usage: WorkerResponse["usage"];
  if (response.usage !== undefined) {
    const rawUsage = asRecord(response.usage, "Cloudflare AI Worker returned invalid usage.");
    const parseTokenCount = (value: unknown, field: string) => {
      if (value === undefined) return undefined;
      if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
        throw new ConvexError(`Cloudflare AI Worker returned an invalid ${field}.`);
      }
      return value;
    };
    usage = {
      inputTokens: parseTokenCount(rawUsage.inputTokens, "inputTokens"),
      outputTokens: parseTokenCount(rawUsage.outputTokens, "outputTokens"),
    };
  }

  return {
    suggestions,
    usage,
    requestId: optionalString(response.requestId, "requestId", 256),
  };
}

async function requestWorker(
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<WorkerResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const serviceToken = process.env.CLOUDFLARE_AI_SERVICE_TOKEN?.trim();

  try {
    const response = await fetch(workerCategorizeUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(serviceToken ? { Authorization: `Bearer ${serviceToken}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ConvexError(`Cloudflare AI Worker returned HTTP ${response.status}.`);
    }

    if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      throw new ConvexError("Cloudflare AI Worker returned a non-JSON response.");
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new ConvexError("Cloudflare AI Worker returned invalid JSON.");
    }
    return parseWorkerResponse(data);
  } catch (error) {
    if (error instanceof ConvexError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ConvexError("Cloudflare AI Worker request timed out.");
    }
    throw new ConvexError("Cloudflare AI Worker request failed.");
  } finally {
    clearTimeout(timeoutId);
  }
}

function minimizedRepository(repo: any, includeReadme: boolean): WorkerRepository {
  return {
    id: String(repo._id),
    name: repo.name,
    fullName: repo.fullName,
    description: repo.description || null,
    language: repo.language || null,
    topics: (repo.topics || []).filter(Boolean).slice(0, 12),
    stars: repo.stargazersCount,
    ...(includeReadme && repo.readmeExcerpt
      ? { readmeExcerpt: String(repo.readmeExcerpt).slice(0, MAX_README_CHARS) }
      : {}),
  };
}

/**
 * Contract for CLOUDFLARE_AI_WORKER_URL/v1/categorize:
 *
 * POST {
 *   model: string,
 *   repositories: WorkerRepository[],
 *   existingCategories: string[],
 *   includeReadme: boolean,
 *   test?: boolean
 * }
 *
 * 200 application/json {
 *   suggestions: [{ repoId, category, confidence, reasoning,
 *     isNewCategory?, suggestedColor?, suggestedIcon? }],
 *   usage?: { inputTokens?: number, outputTokens?: number },
 *   requestId?: string
 * }
 */
export const categorizeRepositories = action({
  args: {
    clerkUserId: v.string(),
    repositoryIds: v.array(v.id("repositories")),
    model: v.optional(v.string()),
    includeReadme: v.optional(v.boolean()),
    batchId: v.optional(v.string()),
    timeoutMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedActionUser(ctx, args.clerkUserId);
    // Cast is temporary until Convex codegen includes this new module.
    return await ctx.runAction((internal as any).cloudflareAi.categorizeRepositoriesInternal, {
      userId: user._id,
      repositoryIds: args.repositoryIds,
      model: args.model,
      includeReadme: args.includeReadme,
      batchId: args.batchId,
      timeoutMs: args.timeoutMs,
    });
  },
});

// Internal worker for interactive and scheduled Cloudflare categorization.
export const categorizeRepositoriesInternal = internalAction({
  args: {
    userId: v.id("users"),
    repositoryIds: v.array(v.id("repositories")),
    model: v.optional(v.string()),
    includeReadme: v.optional(v.boolean()),
    batchId: v.optional(v.string()),
    timeoutMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    const model = args.model || DEFAULT_MODEL;
    const includeReadme = args.includeReadme ?? true;
    const batchId = args.batchId || `batch_${Date.now()}`;
    const repositories: WorkerRepository[] = [];
    for (const repositoryId of args.repositoryIds) {
      const repo = await ctx.runQuery(internal.claudeAi.getRepositoryById, {
        repositoryId,
        userId: args.userId,
      });
      if (repo) {
        repositories.push(minimizedRepository(repo, includeReadme));
      }
    }
    if (repositories.length === 0) {
      throw new ConvexError("No valid repositories found to categorize");
    }

    const existingCategories = await ctx.runQuery(internal.claudeAi.getUserCategoryNames, {
      userId: args.userId,
    });
    const response = await requestWorker(
      {
        model,
        repositories,
        existingCategories: existingCategories.slice(0, MAX_CATEGORIES),
        includeReadme,
      },
      timeoutFor(args.timeoutMs)
    );

    const requestedIds = new Set(repositories.map((repo) => repo.id));
    if (response.suggestions.some((suggestion) => !requestedIds.has(suggestion.repoId))) {
      throw new ConvexError("Cloudflare AI Worker suggested a repository outside this batch.");
    }

    const inputTokens = response.usage?.inputTokens ?? 0;
    const outputTokens = response.usage?.outputTokens ?? 0;
    const processingTimeMs = Date.now() - startTime;
    // Cast is temporary until Convex codegen includes this new module.
    await ctx.runMutation((internal as any).cloudflareAi.recordUsage, {
      userId: args.userId,
      model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCostUsd: 0,
      requestType: "categorization",
      providerRequestId: response.requestId,
    });

    const suggestionIds: Id<"aiCategorizationSuggestions">[] = [];
    let totalConfidence = 0;
    for (const suggestion of response.suggestions) {
      const suggestionId = await ctx.runMutation(internal.claudeAi.createSuggestion, {
        userId: args.userId,
        repositoryId: suggestion.repoId as Id<"repositories">,
        suggestedCategoryName: suggestion.category,
        suggestedCategoryColor: suggestion.suggestedColor,
        suggestedCategoryIcon: suggestion.suggestedIcon,
        confidence: suggestion.confidence,
        reasoning: suggestion.reasoning,
        metadata: {
          aiModel: model,
          processingTimeMs,
          promptVersion: "cloudflare-worker-1.0",
          existingCategories,
          batchId,
          inputTokens,
          outputTokens,
        },
      });
      suggestionIds.push(suggestionId);
      totalConfidence += suggestion.confidence;
    }

    return {
      success: true,
      suggestionIds,
      totalSuggestions: suggestionIds.length,
      averageConfidence: suggestionIds.length ? totalConfidence / suggestionIds.length : 0,
      processingTimeMs,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCostUsd: 0,
        model,
      },
      batchId,
    };
  },
});

export const testCloudflareConnection = action({
  args: {
    model: v.optional(v.string()),
    timeoutMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuthenticatedActionUser(ctx);
    const model = args.model || DEFAULT_MODEL;
    try {
      await requestWorker(
        {
          model,
          repositories: [],
          existingCategories: [],
          includeReadme: false,
          test: true,
        },
        timeoutFor(args.timeoutMs)
      );
      return { success: true, message: `Connected to ${model}` };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Connection failed.",
      };
    }
  },
});

// Kept local because the existing Claude helper's provider validator predates Cloudflare.
export const recordUsage = internalMutation({
  args: {
    userId: v.id("users"),
    jobId: v.optional(v.id("aiProcessingJobs")),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    estimatedCostUsd: v.number(),
    requestType: v.literal("categorization"),
    providerRequestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new ConvexError("User not found");

    if (args.jobId) {
      const job = await ctx.db.get(args.jobId);
      if (!job) throw new ConvexError("Job not found");
      assertUserOwns(job.userId, args.userId, "Job");
    }

    return await ctx.db.insert("aiUsage", {
      ...args,
      provider: "cloudflare",
      createdAt: Date.now(),
    });
  },
});
