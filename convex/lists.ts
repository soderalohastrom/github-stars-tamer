import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { nanoid } from "nanoid";

// Helper function to get user by Clerk ID
const getUserByClerkIdHelper = async (ctx: any, clerkUserId: string) => {
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", clerkUserId))
    .first();
};

// Create a new list
export const create = mutation({
  args: {
    clerkUserId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    visibility: v.union(v.literal("private"), v.literal("public")),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getUserByClerkIdHelper(ctx, args.clerkUserId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    const now = Date.now();
    const shareId = args.visibility === "public" ? nanoid(12) : undefined;

    const listId = await ctx.db.insert("lists", {
      ownerId: user._id,
      name: args.name,
      description: args.description,
      visibility: args.visibility,
      shareId,
      color: args.color || "#3b82f6",
      icon: args.icon || "list",
      repositoryCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    return listId;
  },
});

// Update a list
export const update = mutation({
  args: {
    clerkUserId: v.string(),
    listId: v.id("lists"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    visibility: v.optional(v.union(v.literal("private"), v.literal("public"))),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getUserByClerkIdHelper(ctx, args.clerkUserId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    const list = await ctx.db.get(args.listId);
    if (!list || list.ownerId !== user._id) {
      throw new ConvexError("List not found or access denied");
    }

    const updateData: any = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updateData.name = args.name;
    if (args.description !== undefined) updateData.description = args.description;
    if (args.color !== undefined) updateData.color = args.color;
    if (args.icon !== undefined) updateData.icon = args.icon;

    // Handle visibility change
    if (args.visibility !== undefined && args.visibility !== list.visibility) {
      updateData.visibility = args.visibility;
      if (args.visibility === "public" && !list.shareId) {
        updateData.shareId = nanoid(12);
      }
    }

    await ctx.db.patch(args.listId, updateData);
    return args.listId;
  },
});

// Delete a list and all its repository entries
export const deleteList = mutation({
  args: {
    clerkUserId: v.string(),
    listId: v.id("lists"),
  },
  handler: async (ctx, args) => {
    const user = await getUserByClerkIdHelper(ctx, args.clerkUserId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    const list = await ctx.db.get(args.listId);
    if (!list || list.ownerId !== user._id) {
      throw new ConvexError("List not found or access denied");
    }

    // Delete all listRepositories entries for this list
    const listRepos = await ctx.db
      .query("listRepositories")
      .withIndex("by_list_id", (q) => q.eq("listId", args.listId))
      .collect();

    for (const entry of listRepos) {
      await ctx.db.delete(entry._id);
    }

    // Delete the list
    await ctx.db.delete(args.listId);
  },
});

// Get user's lists with repo counts
export const getMyLists = query({
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

    const lists = await ctx.db
      .query("lists")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", user._id))
      .collect();

    return lists.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get a single list with its repositories
export const getList = query({
  args: {
    clerkUserId: v.string(),
    listId: v.id("lists"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const list = await ctx.db.get(args.listId);
    if (!list || list.ownerId !== user._id) {
      throw new ConvexError("List not found or access denied");
    }

    // Get repositories in this list
    const listRepos = await ctx.db
      .query("listRepositories")
      .withIndex("by_list_id", (q) => q.eq("listId", args.listId))
      .collect();

    // Sort by sortOrder
    listRepos.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    // Get full repository data
    const repositories = await Promise.all(
      listRepos.map(async (lr) => {
        const repo = await ctx.db.get(lr.repositoryId);
        if (!repo) return null;
        return {
          ...repo,
          listRepoId: lr._id,
          listNotes: lr.notes,
          sortOrder: lr.sortOrder,
          addedAt: lr.addedAt,
        };
      })
    );

    return {
      ...list,
      repositories: repositories.filter(Boolean),
    };
  },
});

// Get public list by shareId (no auth required)
export const getPublicList = query({
  args: {
    shareId: v.string(),
  },
  handler: async (ctx, args) => {
    const list = await ctx.db
      .query("lists")
      .withIndex("by_share_id", (q) => q.eq("shareId", args.shareId))
      .first();

    if (!list || list.visibility !== "public") {
      return null;
    }

    // Get owner info
    const owner = await ctx.db.get(list.ownerId);

    // Get repositories in this list
    const listRepos = await ctx.db
      .query("listRepositories")
      .withIndex("by_list_id", (q) => q.eq("listId", list._id))
      .collect();

    // Sort by sortOrder
    listRepos.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    // Get full repository data
    const repositories = await Promise.all(
      listRepos.map(async (lr) => {
        const repo = await ctx.db.get(lr.repositoryId);
        if (!repo) return null;
        return {
          _id: repo._id,
          name: repo.name,
          fullName: repo.fullName,
          description: repo.description,
          htmlUrl: repo.htmlUrl,
          language: repo.language,
          stargazersCount: repo.stargazersCount,
          forksCount: repo.forksCount,
          topics: repo.topics,
          owner: repo.owner,
          listNotes: lr.notes,
          sortOrder: lr.sortOrder,
        };
      })
    );

    return {
      ...list,
      ownerName: owner?.firstName || owner?.githubUsername || "Anonymous",
      ownerAvatar: owner?.imageUrl,
      repositories: repositories.filter(Boolean),
    };
  },
});

// Add repository to list
export const addRepository = mutation({
  args: {
    clerkUserId: v.string(),
    listId: v.id("lists"),
    repositoryId: v.id("repositories"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getUserByClerkIdHelper(ctx, args.clerkUserId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    // Verify list ownership
    const list = await ctx.db.get(args.listId);
    if (!list || list.ownerId !== user._id) {
      throw new ConvexError("List not found or access denied");
    }

    // Verify repository ownership
    const repo = await ctx.db.get(args.repositoryId);
    if (!repo || repo.userId !== user._id) {
      throw new ConvexError("Repository not found or access denied");
    }

    // Check if already in list
    const existing = await ctx.db
      .query("listRepositories")
      .withIndex("by_list_and_repository", (q) =>
        q.eq("listId", args.listId).eq("repositoryId", args.repositoryId)
      )
      .first();

    if (existing) {
      throw new ConvexError("Repository already in this list");
    }

    // Get max sort order
    const listRepos = await ctx.db
      .query("listRepositories")
      .withIndex("by_list_id", (q) => q.eq("listId", args.listId))
      .collect();

    const maxSortOrder = Math.max(...listRepos.map((lr) => lr.sortOrder || 0), 0);

    // Add to list
    const entryId = await ctx.db.insert("listRepositories", {
      listId: args.listId,
      repositoryId: args.repositoryId,
      addedAt: Date.now(),
      addedBy: user._id,
      sortOrder: maxSortOrder + 1,
      notes: args.notes,
    });

    // Update repository count
    await ctx.db.patch(args.listId, {
      repositoryCount: list.repositoryCount + 1,
      updatedAt: Date.now(),
    });

    return entryId;
  },
});

// Remove repository from list
export const removeRepository = mutation({
  args: {
    clerkUserId: v.string(),
    listId: v.id("lists"),
    repositoryId: v.id("repositories"),
  },
  handler: async (ctx, args) => {
    const user = await getUserByClerkIdHelper(ctx, args.clerkUserId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    // Verify list ownership
    const list = await ctx.db.get(args.listId);
    if (!list || list.ownerId !== user._id) {
      throw new ConvexError("List not found or access denied");
    }

    // Find the entry
    const entry = await ctx.db
      .query("listRepositories")
      .withIndex("by_list_and_repository", (q) =>
        q.eq("listId", args.listId).eq("repositoryId", args.repositoryId)
      )
      .first();

    if (!entry) {
      throw new ConvexError("Repository not in this list");
    }

    // Delete the entry
    await ctx.db.delete(entry._id);

    // Update repository count
    await ctx.db.patch(args.listId, {
      repositoryCount: Math.max(0, list.repositoryCount - 1),
      updatedAt: Date.now(),
    });
  },
});

// Reorder repositories in a list
export const reorderRepositories = mutation({
  args: {
    clerkUserId: v.string(),
    listId: v.id("lists"),
    repositoryIds: v.array(v.id("repositories")),
  },
  handler: async (ctx, args) => {
    const user = await getUserByClerkIdHelper(ctx, args.clerkUserId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    // Verify list ownership
    const list = await ctx.db.get(args.listId);
    if (!list || list.ownerId !== user._id) {
      throw new ConvexError("List not found or access denied");
    }

    // Update sort order for each repository
    for (let i = 0; i < args.repositoryIds.length; i++) {
      const entry = await ctx.db
        .query("listRepositories")
        .withIndex("by_list_and_repository", (q) =>
          q.eq("listId", args.listId).eq("repositoryId", args.repositoryIds[i])
        )
        .first();

      if (entry) {
        await ctx.db.patch(entry._id, { sortOrder: i + 1 });
      }
    }

    await ctx.db.patch(args.listId, { updatedAt: Date.now() });
  },
});

// Update notes for a repository in a list
export const updateRepositoryNotes = mutation({
  args: {
    clerkUserId: v.string(),
    listId: v.id("lists"),
    repositoryId: v.id("repositories"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getUserByClerkIdHelper(ctx, args.clerkUserId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    // Verify list ownership
    const list = await ctx.db.get(args.listId);
    if (!list || list.ownerId !== user._id) {
      throw new ConvexError("List not found or access denied");
    }

    // Find the entry
    const entry = await ctx.db
      .query("listRepositories")
      .withIndex("by_list_and_repository", (q) =>
        q.eq("listId", args.listId).eq("repositoryId", args.repositoryId)
      )
      .first();

    if (!entry) {
      throw new ConvexError("Repository not in this list");
    }

    await ctx.db.patch(entry._id, { notes: args.notes });
    await ctx.db.patch(args.listId, { updatedAt: Date.now() });
  },
});

// Get lists containing a specific repository
export const getListsForRepository = query({
  args: {
    clerkUserId: v.string(),
    repositoryId: v.id("repositories"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (!user) {
      return [];
    }

    // Get all list entries for this repository
    const listEntries = await ctx.db
      .query("listRepositories")
      .withIndex("by_repository_id", (q) => q.eq("repositoryId", args.repositoryId))
      .collect();

    // Get the lists
    const lists = await Promise.all(
      listEntries.map(async (entry) => {
        const list = await ctx.db.get(entry.listId);
        // Only return lists owned by this user
        if (list && list.ownerId === user._id) {
          return list;
        }
        return null;
      })
    );

    return lists.filter(Boolean);
  },
});
