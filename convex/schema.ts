import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkUserId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    // GitHub OAuth fields (replaces manual PAT)
    githubExternalAccountId: v.optional(v.string()), // Clerk external account ID
    githubAccessToken: v.optional(v.string()), // OAuth access token from Clerk
    githubTokenExpiresAt: v.optional(v.number()), // Token expiry timestamp
    githubTokenLastFetchedAt: v.optional(v.number()), // When we last fetched from Clerk
    githubScopes: v.optional(v.array(v.string())), // Granted OAuth scopes
    githubUsername: v.optional(v.string()),
    githubEmail: v.optional(v.string()),
    // Legacy field - kept for migration, will be removed
    githubToken: v.optional(v.string()),
    preferences: v.optional(v.object({
      theme: v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
      defaultSort: v.union(
        v.literal("created"),
        v.literal("updated"),
        v.literal("stars"),
        v.literal("name")
      ),
      enableHaptics: v.boolean(),
      syncFrequency: v.union(
        v.literal("manual"),
        v.literal("hourly"),
        v.literal("daily")
      ),
    })),
    lastSyncAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_user_id", ["clerkUserId"])
    .index("by_email", ["email"])
    .index("by_github_external_account", ["githubExternalAccountId"]),

  categories: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.string(),
    icon: v.optional(v.string()),
    parentCategoryId: v.optional(v.id("categories")),
    sortOrder: v.number(),
    isDefault: v.optional(v.boolean()),
    metadata: v.optional(v.object({
      repositoryCount: v.number(),
      lastUsedAt: v.optional(v.number()),
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_and_parent", ["userId", "parentCategoryId"])
    .index("by_user_and_sort", ["userId", "sortOrder"]),

  repositories: defineTable({
    userId: v.id("users"),
    githubId: v.number(),
    name: v.string(),
    fullName: v.string(),
    description: v.optional(v.string()),
    url: v.string(),
    htmlUrl: v.string(),
    language: v.optional(v.string()),
    stargazersCount: v.number(),
    forksCount: v.number(),
    size: v.number(),
    defaultBranch: v.string(),
    topics: v.array(v.string()),
    isPrivate: v.boolean(),
    isFork: v.boolean(),
    hasIssues: v.boolean(),
    hasWiki: v.boolean(),
    archived: v.boolean(),
    disabled: v.boolean(),
    pushedAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
    starredAt: v.string(),
    owner: v.object({
      login: v.string(),
      id: v.number(),
      avatarUrl: v.string(),
      type: v.string(),
    }),
    license: v.optional(v.object({
      key: v.string(),
      name: v.string(),
      url: v.optional(v.string()),
    })),
    // Local metadata
    lastAccessedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    localTags: v.array(v.string()),
    syncedAt: v.number(),
    // Search & AI enhancement fields
    searchText: v.optional(v.string()), // Concatenated searchable text
    readmeExcerpt: v.optional(v.string()), // Truncated README for AI
    readmeSha: v.optional(v.string()), // For caching README
    readmeFetchedAt: v.optional(v.number()),
  })
    .index("by_user_id", ["userId"])
    .index("by_github_id", ["githubId"])
    .index("by_user_and_github_id", ["userId", "githubId"])
    .index("by_user_and_language", ["userId", "language"])
    .index("by_user_and_starred_at", ["userId", "starredAt"])
    .index("by_user_and_stars", ["userId", "stargazersCount"])
    .index("by_user_and_updated", ["userId", "updatedAt"])
    .index("by_user_and_archived", ["userId", "archived"])
    .index("by_user_and_fork", ["userId", "isFork"])
    .searchIndex("search_repositories", {
      searchField: "searchText",
      filterFields: ["userId", "language", "archived", "isFork"],
    }),

  repositoryCategories: defineTable({
    userId: v.id("users"),
    repositoryId: v.id("repositories"),
    categoryId: v.id("categories"),
    addedAt: v.number(),
    sortOrder: v.optional(v.number()),
  })
    .index("by_user_id", ["userId"])
    .index("by_repository_id", ["repositoryId"])
    .index("by_category_id", ["categoryId"])
    .index("by_user_and_category", ["userId", "categoryId"])
    .index("by_user_and_repository", ["userId", "repositoryId"])
    .index("by_category_and_repository", ["categoryId", "repositoryId"]),

  syncHistory: defineTable({
    userId: v.id("users"),
    syncType: v.union(
      v.literal("full"),
      v.literal("incremental"),
      v.literal("manual")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    repositoriesProcessed: v.number(),
    repositoriesAdded: v.number(),
    repositoriesUpdated: v.number(),
    repositoriesRemoved: v.number(),
    errorMessage: v.optional(v.string()),
    metadata: v.optional(v.object({
      rateLimitRemaining: v.optional(v.number()),
      rateLimitReset: v.optional(v.number()),
      totalApiCalls: v.optional(v.number()),
    })),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_started_at", ["startedAt"]),

  searchHistory: defineTable({
    userId: v.id("users"),
    query: v.string(),
    filters: v.optional(v.object({
      language: v.optional(v.string()),
      categoryId: v.optional(v.id("categories")),
      minStars: v.optional(v.number()),
      maxStars: v.optional(v.number()),
      topics: v.optional(v.array(v.string())),
      isFork: v.optional(v.boolean()),
      archived: v.optional(v.boolean()),
    })),
    sort: v.optional(v.object({
      field: v.union(
        v.literal("stargazersCount"),
        v.literal("starredAt"),
        v.literal("updatedAt"),
        v.literal("name")
      ),
      order: v.union(v.literal("asc"), v.literal("desc")),
    })),
    resultCount: v.number(),
    searchedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_and_searched_at", ["userId", "searchedAt"]),

  // Saved filters / smart collections
  savedFilters: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    query: v.optional(v.string()),
    filters: v.object({
      language: v.optional(v.string()),
      categoryId: v.optional(v.id("categories")),
      minStars: v.optional(v.number()),
      maxStars: v.optional(v.number()),
      topics: v.optional(v.array(v.string())),
      isFork: v.optional(v.boolean()),
      archived: v.optional(v.boolean()),
    }),
    sort: v.optional(v.object({
      field: v.union(
        v.literal("stargazersCount"),
        v.literal("starredAt"),
        v.literal("updatedAt"),
        v.literal("name")
      ),
      order: v.union(v.literal("asc"), v.literal("desc")),
    })),
    isPinned: v.boolean(),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_and_pinned", ["userId", "isPinned"])
    .index("by_user_and_last_used", ["userId", "lastUsedAt"]),

  // User-created lists for sharing
  lists: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    visibility: v.union(v.literal("private"), v.literal("public")),
    shareId: v.optional(v.string()), // Unique ID for public sharing
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    repositoryCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_id", ["ownerId"])
    .index("by_share_id", ["shareId"])
    .index("by_owner_and_visibility", ["ownerId", "visibility"]),

  // Many-to-many: list <-> repository
  listRepositories: defineTable({
    listId: v.id("lists"),
    repositoryId: v.id("repositories"),
    addedAt: v.number(),
    addedBy: v.id("users"),
    sortOrder: v.optional(v.number()),
    notes: v.optional(v.string()), // Optional notes about why in this list
  })
    .index("by_list_id", ["listId"])
    .index("by_repository_id", ["repositoryId"])
    .index("by_list_and_repository", ["listId", "repositoryId"])
    .index("by_list_and_sort", ["listId", "sortOrder"]),

  // AI Categorization Tables
  aiCategorizationSuggestions: defineTable({
    userId: v.id("users"),
    repositoryId: v.id("repositories"),
    suggestedCategoryName: v.string(),
    suggestedCategoryColor: v.optional(v.string()),
    suggestedCategoryIcon: v.optional(v.string()),
    confidence: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("applied"),
      v.literal("auto_applied")
    ),
    reasoning: v.optional(v.string()),
    // Enhanced metadata for cloud AI
    metadata: v.optional(v.object({
      aiModel: v.string(),
      processingTimeMs: v.number(),
      promptVersion: v.string(),
      existingCategories: v.array(v.string()),
      batchId: v.optional(v.string()),
      inputTokens: v.optional(v.number()),
      outputTokens: v.optional(v.number()),
    })),
    autoAppliedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_repository_id", ["repositoryId"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_user_and_created_at", ["userId", "createdAt"]),

  categorizationHistory: defineTable({
    userId: v.id("users"),
    action: v.union(
      v.literal("ai_batch_categorize"),
      v.literal("ai_single_categorize"),
      v.literal("manual_categorize"),
      v.literal("undo"),
      v.literal("redo")
    ),
    repositoryIds: v.array(v.id("repositories")),
    beforeState: v.optional(v.object({
      repositoryCategories: v.array(v.object({
        repositoryId: v.id("repositories"),
        categoryIds: v.array(v.id("categories")),
      })),
    })),
    afterState: v.optional(v.object({
      repositoryCategories: v.array(v.object({
        repositoryId: v.id("repositories"),
        categoryIds: v.array(v.id("categories")),
      })),
    })),
    aiGenerated: v.boolean(),
    aiSuggestionIds: v.optional(v.array(v.id("aiCategorizationSuggestions"))),
    metadata: v.optional(v.object({
      totalRepositories: v.number(),
      totalSuggestions: v.number(),
      acceptedSuggestions: v.number(),
      rejectedSuggestions: v.number(),
      processingTimeMs: v.number(),
    })),
    createdAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_and_ai_generated", ["userId", "aiGenerated"])
    .index("by_user_and_created_at", ["userId", "createdAt"]),

  // Updated AI settings for cloud AI
  aiSettings: defineTable({
    userId: v.id("users"),
    // Provider settings
    aiProvider: v.union(v.literal("claude"), v.literal("openai"), v.literal("ollama")),
    aiModel: v.string(), // e.g., "claude-3-haiku-20240307", "gpt-4o-mini"
    enableAI: v.boolean(),
    // Ollama-specific (legacy, optional)
    ollamaEndpoint: v.optional(v.string()),
    // Processing settings
    includeReadme: v.boolean(),
    batchSize: v.number(),
    confidenceThreshold: v.number(),
    autoApplyThreshold: v.number(),
    // Category primer
    categoryPrimer: v.optional(v.object({
      enabled: v.boolean(),
      categories: v.array(v.object({
        name: v.string(),
        description: v.string(),
        examples: v.array(v.string()),
      })),
      lastUpdated: v.number(),
    })),
    // Advanced settings
    advancedSettings: v.optional(v.object({
      timeoutMs: v.number(),
      maxRetries: v.number(),
      maxTokensPerRequest: v.number(),
    })),
    lastSyncAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user_id", ["userId"]),

  aiProcessingJobs: defineTable({
    userId: v.id("users"),
    jobType: v.union(
      v.literal("single_categorize"),
      v.literal("batch_categorize"),
      v.literal("update_primer"),
      v.literal("fetch_readmes")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    repositoryIds: v.optional(v.array(v.id("repositories"))),
    batchId: v.optional(v.string()),
    progress: v.optional(v.object({
      processed: v.number(),
      total: v.number(),
      currentRepository: v.optional(v.string()),
    })),
    result: v.optional(v.object({
      suggestionIds: v.array(v.id("aiCategorizationSuggestions")),
      totalSuggestions: v.number(),
      averageConfidence: v.number(),
      processingTimeMs: v.number(),
    })),
    errorMessage: v.optional(v.string()),
    usageId: v.optional(v.id("aiUsage")),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_started_at", ["startedAt"])
    .index("by_batch_id", ["batchId"]),

  // AI usage tracking for cost monitoring
  aiUsage: defineTable({
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
    createdAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_and_created_at", ["userId", "createdAt"])
    .index("by_job_id", ["jobId"]),
});
