import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getUserByClerkIdHelper as getUserByClerkId } from "./users";
import { buildSearchText } from "./search";

// Get a single repository by its GitHub ID (internal)
export const getRepositoryByGitHubId = internalQuery({
  args: {
    userId: v.id("users"),
    githubId: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("repositories")
      .withIndex("by_user_and_github_id", (q) =>
        q.eq("userId", args.userId).eq("githubId", args.githubId)
      )
      .first();
  },
});

// Get a single repository by ID
export const getRepository = query({
  args: {
    userId: v.id("users"),
    repositoryId: v.id("repositories"),
  },
  handler: async (ctx, args) => {
    const repository = await ctx.db.get(args.repositoryId);
    
    if (!repository || repository.userId !== args.userId) {
      return null;
    }
    
    return repository;
  },
});

// Get user's repositories with optional filtering and sorting
export const getUserRepositories = query({
  args: {
    clerkUserId: v.string(),
    filters: v.optional(v.object({
      language: v.optional(v.string()),
      categoryId: v.optional(v.id("categories")),
      minStars: v.optional(v.number()),
      maxStars: v.optional(v.number()),
      topics: v.optional(v.array(v.string())),
      search: v.optional(v.string()),
    })),
    sort: v.optional(v.union(
      v.literal("created"),
      v.literal("updated"),
      v.literal("stars"),
      v.literal("name"),
      v.literal("starred_at")
    )),
    direction: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
      
    if (!user) {
      // Return empty array instead of throwing error
      // This allows the app to work gracefully while UserInitializer creates the user
      return [];
    }

    let repositories = await ctx.db
      .query("repositories")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    // Apply filters
    if (args.filters) {
      const { language, categoryId, minStars, maxStars, topics, search } = args.filters;

      if (language) {
        repositories = repositories.filter(repo => repo.language === language);
      }

      if (minStars !== undefined) {
        repositories = repositories.filter(repo => repo.stargazersCount >= minStars);
      }

      if (maxStars !== undefined) {
        repositories = repositories.filter(repo => repo.stargazersCount <= maxStars);
      }

      if (topics && topics.length > 0) {
        repositories = repositories.filter(repo => 
          topics.some(topic => repo.topics.includes(topic))
        );
      }

      if (search) {
        const searchLower = search.toLowerCase();
        repositories = repositories.filter(repo => 
          repo.name.toLowerCase().includes(searchLower) ||
          repo.description?.toLowerCase().includes(searchLower) ||
          repo.fullName.toLowerCase().includes(searchLower)
        );
      }

      if (categoryId) {
        const repoCategories = await ctx.db
          .query("repositoryCategories")
          .withIndex("by_category_id", (q) => q.eq("categoryId", categoryId))
          .collect();
        
        const repoIds = new Set(repoCategories.map(rc => rc.repositoryId));
        repositories = repositories.filter(repo => repoIds.has(repo._id));
      }
    }

    // Apply sorting
    const sortField = args.sort || "starred_at";
    const direction = args.direction || "desc";
    
    repositories.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortField) {
        case "created":
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        case "updated":
          aVal = new Date(a.updatedAt).getTime();
          bVal = new Date(b.updatedAt).getTime();
          break;
        case "stars":
          aVal = a.stargazersCount;
          bVal = b.stargazersCount;
          break;
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "starred_at":
        default:
          aVal = new Date(a.starredAt).getTime();
          bVal = new Date(b.starredAt).getTime();
          break;
      }
      
      if (direction === "asc") {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    // Apply limit
    if (args.limit) {
      repositories = repositories.slice(0, args.limit);
    }

    // Enrich with category information
    const enrichedRepos = await Promise.all(
      repositories.map(async (repo) => {
        const repoCategories = await ctx.db
          .query("repositoryCategories")
          .withIndex("by_repository_id", (q) => q.eq("repositoryId", repo._id))
          .collect();
        
        const categories = await Promise.all(
          repoCategories.map(async (rc) => {
            const category = await ctx.db.get(rc.categoryId);
            return category;
          })
        );
        
        return {
          ...repo,
          categories: categories.filter(Boolean),
        };
      })
    );

    return enrichedRepos;
  },
});

// Add or update repositories (for sync)
export const upsertRepositories = internalMutation({
  args: {
    userId: v.id("users"),
    repositories: v.array(v.object({
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
    })),
  },
  handler: async (ctx, { userId, repositories }) => {
    const now = Date.now();
    let added = 0;
    let updated = 0;

    for (const repoData of repositories) {
      const existing = await ctx.db
        .query("repositories")
        .withIndex("by_user_and_github_id", (q) => 
          q.eq("userId", userId).eq("githubId", repoData.githubId)
        )
        .first();

      // Build searchText for full-text search
      const searchText = buildSearchText({
        name: repoData.name,
        fullName: repoData.fullName,
        description: repoData.description,
        topics: repoData.topics,
        owner: repoData.owner,
      });

      if (existing) {
        // Update existing repository
        await ctx.db.patch(existing._id, {
          ...repoData,
          searchText,
          notes: existing.notes, // Preserve user notes
          localTags: existing.localTags, // Preserve local tags
          lastAccessedAt: existing.lastAccessedAt,
          syncedAt: now,
        });
        updated++;
      } else {
        // Insert new repository
        await ctx.db.insert("repositories", {
          userId,
          ...repoData,
          searchText,
          notes: undefined,
          localTags: [],
          syncedAt: now,
        });
        added++;
      }
    }

    return { added, updated };
  },
});

// Add repository to category
export const addRepositoryToCategory = mutation({
  args: {
    clerkUserId: v.string(),
    repositoryId: v.id("repositories"),
    categoryId: v.id("categories"),
  },
  handler: async (ctx, args) => {
    const user = await getUserByClerkId(ctx, args.clerkUserId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    // Verify repository and category belong to user
    const repository = await ctx.db.get(args.repositoryId);
    const category = await ctx.db.get(args.categoryId);
    
    if (!repository || repository.userId !== user._id) {
      throw new ConvexError("Repository not found");
    }
    
    if (!category || category.userId !== user._id) {
      throw new ConvexError("Category not found");
    }

    // Check if already exists
    const existing = await ctx.db
      .query("repositoryCategories")
      .withIndex("by_user_and_repository", (q) => 
        q.eq("userId", user._id).eq("repositoryId", args.repositoryId)
      )
      .filter((q) => q.eq(q.field("categoryId"), args.categoryId))
      .first();

    if (existing) {
      throw new ConvexError("Repository already in this category");
    }

    // Get sort order for category
    const categoryRepos = await ctx.db
      .query("repositoryCategories")
      .withIndex("by_category_id", (q) => q.eq("categoryId", args.categoryId))
      .collect();
    
    const maxSortOrder = Math.max(...categoryRepos.map(cr => cr.sortOrder || 0), 0);

    await ctx.db.insert("repositoryCategories", {
      userId: user._id,
      repositoryId: args.repositoryId,
      categoryId: args.categoryId,
      sortOrder: maxSortOrder + 1,
      addedAt: Date.now(),
    });

    // Update category repository count
    const newCount = categoryRepos.length + 1;
    await ctx.db.patch(args.categoryId, {
      metadata: {
        ...category.metadata,
        repositoryCount: newCount,
        lastUsedAt: Date.now(),
      },
      updatedAt: Date.now(),
    });
  },
});

// Remove repository from category
export const removeRepositoryFromCategory = mutation({
  args: {
    clerkUserId: v.string(),
    repositoryId: v.id("repositories"),
    categoryId: v.id("categories"),
  },
  handler: async (ctx, args) => {
    const user = await getUserByClerkId(ctx, args.clerkUserId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    const repoCategory = await ctx.db
      .query("repositoryCategories")
      .withIndex("by_user_and_repository", (q) => 
        q.eq("userId", user._id).eq("repositoryId", args.repositoryId)
      )
      .filter((q) => q.eq(q.field("categoryId"), args.categoryId))
      .first();

    if (!repoCategory) {
      throw new ConvexError("Repository not in this category");
    }

    await ctx.db.delete(repoCategory._id);

    // Update category repository count
    const category = await ctx.db.get(args.categoryId);
    if (category) {
      const remainingRepos = await ctx.db
        .query("repositoryCategories")
        .withIndex("by_category_id", (q) => q.eq("categoryId", args.categoryId))
        .collect();

      await ctx.db.patch(args.categoryId, {
        metadata: {
          ...category.metadata,
          repositoryCount: remainingRepos.length,
        },
        updatedAt: Date.now(),
      });
    }
  },
});

// Update repository notes and tags
export const updateRepositoryMetadata = mutation({
  args: {
    clerkUserId: v.string(),
    repositoryId: v.id("repositories"),
    notes: v.optional(v.string()),
    localTags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await getUserByClerkId(ctx, args.clerkUserId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    const repository = await ctx.db.get(args.repositoryId);
    if (!repository || repository.userId !== user._id) {
      throw new ConvexError("Repository not found");
    }

    const updateData: any = {
      lastAccessedAt: Date.now(),
    };

    if (args.notes !== undefined) updateData.notes = args.notes;
    if (args.localTags !== undefined) updateData.localTags = args.localTags;

    await ctx.db.patch(args.repositoryId, updateData);
  },
});

// Get repository statistics
export const getRepositoryStats = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .first();
      
    if (!user) {
      // Return default stats instead of throwing error
      // This allows the app to work gracefully while UserInitializer creates the user
      return {
        totalCount: 0,
        totalStars: 0,
        totalForks: 0,
        averageStars: 0,
        topLanguages: [],
        topTopics: [],
        lastSyncAt: undefined,
      };
    }

    const repositories = await ctx.db
      .query("repositories")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    const totalCount = repositories.length;
    const languageStats = new Map<string, number>();
    const topicStats = new Map<string, number>();
    let totalStars = 0;
    let totalForks = 0;

    repositories.forEach(repo => {
      totalStars += repo.stargazersCount;
      totalForks += repo.forksCount;

      if (repo.language) {
        languageStats.set(repo.language, (languageStats.get(repo.language) || 0) + 1);
      }

      repo.topics.forEach(topic => {
        topicStats.set(topic, (topicStats.get(topic) || 0) + 1);
      });
    });

    const topLanguages = Array.from(languageStats.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([language, count]) => ({ language, count }));

    const topTopics = Array.from(topicStats.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));

    return {
      totalCount,
      totalStars,
      totalForks,
      averageStars: totalCount > 0 ? Math.round(totalStars / totalCount) : 0,
      topLanguages,
      topTopics,
      lastSyncAt: user.lastSyncAt,
    };
  },
});

// Search repositories
export const searchRepositories = mutation({
  args: {
    clerkUserId: v.string(),
    query: v.string(),
    filters: v.optional(v.object({
      language: v.optional(v.string()),
      category: v.optional(v.string()),
      minStars: v.optional(v.number()),
      maxStars: v.optional(v.number()),
      topics: v.optional(v.array(v.string())),
    })),
  },
  handler: async (ctx, args) => {
    const user = await getUserByClerkId(ctx, args.clerkUserId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    // Store search history
    await ctx.db.insert("searchHistory", {
      userId: user._id,
      query: args.query,
      filters: args.filters,
      resultCount: 0, // Will be updated after search
      searchedAt: Date.now(),
    });

    // This would typically call the getUserRepositories query
    // with the search parameters to get actual results
    return { success: true };
  },
});

// Remove a repository by its GitHub ID (internal)
export const removeRepositoryByGitHubId = internalMutation({
  args: {
    userId: v.id("users"),
    owner: v.string(),
    repo: v.string(),
  },
  handler: async (ctx, args) => {
    const fullName = `${args.owner}/${args.repo}`;
    const repository = await ctx.db
      .query("repositories")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("fullName"), fullName))
      .first();

    if (repository) {
      await ctx.db.delete(repository._id);
    }
  },
});

// Get distinct languages for filter dropdown
export const getLanguages = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, { clerkUserId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .first();

    if (!user) {
      return [];
    }

    const repositories = await ctx.db
      .query("repositories")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    // Count repositories per language
    const languageCounts = new Map<string, number>();
    repositories.forEach((repo) => {
      if (repo.language) {
        languageCounts.set(
          repo.language,
          (languageCounts.get(repo.language) || 0) + 1
        );
      }
    });

    // Sort by count descending
    const languages = Array.from(languageCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([language, count]) => ({ language, count }));

    return languages;
  },
});

// Get distinct topics for filter dropdown
export const getTopics = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, { clerkUserId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .first();

    if (!user) {
      return [];
    }

    const repositories = await ctx.db
      .query("repositories")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    // Count repositories per topic
    const topicCounts = new Map<string, number>();
    repositories.forEach((repo) => {
      repo.topics.forEach((topic) => {
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
      });
    });

    // Sort by count descending
    const topics = Array.from(topicCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([topic, count]) => ({ topic, count }));

    return topics;
  },
});
