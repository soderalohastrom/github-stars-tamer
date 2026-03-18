import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

// Helper function to get user by Clerk ID
const getUserByClerkId = async (ctx: any, clerkUserId: string) => {
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", clerkUserId))
    .first();
};

// Helper: Build searchText from repository data
export function buildSearchText(repo: {
  name: string;
  fullName: string;
  description?: string | null;
  topics: string[];
  owner: { login: string };
}): string {
  const parts = [
    repo.name,
    repo.fullName,
    repo.description || "",
    repo.topics.join(" "),
    repo.owner.login,
  ];
  return parts.join(" ").toLowerCase();
}

// Types for filters and sorting
const filterSchema = v.object({
  language: v.optional(v.string()),
  categoryId: v.optional(v.id("categories")),
  minStars: v.optional(v.number()),
  maxStars: v.optional(v.number()),
  topics: v.optional(v.array(v.string())),
  isFork: v.optional(v.boolean()),
  archived: v.optional(v.boolean()),
});

const sortSchema = v.object({
  field: v.union(
    v.literal("stargazersCount"),
    v.literal("starredAt"),
    v.literal("updatedAt"),
    v.literal("name")
  ),
  order: v.union(v.literal("asc"), v.literal("desc")),
});

// Full-text search with filters, sorting, and pagination
export const searchRepositories = query({
  args: {
    clerkUserId: v.string(),
    query: v.optional(v.string()),
    filters: v.optional(filterSchema),
    sort: v.optional(sortSchema),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (!user) {
      return { results: [], nextCursor: null, totalCount: 0 };
    }

    const searchQuery = args.query?.trim() || "";
    const filters = args.filters || {};
    const sort = args.sort || { field: "starredAt", order: "desc" };
    const limit = Math.min(args.limit || 50, 100); // Cap at 100

    let repositories: Doc<"repositories">[];

    // Use search index if we have a search query
    if (searchQuery.length > 0) {
      // Build search index query with supported filter fields
      const searchResults = await ctx.db
        .query("repositories")
        .withSearchIndex("search_repositories", (q) => {
          let searchBuilder = q
            .search("searchText", searchQuery)
            .eq("userId", user._id);

          // These filters are supported by the search index
          if (filters.language !== undefined) {
            searchBuilder = searchBuilder.eq("language", filters.language);
          }
          if (filters.archived !== undefined) {
            searchBuilder = searchBuilder.eq("archived", filters.archived);
          }
          if (filters.isFork !== undefined) {
            searchBuilder = searchBuilder.eq("isFork", filters.isFork);
          }

          return searchBuilder;
        })
        .collect();

      repositories = searchResults;
    } else {
      // No search query - use regular index
      repositories = await ctx.db
        .query("repositories")
        .withIndex("by_user_id", (q) => q.eq("userId", user._id))
        .collect();

      // Apply basic filters manually when not using search
      if (filters.language !== undefined) {
        repositories = repositories.filter((r) => r.language === filters.language);
      }
      if (filters.archived !== undefined) {
        repositories = repositories.filter((r) => r.archived === filters.archived);
      }
      if (filters.isFork !== undefined) {
        repositories = repositories.filter((r) => r.isFork === filters.isFork);
      }
    }

    // Apply filters not supported by search index (in-memory)
    if (filters.minStars !== undefined) {
      repositories = repositories.filter(
        (r) => r.stargazersCount >= filters.minStars!
      );
    }
    if (filters.maxStars !== undefined) {
      repositories = repositories.filter(
        (r) => r.stargazersCount <= filters.maxStars!
      );
    }
    if (filters.topics && filters.topics.length > 0) {
      repositories = repositories.filter((r) =>
        filters.topics!.some((t) => r.topics.includes(t))
      );
    }

    // Filter by category if specified
    if (filters.categoryId) {
      const repoCategories = await ctx.db
        .query("repositoryCategories")
        .withIndex("by_category_id", (q) => q.eq("categoryId", filters.categoryId!))
        .collect();

      const repoIds = new Set(repoCategories.map((rc) => rc.repositoryId));
      repositories = repositories.filter((r) => repoIds.has(r._id));
    }

    const totalCount = repositories.length;

    // Sort repositories
    repositories.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sort.field) {
        case "stargazersCount":
          aVal = a.stargazersCount;
          bVal = b.stargazersCount;
          break;
        case "starredAt":
          aVal = new Date(a.starredAt).getTime();
          bVal = new Date(b.starredAt).getTime();
          break;
        case "updatedAt":
          aVal = new Date(a.updatedAt).getTime();
          bVal = new Date(b.updatedAt).getTime();
          break;
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        default:
          aVal = new Date(a.starredAt).getTime();
          bVal = new Date(b.starredAt).getTime();
      }

      if (sort.order === "asc") {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    // Pagination using cursor (index-based for simplicity)
    let startIndex = 0;
    if (args.cursor) {
      startIndex = parseInt(args.cursor, 10) || 0;
    }

    const paginatedResults = repositories.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < repositories.length;
    const nextCursor = hasMore ? String(startIndex + limit) : null;

    // Enrich with categories
    const enrichedResults = await Promise.all(
      paginatedResults.map(async (repo) => {
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

    return {
      results: enrichedResults,
      nextCursor,
      totalCount,
    };
  },
});

// Record search in history (separate mutation to avoid side effects in query)
export const recordSearch = mutation({
  args: {
    clerkUserId: v.string(),
    query: v.string(),
    filters: v.optional(filterSchema),
    sort: v.optional(sortSchema),
    resultCount: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getUserByClerkId(ctx, args.clerkUserId);
    if (!user) return;

    await ctx.db.insert("searchHistory", {
      userId: user._id,
      query: args.query,
      filters: args.filters,
      sort: args.sort,
      resultCount: args.resultCount,
      searchedAt: Date.now(),
    });
  },
});

// Get recent searches for autocomplete
export const getRecentSearches = query({
  args: {
    clerkUserId: v.string(),
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

    const limit = args.limit || 10;

    const searches = await ctx.db
      .query("searchHistory")
      .withIndex("by_user_and_searched_at", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    // Deduplicate by query string
    const seen = new Set<string>();
    const uniqueSearches = searches.filter((s) => {
      const key = s.query.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return uniqueSearches;
  },
});

// Update searchText for a single repository (internal)
export const updateRepositorySearchText = internalMutation({
  args: {
    repositoryId: v.id("repositories"),
  },
  handler: async (ctx, { repositoryId }) => {
    const repo = await ctx.db.get(repositoryId);
    if (!repo) return;

    const searchText = buildSearchText({
      name: repo.name,
      fullName: repo.fullName,
      description: repo.description,
      topics: repo.topics,
      owner: repo.owner,
    });

    await ctx.db.patch(repositoryId, { searchText });
  },
});

// Backfill searchText for all repositories of a user
export const updateSearchTextForUser = mutation({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, { clerkUserId }) => {
    const user = await getUserByClerkId(ctx, clerkUserId);
    if (!user) return { updated: 0 };

    const repositories = await ctx.db
      .query("repositories")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    let updated = 0;
    for (const repo of repositories) {
      const searchText = buildSearchText({
        name: repo.name,
        fullName: repo.fullName,
        description: repo.description,
        topics: repo.topics,
        owner: repo.owner,
      });

      if (repo.searchText !== searchText) {
        await ctx.db.patch(repo._id, { searchText });
        updated++;
      }
    }

    return { updated, total: repositories.length };
  },
});

// Batch update searchText (for background job)
export const batchUpdateSearchText = internalMutation({
  args: {
    repositoryIds: v.array(v.id("repositories")),
  },
  handler: async (ctx, { repositoryIds }) => {
    let updated = 0;

    for (const repoId of repositoryIds) {
      const repo = await ctx.db.get(repoId);
      if (!repo) continue;

      const searchText = buildSearchText({
        name: repo.name,
        fullName: repo.fullName,
        description: repo.description,
        topics: repo.topics,
        owner: repo.owner,
      });

      if (repo.searchText !== searchText) {
        await ctx.db.patch(repoId, { searchText });
        updated++;
      }
    }

    return { updated };
  },
});
