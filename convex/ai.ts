import { ConvexError, v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// Default AI settings
const DEFAULT_AI_SETTINGS = {
  aiProvider: "claude" as const,
  aiModel: "claude-3-haiku-20240307",
  enableAI: false,
  includeReadme: true,
  batchSize: 10,
  confidenceThreshold: 0.6,
  autoApplyThreshold: 0.9,
  advancedSettings: {
    timeoutMs: 30000,
    maxRetries: 3,
    maxTokensPerRequest: 4096,
  },
};

// Model options by provider
export const MODEL_OPTIONS = {
  claude: [
    {
      id: "claude-3-haiku-20240307",
      name: "Claude 3 Haiku",
      description: "Fastest, most cost-effective",
    },
    {
      id: "claude-3-5-haiku-20241022",
      name: "Claude 3.5 Haiku",
      description: "Fast with improved quality",
    },
    {
      id: "claude-3-5-sonnet-20241022",
      name: "Claude 3.5 Sonnet",
      description: "Best quality, higher cost",
    },
  ],
  openai: [
    {
      id: "gpt-4o-mini",
      name: "GPT-4o Mini",
      description: "Fast and affordable",
    },
    { id: "gpt-4o", name: "GPT-4o", description: "Best quality" },
  ],
  ollama: [
    { id: "gemma:2b", name: "Gemma 2B", description: "Small, fast" },
    { id: "llama2:7b", name: "Llama 2 7B", description: "Balanced" },
    { id: "mistral:7b", name: "Mistral 7B", description: "Good quality" },
  ],
};

// Get AI settings for a user
export const getAiSettings = query({
  args: {
    clerkUserId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const clerkId = args.clerkUserId || args.userId;
    if (!clerkId) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkId))
      .first();

    if (!user) {
      return null;
    }

    const aiSettings = await ctx.db
      .query("aiSettings")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .first();

    // Return defaults if no settings exist
    if (!aiSettings) {
      return {
        ...DEFAULT_AI_SETTINGS,
        userId: user._id,
      };
    }

    return aiSettings;
  },
});

// Update AI settings
export const updateAiSettings = mutation({
  args: {
    clerkUserId: v.optional(v.string()),
    userId: v.optional(v.string()),
    aiProvider: v.optional(
      v.union(v.literal("claude"), v.literal("openai"), v.literal("ollama"))
    ),
    aiModel: v.optional(v.string()),
    enableAI: v.optional(v.boolean()),
    ollamaEndpoint: v.optional(v.string()),
    includeReadme: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
    confidenceThreshold: v.optional(v.number()),
    autoApplyThreshold: v.optional(v.number()),
    advancedSettings: v.optional(
      v.object({
        timeoutMs: v.optional(v.number()),
        maxRetries: v.optional(v.number()),
        maxTokensPerRequest: v.optional(v.number()),
        batchSize: v.optional(v.number()),
        confidenceThreshold: v.optional(v.number()),
        autoAcceptThreshold: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const clerkId = args.clerkUserId || args.userId;
    if (!clerkId) {
      throw new ConvexError("User ID is required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkId))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const existingSettings = await ctx.db
      .query("aiSettings")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .first();

    const now = Date.now();

    // Merge advanced settings properly
    type AdvancedSettings = {
      timeoutMs?: number;
      maxRetries?: number;
      maxTokensPerRequest?: number;
      batchSize?: number;
      confidenceThreshold?: number;
      autoAcceptThreshold?: number;
    };
    const existingAdvanced: AdvancedSettings = existingSettings?.advancedSettings || {};
    const newAdvanced: AdvancedSettings = args.advancedSettings || {};
    const mergedAdvanced = {
      timeoutMs:
        newAdvanced.timeoutMs ??
        existingAdvanced.timeoutMs ??
        DEFAULT_AI_SETTINGS.advancedSettings.timeoutMs,
      maxRetries:
        newAdvanced.maxRetries ??
        existingAdvanced.maxRetries ??
        DEFAULT_AI_SETTINGS.advancedSettings.maxRetries,
      maxTokensPerRequest:
        newAdvanced.maxTokensPerRequest ??
        existingAdvanced.maxTokensPerRequest ??
        DEFAULT_AI_SETTINGS.advancedSettings.maxTokensPerRequest,
    };

    if (existingSettings) {
      // Update existing settings
      await ctx.db.patch(existingSettings._id, {
        aiProvider:
          args.aiProvider ?? existingSettings.aiProvider ?? "claude",
        aiModel: args.aiModel ?? existingSettings.aiModel,
        enableAI: args.enableAI ?? existingSettings.enableAI,
        ollamaEndpoint: args.ollamaEndpoint ?? existingSettings.ollamaEndpoint,
        includeReadme: args.includeReadme ?? existingSettings.includeReadme,
        batchSize:
          args.batchSize ??
          newAdvanced.batchSize ??
          existingSettings.batchSize,
        confidenceThreshold:
          args.confidenceThreshold ??
          newAdvanced.confidenceThreshold ??
          existingSettings.confidenceThreshold,
        autoApplyThreshold:
          args.autoApplyThreshold ??
          newAdvanced.autoAcceptThreshold ??
          existingSettings.autoApplyThreshold,
        advancedSettings: mergedAdvanced,
        updatedAt: now,
      });
      return existingSettings._id;
    } else {
      // Create new settings
      return await ctx.db.insert("aiSettings", {
        userId: user._id,
        aiProvider: args.aiProvider ?? DEFAULT_AI_SETTINGS.aiProvider,
        aiModel: args.aiModel ?? DEFAULT_AI_SETTINGS.aiModel,
        enableAI: args.enableAI ?? DEFAULT_AI_SETTINGS.enableAI,
        ollamaEndpoint: args.ollamaEndpoint,
        includeReadme: args.includeReadme ?? DEFAULT_AI_SETTINGS.includeReadme,
        batchSize:
          args.batchSize ??
          newAdvanced.batchSize ??
          DEFAULT_AI_SETTINGS.batchSize,
        confidenceThreshold:
          args.confidenceThreshold ??
          newAdvanced.confidenceThreshold ??
          DEFAULT_AI_SETTINGS.confidenceThreshold,
        autoApplyThreshold:
          args.autoApplyThreshold ??
          newAdvanced.autoAcceptThreshold ??
          DEFAULT_AI_SETTINGS.autoApplyThreshold,
        advancedSettings: mergedAdvanced,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// Test Ollama connection
export const testOllamaConnection = mutation({
  args: {
    endpoint: v.string(),
    model: v.string(),
    timeoutMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // This is a mutation that returns info for the client to test
    // The actual test happens client-side since Convex mutations can't make HTTP calls
    // Return the config for client-side testing
    return {
      success: true,
      message: "Use the action version for actual connection testing",
      config: {
        endpoint: args.endpoint,
        model: args.model,
        timeoutMs: args.timeoutMs || 10000,
      },
    };
  },
});

// Test Ollama connection (action version that can make HTTP calls)
export const testOllamaConnectionAction = action({
  args: {
    endpoint: v.string(),
    model: v.string(),
    timeoutMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const timeout = args.timeoutMs || 10000;

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${args.endpoint}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: args.model,
          prompt: "Say 'Hello' in one word.",
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          message: `Ollama returned status ${response.status}`,
        };
      }

      const data = await response.json();
      return {
        success: true,
        message: `Connected to ${args.model}`,
        response: data.response?.trim() || "No response",
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return {
          success: false,
          message: "Connection timed out",
        };
      }
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

// Get AI-generated suggestions for a user
export const getUserSuggestions = query({
  args: {
    clerkUserId: v.string(),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("rejected"),
        v.literal("applied"),
        v.literal("auto_applied")
      )
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (!user) {
      return [];
    }

    if (args.status) {
      return await ctx.db
        .query("aiCategorizationSuggestions")
        .withIndex("by_user_and_status", (q) =>
          q.eq("userId", user._id).eq("status", args.status!)
        )
        .collect();
    } else {
      return await ctx.db
        .query("aiCategorizationSuggestions")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .collect();
    }
  },
});

// Get suggestions with repository details
export const getSuggestionsWithDetails = query({
  args: {
    clerkUserId: v.string(),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("rejected"),
        v.literal("applied")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (!user) {
      return [];
    }

    let suggestions;
    if (args.status) {
      suggestions = await ctx.db
        .query("aiCategorizationSuggestions")
        .withIndex("by_user_and_status", (q) =>
          q.eq("userId", user._id).eq("status", args.status!)
        )
        .order("desc")
        .take(args.limit || 100);
    } else {
      suggestions = await ctx.db
        .query("aiCategorizationSuggestions")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(args.limit || 100);
    }

    // Enrich with repository details
    const enriched = await Promise.all(
      suggestions.map(async (suggestion) => {
        const repository = await ctx.db.get(suggestion.repositoryId);
        return {
          ...suggestion,
          repository: repository
            ? {
                name: repository.name,
                fullName: repository.fullName,
                description: repository.description,
                language: repository.language,
                stargazersCount: repository.stargazersCount,
              }
            : null,
        };
      })
    );

    return enriched;
  },
});

// Request a categorization job
export const requestCategorizationJob = mutation({
  args: {
    clerkUserId: v.string(),
    repositoryIds: v.optional(v.array(v.id("repositories"))),
    categorizeAll: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    // Get AI settings
    const settings = await ctx.db
      .query("aiSettings")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .first();

    if (!settings?.enableAI) {
      throw new ConvexError("AI features are not enabled");
    }

    // Determine which repositories to categorize
    let repoIds = args.repositoryIds || [];

    if (args.categorizeAll || repoIds.length === 0) {
      // Get uncategorized repositories
      const allRepos = await ctx.db
        .query("repositories")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .collect();

      const categorizedRepoIds = new Set(
        (
          await ctx.db
            .query("repositoryCategories")
            .withIndex("by_user_id", (q) => q.eq("userId", user._id))
            .collect()
        ).map((rc) => rc.repositoryId)
      );

      repoIds = allRepos
        .filter((repo) => !categorizedRepoIds.has(repo._id))
        .map((repo) => repo._id);
    }

    if (repoIds.length === 0) {
      throw new ConvexError("No repositories to categorize");
    }

    // Create a job record
    const batchId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const jobId = await ctx.db.insert("aiProcessingJobs", {
      userId: user._id,
      jobType: repoIds.length === 1 ? "single_categorize" : "batch_categorize",
      status: "pending",
      repositoryIds: repoIds,
      batchId,
      progress: {
        processed: 0,
        total: repoIds.length,
      },
      startedAt: Date.now(),
    });

    return {
      jobId,
      batchId,
      repositoryCount: repoIds.length,
    };
  },
});

// Get job status
export const getJobStatus = query({
  args: {
    jobId: v.id("aiProcessingJobs"),
  },
  handler: async (ctx, { jobId }) => {
    return await ctx.db.get(jobId);
  },
});

// Get active jobs for a user
export const getActiveJobs = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (!user) {
      return [];
    }

    const pendingJobs = await ctx.db
      .query("aiProcessingJobs")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", user._id).eq("status", "pending")
      )
      .collect();

    const processingJobs = await ctx.db
      .query("aiProcessingJobs")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", user._id).eq("status", "processing")
      )
      .collect();

    return [...pendingJobs, ...processingJobs];
  },
});

// Process next batch (action that routes to appropriate AI provider)
export const processNextBatch = action({
  args: {
    clerkUserId: v.string(),
    jobId: v.id("aiProcessingJobs"),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    complete?: boolean;
    message?: string;
    result?: any;
    progress?: { processed: number; total: number };
  }> => {
    // Get job details
    const job = await ctx.runQuery(internal.ai.getJobById, {
      jobId: args.jobId,
    });

    if (!job) {
      throw new ConvexError("Job not found");
    }

    if (job.status !== "pending" && job.status !== "processing") {
      return { success: false, message: "Job is not active" };
    }

    // Get user and settings
    const user = await ctx.runQuery(internal.users.getUserByClerkId, {
      clerkUserId: args.clerkUserId,
    });

    if (!user) {
      throw new ConvexError("User not found");
    }

    const settings = await ctx.runQuery(internal.ai.getSettingsByUserId, {
      userId: user._id,
    });

    // Mark job as processing
    await ctx.runMutation(internal.ai.updateJobStatus, {
      jobId: args.jobId,
      status: "processing",
    });

    const provider = settings?.aiProvider || "claude";
    const batchSize = settings?.batchSize || 10;
    const repoIds = job.repositoryIds || [];
    const processed = job.progress?.processed || 0;

    // Get next batch of repositories
    const batchRepoIds = repoIds.slice(processed, processed + batchSize);

    if (batchRepoIds.length === 0) {
      // Job complete
      await ctx.runMutation(internal.ai.completeJob, {
        jobId: args.jobId,
      });
      return { success: true, complete: true };
    }

    try {
      let result;

      if (provider === "claude") {
        // Use Claude AI
        result = await ctx.runAction(api.claudeAi.categorizeRepositories, {
          clerkUserId: args.clerkUserId,
          repositoryIds: batchRepoIds,
          model: settings?.aiModel || "claude-3-haiku-20240307",
          includeReadme: settings?.includeReadme ?? true,
          batchId: job.batchId,
        });
      } else if (provider === "ollama") {
        // Use Ollama (local)
        result = await ctx.runAction(api.ai.categorizeWithOllama, {
          clerkUserId: args.clerkUserId,
          repositoryIds: batchRepoIds,
          model: settings?.aiModel || "gemma:2b",
          endpoint: settings?.ollamaEndpoint || "http://localhost:11434",
        });
      } else {
        throw new ConvexError(`Unsupported AI provider: ${provider}`);
      }

      // Update job progress
      await ctx.runMutation(internal.ai.updateJobProgress, {
        jobId: args.jobId,
        processed: processed + batchRepoIds.length,
        suggestionIds: result.suggestionIds,
      });

      // Check if job is complete
      if (processed + batchRepoIds.length >= repoIds.length) {
        await ctx.runMutation(internal.ai.completeJob, {
          jobId: args.jobId,
          result: {
            suggestionIds: result.suggestionIds,
            totalSuggestions: result.totalSuggestions,
            averageConfidence: result.averageConfidence,
            processingTimeMs: result.processingTimeMs,
          },
        });
        return { success: true, complete: true, result };
      }

      return {
        success: true,
        complete: false,
        progress: {
          processed: processed + batchRepoIds.length,
          total: repoIds.length,
        },
      };
    } catch (error) {
      // Mark job as failed
      await ctx.runMutation(internal.ai.failJob, {
        jobId: args.jobId,
        errorMessage:
          error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  },
});

// Categorize with Ollama (fallback)
export const categorizeWithOllama = action({
  args: {
    clerkUserId: v.string(),
    repositoryIds: v.array(v.id("repositories")),
    model: v.string(),
    endpoint: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getUserByClerkId, {
      clerkUserId: args.clerkUserId,
    });

    if (!user) {
      throw new ConvexError("User not found");
    }

    // Get repositories
    const repositories = [];
    for (const repoId of args.repositoryIds) {
      const repo = await ctx.runQuery(internal.claudeAi.getRepositoryById, {
        repositoryId: repoId,
      });
      if (repo) {
        repositories.push(repo);
      }
    }

    // Get existing categories
    const categories = await ctx.runQuery(
      internal.claudeAi.getUserCategoryNames,
      { userId: user._id }
    );

    // Build prompt for Ollama
    const prompt = `Categorize these GitHub repositories. Existing categories: ${categories.join(", ") || "none"}.

Repositories:
${repositories.map((r) => `- ${r.name}: ${r.description || "No description"} (${r.language || "Unknown language"})`).join("\n")}

Respond with JSON array: [{"repoId": "...", "category": "...", "confidence": 0.8, "reasoning": "..."}]`;

    try {
      const response = await fetch(`${args.endpoint}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: args.model,
          prompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.response || "";

      // Try to parse JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("No valid JSON in Ollama response");
      }

      const suggestions = JSON.parse(jsonMatch[0]);
      const suggestionIds: Id<"aiCategorizationSuggestions">[] = [];
      let totalConfidence = 0;

      for (const suggestion of suggestions) {
        const matchingRepo = repositories.find(
          (r) => r.name === suggestion.repoId || r._id === suggestion.repoId
        );

        if (!matchingRepo) continue;

        const suggestionId = await ctx.runMutation(
          internal.claudeAi.createSuggestion,
          {
            userId: user._id,
            repositoryId: matchingRepo._id,
            suggestedCategoryName: suggestion.category || "Uncategorized",
            confidence: suggestion.confidence || 0.5,
            reasoning: suggestion.reasoning,
            metadata: {
              aiModel: args.model,
              processingTimeMs: 0,
              promptVersion: "ollama-1.0",
              existingCategories: categories,
            },
          }
        );

        suggestionIds.push(suggestionId);
        totalConfidence += suggestion.confidence || 0.5;
      }

      return {
        success: true,
        suggestionIds,
        totalSuggestions: suggestionIds.length,
        averageConfidence:
          suggestionIds.length > 0
            ? totalConfidence / suggestionIds.length
            : 0,
        processingTimeMs: 0,
      };
    } catch (error) {
      throw new ConvexError(
        `Ollama categorization failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  },
});

// Internal queries and mutations for job management
export const getJobById = internalQuery({
  args: { jobId: v.id("aiProcessingJobs") },
  handler: async (ctx, { jobId }) => {
    return await ctx.db.get(jobId);
  },
});

export const getSettingsByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("aiSettings")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .first();
  },
});

export const updateJobStatus = internalMutation({
  args: {
    jobId: v.id("aiProcessingJobs"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, { jobId, status }) => {
    await ctx.db.patch(jobId, { status });
  },
});

export const updateJobProgress = internalMutation({
  args: {
    jobId: v.id("aiProcessingJobs"),
    processed: v.number(),
    suggestionIds: v.optional(v.array(v.id("aiCategorizationSuggestions"))),
  },
  handler: async (ctx, { jobId, processed, suggestionIds }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;

    const existingSuggestionIds = job.result?.suggestionIds || [];
    const allSuggestionIds = [
      ...existingSuggestionIds,
      ...(suggestionIds || []),
    ];

    await ctx.db.patch(jobId, {
      progress: {
        processed,
        total: job.progress?.total || 0,
        currentRepository: job.progress?.currentRepository,
      },
      result: {
        suggestionIds: allSuggestionIds,
        totalSuggestions: allSuggestionIds.length,
        averageConfidence: job.result?.averageConfidence || 0,
        processingTimeMs: job.result?.processingTimeMs || 0,
      },
    });
  },
});

export const completeJob = internalMutation({
  args: {
    jobId: v.id("aiProcessingJobs"),
    result: v.optional(
      v.object({
        suggestionIds: v.array(v.id("aiCategorizationSuggestions")),
        totalSuggestions: v.number(),
        averageConfidence: v.number(),
        processingTimeMs: v.number(),
      })
    ),
  },
  handler: async (ctx, { jobId, result }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;

    await ctx.db.patch(jobId, {
      status: "completed",
      completedAt: Date.now(),
      result: result || job.result,
    });
  },
});

export const failJob = internalMutation({
  args: {
    jobId: v.id("aiProcessingJobs"),
    errorMessage: v.string(),
  },
  handler: async (ctx, { jobId, errorMessage }) => {
    await ctx.db.patch(jobId, {
      status: "failed",
      errorMessage,
      completedAt: Date.now(),
    });
  },
});

// Apply a suggestion (accept it and create the category assignment)
export const applySuggestion = mutation({
  args: {
    clerkUserId: v.string(),
    suggestionId: v.id("aiCategorizationSuggestions"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const suggestion = await ctx.db.get(args.suggestionId);
    if (!suggestion || suggestion.userId !== user._id) {
      throw new ConvexError("Suggestion not found");
    }

    if (suggestion.status !== "pending") {
      throw new ConvexError("Suggestion already processed");
    }

    // Find or create the category
    let category = await ctx.db
      .query("categories")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .filter((q) =>
        q.eq(q.field("name"), suggestion.suggestedCategoryName)
      )
      .first();

    if (!category) {
      // Create new category
      const existingCategories = await ctx.db
        .query("categories")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .collect();

      const maxSortOrder = Math.max(
        ...existingCategories.map((c) => c.sortOrder),
        0
      );

      const categoryId = await ctx.db.insert("categories", {
        userId: user._id,
        name: suggestion.suggestedCategoryName,
        color: suggestion.suggestedCategoryColor || "#6366f1",
        icon: suggestion.suggestedCategoryIcon,
        sortOrder: maxSortOrder + 1,
        metadata: { repositoryCount: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      category = await ctx.db.get(categoryId);
    }

    if (!category) {
      throw new ConvexError("Failed to create category");
    }

    // Check if repository is already in this category
    const existing = await ctx.db
      .query("repositoryCategories")
      .withIndex("by_category_and_repository", (q) =>
        q.eq("categoryId", category!._id).eq("repositoryId", suggestion.repositoryId)
      )
      .first();

    if (!existing) {
      // Add repository to category
      await ctx.db.insert("repositoryCategories", {
        userId: user._id,
        repositoryId: suggestion.repositoryId,
        categoryId: category._id,
        addedAt: Date.now(),
      });

      // Update category count
      await ctx.db.patch(category._id, {
        metadata: {
          ...category.metadata,
          repositoryCount: (category.metadata?.repositoryCount || 0) + 1,
          lastUsedAt: Date.now(),
        },
        updatedAt: Date.now(),
      });
    }

    // Mark suggestion as applied
    await ctx.db.patch(args.suggestionId, {
      status: "applied",
      updatedAt: Date.now(),
    });

    return { success: true, categoryId: category._id };
  },
});

// Reject a suggestion
export const rejectSuggestion = mutation({
  args: {
    clerkUserId: v.string(),
    suggestionId: v.id("aiCategorizationSuggestions"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const suggestion = await ctx.db.get(args.suggestionId);
    if (!suggestion || suggestion.userId !== user._id) {
      throw new ConvexError("Suggestion not found");
    }

    await ctx.db.patch(args.suggestionId, {
      status: "rejected",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Get usage statistics
export const getUsageStats = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (!user) {
      return null;
    }

    const usage = await ctx.db
      .query("aiUsage")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
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
      totalCost: Math.round(totalCost * 10000) / 10000, // Round to 4 decimal places
      requestCount,
      recentTokens,
      recentCost: Math.round(recentCost * 10000) / 10000,
      recentRequests: recentUsage.length,
    };
  },
});
