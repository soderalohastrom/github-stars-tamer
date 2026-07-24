import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import {
  getUserByAuthenticatedSubject,
  requireAuthenticatedSubject,
  requireAuthenticatedUser,
} from "./authz";

// Get user by Clerk ID
export const getUserByClerkId = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .first();
  },
});

/**
 * The only profile shape returned to a client. In particular, this excludes
 * every OAuth/PAT field and provider account identifier.
 */
const toSafeUserProfile = (user: NonNullable<Awaited<ReturnType<typeof getUserByClerkIdHelper>>>) => ({
  _id: user._id,
  _creationTime: user._creationTime,
  clerkUserId: user.clerkUserId,
  email: user.email,
  ...(user.firstName !== undefined ? { firstName: user.firstName } : {}),
  ...(user.lastName !== undefined ? { lastName: user.lastName } : {}),
  ...(user.imageUrl !== undefined ? { imageUrl: user.imageUrl } : {}),
  ...(user.githubUsername !== undefined ? { githubUsername: user.githubUsername } : {}),
  ...(user.preferences !== undefined ? { preferences: user.preferences } : {}),
  ...(user.lastSyncAt !== undefined ? { lastSyncAt: user.lastSyncAt } : {}),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// Internal helper function to get user by clerk ID (for use within mutations)
// Export this for use in other modules
export const getUserByClerkIdHelper = async (ctx: any, clerkUserId: string) => {
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q: any) => q.eq("clerkUserId", clerkUserId))
    .first();
};

// Create or update user from Clerk
export const upsertUserFromClerk = mutation({
  args: {
    clerkUserId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    // Optional GitHub account data from Clerk external accounts
    githubAccount: v.optional(v.object({
      externalAccountId: v.string(),
      username: v.string(),
      email: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const subject = await requireAuthenticatedSubject(ctx, args.clerkUserId);
    const existingUser = await getUserByAuthenticatedSubject(ctx, subject);

    const now = Date.now();

    // Prepare GitHub fields if provided
    const githubFields = args.githubAccount ? {
      githubExternalAccountId: args.githubAccount.externalAccountId,
      githubUsername: args.githubAccount.username,
      githubEmail: args.githubAccount.email,
    } : {};

    if (existingUser) {
      // Update existing user
      const updateFields: any = {
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        imageUrl: args.imageUrl,
        updatedAt: now,
      };

      // Only update GitHub fields if provided (don't overwrite with undefined)
      if (args.githubAccount) {
        Object.assign(updateFields, githubFields);
      }

      await ctx.db.patch(existingUser._id, updateFields);
      return existingUser._id;
    } else {
      // Create new user with default preferences
      const userId = await ctx.db.insert("users", {
        clerkUserId: subject,
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        imageUrl: args.imageUrl,
        ...githubFields,
        preferences: {
          theme: "system",
          defaultSort: "created",
          enableHaptics: true,
          syncFrequency: "manual",
        },
        createdAt: now,
        updatedAt: now,
      });

      // Create default categories for new user
      await createDefaultCategories(ctx, userId);

      return userId;
    }
  },
});

// Internal function to create default categories
const createDefaultCategories = async (ctx: any, userId: any) => {
  const now = Date.now();
  const defaultCategories = [
    {
      name: "Learning",
      description: "Repositories for learning new technologies",
      color: "#3b82f6", // Blue
      icon: "book-open",
      sortOrder: 1,
    },
    {
      name: "Tools",
      description: "Useful tools and utilities",
      color: "#10b981", // Green
      icon: "wrench",
      sortOrder: 2,
    },
    {
      name: "Inspiration",
      description: "Inspiring projects and ideas",
      color: "#f59e0b", // Yellow
      icon: "light-bulb",
      sortOrder: 3,
    },
    {
      name: "Work",
      description: "Work-related repositories",
      color: "#ef4444", // Red
      icon: "briefcase",
      sortOrder: 4,
    },
  ];

  for (const category of defaultCategories) {
    await ctx.db.insert("categories", {
      userId,
      ...category,
      isDefault: true,
      metadata: {
        repositoryCount: 0,
      },
      createdAt: now,
      updatedAt: now,
    });
  }
};

// Get user profile
export const getUserProfile = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    const subject = await requireAuthenticatedSubject(ctx, clerkUserId);
    const user = await getUserByAuthenticatedSubject(ctx, subject);
      
    if (!user) {
      // Return null instead of throwing error
      // This allows the app to work gracefully while UserInitializer creates the user
      return null;
    }
    return toSafeUserProfile(user);
  },
});

// Update user preferences
export const updateUserPreferences = mutation({
  args: {
    clerkUserId: v.string(),
    preferences: v.object({
      theme: v.optional(v.union(v.literal("light"), v.literal("dark"), v.literal("system"))),
      defaultSort: v.optional(v.union(
        v.literal("created"),
        v.literal("updated"),
        v.literal("stars"),
        v.literal("name")
      )),
      enableHaptics: v.optional(v.boolean()),
      syncFrequency: v.optional(v.union(
        v.literal("manual"),
        v.literal("hourly"),
        v.literal("daily")
      )),
    }),
  },
  handler: async (ctx, { clerkUserId, preferences }) => {
    const user = await requireAuthenticatedUser(ctx, clerkUserId);

    const currentPreferences = user.preferences ?? {
      theme: "system" as const,
      defaultSort: "created" as const,
      enableHaptics: true,
      syncFrequency: "manual" as const,
    };
    const updatedPreferences = {
      theme: preferences.theme ?? currentPreferences.theme,
      defaultSort: preferences.defaultSort ?? currentPreferences.defaultSort,
      enableHaptics: preferences.enableHaptics ?? currentPreferences.enableHaptics,
      syncFrequency: preferences.syncFrequency ?? currentPreferences.syncFrequency,
    };

    await ctx.db.patch(user._id, {
      preferences: updatedPreferences,
      updatedAt: Date.now(),
    });
  },
});

// Legacy personal-access-token storage is intentionally disabled. OAuth tokens
// are fetched server-side from Clerk and must never be accepted from a client.
export const storeGitHubToken = mutation({
  args: {
    clerkUserId: v.string(),
    encryptedToken: v.string(),
    githubUsername: v.string(),
  },
  handler: async (ctx, { clerkUserId }) => {
    await requireAuthenticatedSubject(ctx, clerkUserId);
    throw new ConvexError(
      "Legacy GitHub token storage is disabled; reconnect GitHub through Clerk OAuth",
    );
  },
});

// Update last sync time
export const updateLastSyncTime = internalMutation({
  args: {
    userId: v.id("users"),
    syncTime: v.number(),
  },
  handler: async (ctx, { userId, syncTime }) => {
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new ConvexError("User not found");
    }
    await ctx.db.patch(userId, {
      lastSyncAt: syncTime,
      updatedAt: Date.now(),
    });
  },
});

// Check if user has GitHub connected (via OAuth)
export const isGitHubConnected = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    const subject = await requireAuthenticatedSubject(ctx, clerkUserId);
    const user = await getUserByAuthenticatedSubject(ctx, subject);

    if (!user) {
      return {
        connected: false,
        username: null,
        hasToken: false,
      };
    }

    return {
      connected: !!user.githubExternalAccountId,
      username: user.githubUsername || null,
      hasToken: !!user.githubAccessToken,
    };
  },
});
