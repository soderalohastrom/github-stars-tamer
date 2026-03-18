import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";

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
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

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
        clerkUserId: args.clerkUserId,
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
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .first();
      
    if (!user) {
      // Return null instead of throwing error
      // This allows the app to work gracefully while UserInitializer creates the user
      return null;
    }
    return user;
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
    const user = await getUserByClerkIdHelper(ctx, clerkUserId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    const updatedPreferences = {
      ...user.preferences,
      ...preferences,
    };

    await ctx.db.patch(user._id, {
      preferences: updatedPreferences,
      updatedAt: Date.now(),
    });
  },
});

// Store encrypted GitHub token
export const storeGitHubToken = mutation({
  args: {
    clerkUserId: v.string(),
    encryptedToken: v.string(),
    githubUsername: v.string(),
  },
  handler: async (ctx, { clerkUserId, encryptedToken, githubUsername }) => {
    let user = await getUserByClerkIdHelper(ctx, clerkUserId);
    
    // If user doesn't exist, try to get minimal info from Clerk and create the user
    if (!user) {
      // For now, create a minimal user record - the UserInitializer will update it later
      const now = Date.now();
      const userId = await ctx.db.insert("users", {
        clerkUserId: clerkUserId,
        email: "unknown@example.com", // Temporary placeholder
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
      
      // Fetch the newly created user
      user = await getUserByClerkIdHelper(ctx, clerkUserId);
      
      if (!user) {
        throw new ConvexError("Failed to create user record");
      }
    }

    await ctx.db.patch(user._id, {
      githubToken: encryptedToken,
      githubUsername,
      updatedAt: Date.now(),
    });
  },
});

// Update last sync time
export const updateLastSyncTime = internalMutation({
  args: {
    userId: v.id("users"),
    syncTime: v.number(),
  },
  handler: async (ctx, { userId, syncTime }) => {
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
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .first();

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
