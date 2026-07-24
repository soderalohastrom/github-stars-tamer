import { ConvexError, v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requireAuthenticatedUser } from "./authz";

// Create sync record
export const createSyncRecord = internalMutation({
  args: {
    userId: v.id("users"),
    syncType: v.union(v.literal("full"), v.literal("incremental"), v.literal("manual")),
  },
  handler: async (ctx, { userId, syncType }) => {
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    return await ctx.db.insert("syncHistory", {
      userId,
      syncType,
      status: "running",
      startedAt: Date.now(),
      repositoriesProcessed: 0,
      repositoriesAdded: 0,
      repositoriesUpdated: 0,
      repositoriesRemoved: 0,
    });
  },
});

// Complete sync record
export const completeSyncRecord = internalMutation({
  args: {
    syncId: v.id("syncHistory"),
    repositoriesProcessed: v.number(),
    repositoriesAdded: v.number(),
    repositoriesUpdated: v.number(),
    repositoriesRemoved: v.number(),
    rateLimitRemaining: v.optional(v.number()),
    rateLimitReset: v.optional(v.number()),
    totalApiCalls: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const syncRecord = await ctx.db.get(args.syncId);
    if (!syncRecord) {
      throw new ConvexError("Sync record not found");
    }
    const user = await ctx.db.get(syncRecord.userId);
    if (!user) {
      throw new ConvexError("Sync record owner not found");
    }

    await ctx.db.patch(args.syncId, {
      status: "completed",
      completedAt: Date.now(),
      repositoriesProcessed: args.repositoriesProcessed,
      repositoriesAdded: args.repositoriesAdded,
      repositoriesUpdated: args.repositoriesUpdated,
      repositoriesRemoved: args.repositoriesRemoved,
      metadata: {
        rateLimitRemaining: args.rateLimitRemaining,
        rateLimitReset: args.rateLimitReset,
        totalApiCalls: args.totalApiCalls,
      },
    });
  },
});

// Fail sync record
export const failSyncRecord = internalMutation({
  args: {
    syncId: v.id("syncHistory"),
    errorMessage: v.string(),
  },
  handler: async (ctx, { syncId, errorMessage }) => {
    const syncRecord = await ctx.db.get(syncId);
    if (!syncRecord) {
      throw new ConvexError("Sync record not found");
    }
    const user = await ctx.db.get(syncRecord.userId);
    if (!user) {
      throw new ConvexError("Sync record owner not found");
    }

    await ctx.db.patch(syncId, {
      status: "failed",
      completedAt: Date.now(),
      errorMessage,
    });
  },
});

// Get sync history for user
export const getSyncHistory = query({
  args: {
    clerkUserId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { clerkUserId, limit = 10 }) => {
    const user = await requireAuthenticatedUser(ctx, clerkUserId);

    const syncHistory = await ctx.db
      .query("syncHistory")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);

    return syncHistory;
  },
});

// Get latest sync status
export const getLatestSyncStatus = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    const user = await requireAuthenticatedUser(ctx, clerkUserId);

    const latestSync = await ctx.db
      .query("syncHistory")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .order("desc")
      .first();

    return latestSync;
  },
});
