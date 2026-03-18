import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Claude API configuration
const CLAUDE_API_BASE = "https://api.anthropic.com/v1/messages";
const CLAUDE_API_VERSION = "2023-06-01";

// Model pricing (per million tokens)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-opus-4-6": { input: 15.0, output: 75.0 },
};

// Default model for categorization (fast and cost-effective)
const DEFAULT_MODEL = "claude-haiku-4-5";

// Types for categorization
interface RepositoryForCategorization {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  topics: string[];
  stargazersCount: number;
  readmeExcerpt: string | null;
}

interface CategorySuggestion {
  repoId: string;
  category: string;
  confidence: number;
  reasoning: string;
  isNewCategory?: boolean;
  suggestedColor?: string;
  suggestedIcon?: string;
}

// Calculate cost from token usage
function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING[DEFAULT_MODEL];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

// Build the categorization prompt
function buildCategorizationPrompt(
  repositories: RepositoryForCategorization[],
  existingCategories: string[],
  includeReadme: boolean
): string {
  const categoryList =
    existingCategories.length > 0
      ? existingCategories.join(", ")
      : "No existing categories - suggest new ones as needed";

  const repoData = repositories.map((repo) => {
    const base = {
      id: repo.id,
      name: repo.name,
      fullName: repo.fullName,
      description: repo.description || "No description",
      language: repo.language || "Unknown",
      topics: repo.topics.length > 0 ? repo.topics : ["none"],
      stars: repo.stargazersCount,
    };

    if (includeReadme && repo.readmeExcerpt) {
      return { ...base, readmeExcerpt: repo.readmeExcerpt };
    }
    return base;
  });

  return `You are an expert at organizing GitHub repositories into meaningful categories. Your task is to analyze each repository and suggest the most appropriate category.

## Guidelines:
1. Prefer using existing categories when they are a good fit (80%+ confidence)
2. Suggest new categories only when existing ones don't fit well
3. Consider: repository name, description, programming language, topics, star count, and README if available
4. Provide confidence as a decimal between 0 and 1 (e.g., 0.85)
5. Keep reasoning concise (1-2 sentences max)
6. For new categories, suggest a descriptive name, appropriate color (hex), and icon (from Feather icons)

## Existing Categories:
${categoryList}

## Repositories to Categorize:
${JSON.stringify(repoData, null, 2)}

## Response Format:
Respond ONLY with a valid JSON array. No markdown, no explanations, just the JSON:
[
  {
    "repoId": "repository_id_here",
    "category": "Category Name",
    "confidence": 0.85,
    "reasoning": "Brief explanation",
    "isNewCategory": false
  }
]

For new categories, include:
{
  "repoId": "...",
  "category": "New Category Name",
  "confidence": 0.75,
  "reasoning": "...",
  "isNewCategory": true,
  "suggestedColor": "#3b82f6",
  "suggestedIcon": "folder"
}`;
}

// Parse Claude's response into category suggestions
function parseClaudeResponse(content: string): CategorySuggestion[] {
  // Try to extract JSON from the response
  let jsonStr = content.trim();

  // Handle markdown code blocks if present
  if (jsonStr.includes("```json")) {
    const match = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
    if (match) {
      jsonStr = match[1];
    }
  } else if (jsonStr.includes("```")) {
    const match = jsonStr.match(/```\s*([\s\S]*?)\s*```/);
    if (match) {
      jsonStr = match[1];
    }
  }

  // Find the JSON array
  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (!arrayMatch) {
    throw new Error("No JSON array found in Claude response");
  }

  try {
    const parsed = JSON.parse(arrayMatch[0]);
    if (!Array.isArray(parsed)) {
      throw new Error("Response is not an array");
    }

    // Validate and sanitize each suggestion
    return parsed.map((item: any) => ({
      repoId: String(item.repoId || ""),
      category: String(item.category || "Uncategorized"),
      confidence: Math.min(1, Math.max(0, Number(item.confidence) || 0.5)),
      reasoning: String(item.reasoning || "No reasoning provided"),
      isNewCategory: Boolean(item.isNewCategory),
      suggestedColor: item.suggestedColor
        ? String(item.suggestedColor)
        : undefined,
      suggestedIcon: item.suggestedIcon
        ? String(item.suggestedIcon)
        : undefined,
    }));
  } catch (e) {
    throw new Error(`Failed to parse Claude response: ${e}`);
  }
}

// Main categorization action using Claude API
export const categorizeRepositories = action({
  args: {
    clerkUserId: v.string(),
    repositoryIds: v.array(v.id("repositories")),
    model: v.optional(v.string()),
    includeReadme: v.optional(v.boolean()),
    batchId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    const model = args.model || DEFAULT_MODEL;
    const includeReadme = args.includeReadme ?? true;
    const batchId = args.batchId || `batch_${Date.now()}`;

    // Get the API key from environment
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new ConvexError(
        "ANTHROPIC_API_KEY not configured. Please set it in your Convex environment variables."
      );
    }

    // Get user
    const user = await ctx.runQuery(internal.users.getUserByClerkId, {
      clerkUserId: args.clerkUserId,
    });
    if (!user) {
      throw new ConvexError("User not found");
    }

    // Fetch repositories data
    const repositories: RepositoryForCategorization[] = [];
    for (const repoId of args.repositoryIds) {
      const repo = await ctx.runQuery(internal.claudeAi.getRepositoryById, {
        repositoryId: repoId,
      });
      if (repo && repo.userId === user._id) {
        repositories.push({
          id: repoId,
          name: repo.name,
          fullName: repo.fullName,
          description: repo.description || null,
          language: repo.language || null,
          topics: repo.topics || [],
          stargazersCount: repo.stargazersCount,
          readmeExcerpt: includeReadme ? repo.readmeExcerpt || null : null,
        });
      }
    }

    if (repositories.length === 0) {
      throw new ConvexError("No valid repositories found to categorize");
    }

    // Get existing categories
    const categories = await ctx.runQuery(
      internal.claudeAi.getUserCategoryNames,
      {
        userId: user._id,
      }
    );

    // Build prompt
    const prompt = buildCategorizationPrompt(
      repositories,
      categories,
      includeReadme
    );

    // Call Claude API
    let response: Response;
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
            max_tokens: 4096,
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
          }),
        });

        if (response.ok) {
          break;
        }

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get("retry-after");
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
          console.log(`Rate limited, waiting ${waitTime}ms...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          retries++;
          continue;
        }

        // Handle other errors
        const errorBody = await response.text();
        throw new ConvexError(
          `Claude API error: ${response.status} - ${errorBody}`
        );
      } catch (error) {
        if (retries >= maxRetries - 1) {
          throw error;
        }
        retries++;
        await new Promise((resolve) => setTimeout(resolve, 1000 * retries));
      }
    }

    const responseData = await response!.json();

    // Extract usage info
    const inputTokens = responseData.usage?.input_tokens || 0;
    const outputTokens = responseData.usage?.output_tokens || 0;
    const totalTokens = inputTokens + outputTokens;
    const estimatedCost = calculateCost(model, inputTokens, outputTokens);

    // Parse the response
    const content = responseData.content?.[0]?.text || "";
    let suggestions: CategorySuggestion[];

    try {
      suggestions = parseClaudeResponse(content);
    } catch (parseError) {
      console.error("Failed to parse Claude response:", content);
      throw new ConvexError(
        `Failed to parse AI response: ${parseError instanceof Error ? parseError.message : "Unknown error"}`
      );
    }

    const processingTime = Date.now() - startTime;

    // Track usage
    const usageId = await ctx.runMutation(internal.claudeAi.recordAiUsage, {
      userId: user._id,
      provider: "claude",
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCostUsd: estimatedCost,
      requestType: "categorization",
      providerRequestId: responseData.id,
    });

    // Store suggestions in database
    const suggestionIds: Id<"aiCategorizationSuggestions">[] = [];
    let totalConfidence = 0;

    for (const suggestion of suggestions) {
      // Find the matching repository ID
      const matchingRepo = repositories.find(
        (r) => r.id === suggestion.repoId || r.name === suggestion.repoId
      );

      if (!matchingRepo) {
        console.warn(`No matching repository found for ${suggestion.repoId}`);
        continue;
      }

      const suggestionId = await ctx.runMutation(
        internal.claudeAi.createSuggestion,
        {
          userId: user._id,
          repositoryId: matchingRepo.id as Id<"repositories">,
          suggestedCategoryName: suggestion.category,
          suggestedCategoryColor: suggestion.suggestedColor,
          suggestedCategoryIcon: suggestion.suggestedIcon,
          confidence: suggestion.confidence,
          reasoning: suggestion.reasoning,
          metadata: {
            aiModel: model,
            processingTimeMs: processingTime,
            promptVersion: "1.0",
            existingCategories: categories,
            batchId,
            inputTokens,
            outputTokens,
          },
        }
      );

      suggestionIds.push(suggestionId);
      totalConfidence += suggestion.confidence;
    }

    const averageConfidence =
      suggestionIds.length > 0 ? totalConfidence / suggestionIds.length : 0;

    return {
      success: true,
      suggestionIds,
      totalSuggestions: suggestionIds.length,
      averageConfidence,
      processingTimeMs: processingTime,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCostUsd: estimatedCost,
        model,
      },
      batchId,
    };
  },
});

// Internal query to get repository by ID
export const getRepositoryById = internalQuery({
  args: { repositoryId: v.id("repositories") },
  handler: async (ctx, { repositoryId }) => {
    return await ctx.db.get(repositoryId);
  },
});

// Internal query to get user's category names
export const getUserCategoryNames = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();
    return categories.map((c) => c.name);
  },
});

// Internal mutation to record AI usage
export const recordAiUsage = internalMutation({
  args: {
    userId: v.id("users"),
    jobId: v.optional(v.id("aiProcessingJobs")),
    provider: v.union(v.literal("claude"), v.literal("openai")),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    estimatedCostUsd: v.number(),
    requestType: v.union(
      v.literal("categorization"),
      v.literal("primer_update"),
      v.literal("readme_summary")
    ),
    providerRequestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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

// Internal mutation to create a suggestion
export const createSuggestion = internalMutation({
  args: {
    userId: v.id("users"),
    repositoryId: v.id("repositories"),
    suggestedCategoryName: v.string(),
    suggestedCategoryColor: v.optional(v.string()),
    suggestedCategoryIcon: v.optional(v.string()),
    confidence: v.number(),
    reasoning: v.optional(v.string()),
    metadata: v.object({
      aiModel: v.string(),
      processingTimeMs: v.number(),
      promptVersion: v.string(),
      existingCategories: v.array(v.string()),
      batchId: v.optional(v.string()),
      inputTokens: v.optional(v.number()),
      outputTokens: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("aiCategorizationSuggestions", {
      userId: args.userId,
      repositoryId: args.repositoryId,
      suggestedCategoryName: args.suggestedCategoryName,
      suggestedCategoryColor: args.suggestedCategoryColor,
      suggestedCategoryIcon: args.suggestedCategoryIcon,
      confidence: args.confidence,
      reasoning: args.reasoning,
      status: "pending",
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Get usage statistics for a user
export const getUsageStats = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const usage = await ctx.db
      .query("aiUsage")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    const totalTokens = usage.reduce((sum, u) => sum + u.totalTokens, 0);
    const totalCost = usage.reduce((sum, u) => sum + u.estimatedCostUsd, 0);
    const requestCount = usage.length;

    // Get last 30 days usage
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentUsage = usage.filter((u) => u.createdAt >= thirtyDaysAgo);
    const recentTokens = recentUsage.reduce((sum, u) => sum + u.totalTokens, 0);
    const recentCost = recentUsage.reduce(
      (sum, u) => sum + u.estimatedCostUsd,
      0
    );

    return {
      totalTokens,
      totalCost,
      requestCount,
      recentTokens,
      recentCost,
      recentRequests: recentUsage.length,
    };
  },
});

// Action to test Claude API connection
export const testClaudeConnection = action({
  args: {
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const model = args.model || DEFAULT_MODEL;
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        message: "ANTHROPIC_API_KEY not configured in Convex environment",
      };
    }

    try {
      const response = await fetch(CLAUDE_API_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": CLAUDE_API_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: 50,
          messages: [
            {
              role: "user",
              content: "Reply with only: Connection successful",
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          message: `API error: ${response.status} - ${error}`,
        };
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || "";

      return {
        success: true,
        message: `Connected to ${model}`,
        response: content.trim(),
        usage: data.usage,
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
