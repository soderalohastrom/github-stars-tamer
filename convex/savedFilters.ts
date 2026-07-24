import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { assertUserOwns, requireAuthenticatedUser } from "./authz";

// Filter and sort schema (shared with search.ts)
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

// Create a new saved filter
export const create = mutation({
  args: {
    clerkUserId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    query: v.optional(v.string()),
    filters: filterSchema,
    sort: v.optional(sortSchema),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, args.clerkUserId);

    if (args.filters.categoryId) {
      const category = await ctx.db.get(args.filters.categoryId);
      if (!category) {
        throw new ConvexError("Category not found");
      }
      assertUserOwns(category.userId, user._id, "Category");
    }

    const now = Date.now();

    const filterId = await ctx.db.insert("savedFilters", {
      userId: user._id,
      name: args.name,
      description: args.description,
      query: args.query,
      filters: args.filters,
      sort: args.sort,
      isPinned: false,
      color: args.color,
      icon: args.icon,
      lastUsedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return filterId;
  },
});

// List user's saved filters (pinned first, then by last used)
export const list = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, args.clerkUserId);

    const filters = await ctx.db
      .query("savedFilters")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    // Sort: pinned first, then by lastUsedAt descending
    filters.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const aTime = a.lastUsedAt || a.createdAt;
      const bTime = b.lastUsedAt || b.createdAt;
      return bTime - aTime;
    });

    // Enrich with category names if categoryId is present
    const enrichedFilters = await Promise.all(
      filters.map(async (filter) => {
        let categoryName: string | undefined;
        if (filter.filters.categoryId) {
          const category = await ctx.db.get(filter.filters.categoryId);
          categoryName = category?.userId === user._id ? category.name : undefined;
        }
        return {
          ...filter,
          categoryName,
        };
      })
    );

    return enrichedFilters;
  },
});

// Get a single saved filter by ID
export const get = query({
  args: {
    clerkUserId: v.string(),
    filterId: v.id("savedFilters"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, args.clerkUserId);

    const filter = await ctx.db.get(args.filterId);

    if (!filter) {
      return null;
    }
    if (filter.userId !== user._id) return null;

    // Enrich with category name
    let categoryName: string | undefined;
    if (filter.filters.categoryId) {
      const category = await ctx.db.get(filter.filters.categoryId);
      categoryName = category?.userId === user._id ? category.name : undefined;
    }

    return {
      ...filter,
      categoryName,
    };
  },
});

// Update a saved filter
export const update = mutation({
  args: {
    clerkUserId: v.string(),
    filterId: v.id("savedFilters"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    query: v.optional(v.string()),
    filters: v.optional(filterSchema),
    sort: v.optional(sortSchema),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, args.clerkUserId);

    const filter = await ctx.db.get(args.filterId);
    if (!filter) {
      throw new ConvexError("Saved filter not found");
    }
    assertUserOwns(filter.userId, user._id, "Saved filter");

    if (args.filters?.categoryId) {
      const category = await ctx.db.get(args.filters.categoryId);
      if (!category) {
        throw new ConvexError("Category not found");
      }
      assertUserOwns(category.userId, user._id, "Category");
    }

    const updates: Record<string, any> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.query !== undefined) updates.query = args.query;
    if (args.filters !== undefined) updates.filters = args.filters;
    if (args.sort !== undefined) updates.sort = args.sort;
    if (args.color !== undefined) updates.color = args.color;
    if (args.icon !== undefined) updates.icon = args.icon;

    await ctx.db.patch(args.filterId, updates);
  },
});

// Delete a saved filter
export const remove = mutation({
  args: {
    clerkUserId: v.string(),
    filterId: v.id("savedFilters"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, args.clerkUserId);

    const filter = await ctx.db.get(args.filterId);
    if (!filter) {
      throw new ConvexError("Saved filter not found");
    }
    assertUserOwns(filter.userId, user._id, "Saved filter");

    await ctx.db.delete(args.filterId);
  },
});

// Toggle pin status
export const togglePin = mutation({
  args: {
    clerkUserId: v.string(),
    filterId: v.id("savedFilters"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, args.clerkUserId);

    const filter = await ctx.db.get(args.filterId);
    if (!filter) {
      throw new ConvexError("Saved filter not found");
    }
    assertUserOwns(filter.userId, user._id, "Saved filter");

    await ctx.db.patch(args.filterId, {
      isPinned: !filter.isPinned,
      updatedAt: Date.now(),
    });

    return { isPinned: !filter.isPinned };
  },
});

// Record usage (update lastUsedAt for ranking)
export const recordUsage = mutation({
  args: {
    clerkUserId: v.string(),
    filterId: v.id("savedFilters"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx, args.clerkUserId);

    const filter = await ctx.db.get(args.filterId);
    if (!filter) {
      return; // Silently ignore if not found
    }
    assertUserOwns(filter.userId, user._id, "Saved filter");

    await ctx.db.patch(args.filterId, {
      lastUsedAt: Date.now(),
    });
  },
});
