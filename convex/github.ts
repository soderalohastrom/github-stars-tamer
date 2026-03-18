import { ConvexError, v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

// Token refresh threshold: refresh if token will expire within 5 minutes
const TOKEN_EXPIRY_THRESHOLD_MS = 5 * 60 * 1000;
// Minimum time between token fetches from Clerk (to avoid excessive API calls)
const MIN_TOKEN_FETCH_INTERVAL_MS = 60 * 1000; // 1 minute

/**
 * Link GitHub account data from Clerk OAuth to the user record.
 * Called from UserInitializer when a GitHub external account is detected.
 */
export const linkGithubAccount = mutation({
  args: {
    clerkUserId: v.string(),
    githubExternalAccountId: v.string(),
    githubUsername: v.string(),
    githubEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (!user) {
      throw new ConvexError("User not found. Please ensure user is initialized first.");
    }

    const now = Date.now();

    // Update user with GitHub account info
    await ctx.db.patch(user._id, {
      githubExternalAccountId: args.githubExternalAccountId,
      githubUsername: args.githubUsername,
      githubEmail: args.githubEmail,
      updatedAt: now,
    });

    return { success: true, userId: user._id };
  },
});

/**
 * Store GitHub OAuth token fetched from Clerk Backend API.
 * Internal mutation - only called by refreshGithubToken action.
 */
export const storeGithubOAuthToken = internalMutation({
  args: {
    clerkUserId: v.string(),
    accessToken: v.string(),
    scopes: v.array(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    const now = Date.now();

    await ctx.db.patch(user._id, {
      githubAccessToken: args.accessToken,
      githubScopes: args.scopes,
      githubTokenExpiresAt: args.expiresAt,
      githubTokenLastFetchedAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Clear GitHub OAuth token (e.g., when token is revoked or user disconnects).
 */
export const clearGithubToken = mutation({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, { clerkUserId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    await ctx.db.patch(user._id, {
      githubAccessToken: undefined,
      githubTokenExpiresAt: undefined,
      githubTokenLastFetchedAt: undefined,
      githubScopes: undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Internal query to get GitHub token info for a user.
 * Used by sync operations to check if token refresh is needed.
 */
export const getGithubTokenInfo = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .first();

    if (!user) {
      return null;
    }

    return {
      userId: user._id,
      clerkUserId: user.clerkUserId,
      accessToken: user.githubAccessToken,
      expiresAt: user.githubTokenExpiresAt,
      lastFetchedAt: user.githubTokenLastFetchedAt,
      scopes: user.githubScopes,
      githubUsername: user.githubUsername,
      githubExternalAccountId: user.githubExternalAccountId,
    };
  },
});

/**
 * Check if the current token needs refresh.
 */
function tokenNeedsRefresh(expiresAt: number | undefined, lastFetchedAt: number | undefined): boolean {
  const now = Date.now();

  // If we have an expiry time and it's within the threshold, refresh
  if (expiresAt && expiresAt - now < TOKEN_EXPIRY_THRESHOLD_MS) {
    return true;
  }

  // If we haven't fetched in a while, proactively refresh (tokens can be revoked)
  // This is a conservative approach - refresh every 55 minutes
  const MAX_TOKEN_AGE_MS = 55 * 60 * 1000;
  if (lastFetchedAt && now - lastFetchedAt > MAX_TOKEN_AGE_MS) {
    return true;
  }

  return false;
}

/**
 * Refresh GitHub OAuth token from Clerk Backend API.
 * Requires CLERK_SECRET_KEY to be set in Convex environment variables.
 */
export const refreshGithubToken = action({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }): Promise<{ success: boolean; error?: string }> => {
    // Get current token info
    const tokenInfo = await ctx.runQuery(internal.github.getGithubTokenInfo, { clerkUserId });

    if (!tokenInfo) {
      return { success: false, error: "User not found" };
    }

    if (!tokenInfo.githubExternalAccountId) {
      return { success: false, error: "No GitHub account linked" };
    }

    // Check if we recently fetched (avoid hammering Clerk API)
    const now = Date.now();
    if (tokenInfo.lastFetchedAt && now - tokenInfo.lastFetchedAt < MIN_TOKEN_FETCH_INTERVAL_MS) {
      // Recently fetched, use existing token
      if (tokenInfo.accessToken) {
        return { success: true };
      }
    }

    // Fetch fresh token from Clerk Backend API
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      return { success: false, error: "CLERK_SECRET_KEY not configured" };
    }

    try {
      // Clerk API endpoint for OAuth access tokens
      const response = await fetch(
        `https://api.clerk.com/v1/users/${clerkUserId}/oauth_access_tokens/github`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${clerkSecretKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Clerk API error:", response.status, errorText);

        if (response.status === 404) {
          return { success: false, error: "GitHub OAuth connection not found in Clerk" };
        }
        if (response.status === 401) {
          return { success: false, error: "Invalid CLERK_SECRET_KEY" };
        }

        return { success: false, error: `Clerk API error: ${response.status}` };
      }

      const data = await response.json();

      // Clerk returns an array of tokens (usually just one for GitHub)
      if (!Array.isArray(data) || data.length === 0) {
        return { success: false, error: "No GitHub OAuth token available from Clerk" };
      }

      const tokenData = data[0];
      const accessToken = tokenData.token;
      const scopes = tokenData.scopes || [];

      // GitHub OAuth tokens from Clerk don't have explicit expiry, but we track refresh time
      // Set a reasonable expiry window (1 hour) for proactive refresh
      const expiresAt = tokenData.expires_at
        ? new Date(tokenData.expires_at).getTime()
        : Date.now() + (60 * 60 * 1000); // 1 hour default

      // Store the token
      await ctx.runMutation(internal.github.storeGithubOAuthToken, {
        clerkUserId,
        accessToken,
        scopes,
        expiresAt,
      });

      return { success: true };
    } catch (error) {
      console.error("Failed to refresh GitHub token:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error refreshing token"
      };
    }
  },
});

/**
 * Get a valid GitHub token, refreshing if necessary.
 * This is the main entry point for sync operations to get a token.
 */
export const getValidGithubToken = action({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }): Promise<{ token: string | null; error?: string }> => {
    // Get current token info
    const tokenInfo = await ctx.runQuery(internal.github.getGithubTokenInfo, { clerkUserId });

    if (!tokenInfo) {
      return { token: null, error: "User not found" };
    }

    if (!tokenInfo.githubExternalAccountId) {
      return { token: null, error: "No GitHub account linked. Please connect GitHub in settings." };
    }

    // Check if token needs refresh
    const needsRefresh = !tokenInfo.accessToken ||
      tokenNeedsRefresh(tokenInfo.expiresAt ?? undefined, tokenInfo.lastFetchedAt ?? undefined);

    if (needsRefresh) {
      const refreshResult = await ctx.runAction(internal.github.refreshGithubTokenInternal, { clerkUserId });
      if (!refreshResult.success) {
        return { token: null, error: refreshResult.error };
      }

      // Get the fresh token
      const freshTokenInfo = await ctx.runQuery(internal.github.getGithubTokenInfo, { clerkUserId });
      if (!freshTokenInfo?.accessToken) {
        return { token: null, error: "Failed to retrieve refreshed token" };
      }

      return { token: freshTokenInfo.accessToken };
    }

    return { token: tokenInfo.accessToken ?? null };
  },
});

/**
 * Internal version of getValidGithubToken (for use within other actions).
 */
export const getValidGithubTokenInternal = internalAction({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }): Promise<{ token: string | null; error?: string }> => {
    // Get current token info
    const tokenInfo = await ctx.runQuery(internal.github.getGithubTokenInfo, { clerkUserId });

    if (!tokenInfo) {
      return { token: null, error: "User not found" };
    }

    if (!tokenInfo.githubExternalAccountId) {
      return { token: null, error: "No GitHub account linked. Please connect GitHub in settings." };
    }

    // Check if token needs refresh
    const now = Date.now();
    const TOKEN_EXPIRY_THRESHOLD_MS = 5 * 60 * 1000;
    const MAX_TOKEN_AGE_MS = 55 * 60 * 1000;

    const needsRefresh = !tokenInfo.accessToken ||
      (tokenInfo.expiresAt && tokenInfo.expiresAt - now < TOKEN_EXPIRY_THRESHOLD_MS) ||
      (tokenInfo.lastFetchedAt && now - tokenInfo.lastFetchedAt > MAX_TOKEN_AGE_MS);

    if (needsRefresh) {
      const refreshResult = await ctx.runAction(internal.github.refreshGithubTokenInternal, { clerkUserId });
      if (!refreshResult.success) {
        return { token: null, error: refreshResult.error };
      }

      // Get the fresh token
      const freshTokenInfo = await ctx.runQuery(internal.github.getGithubTokenInfo, { clerkUserId });
      if (!freshTokenInfo?.accessToken) {
        return { token: null, error: "Failed to retrieve refreshed token" };
      }

      return { token: freshTokenInfo.accessToken };
    }

    return { token: tokenInfo.accessToken ?? null };
  },
});

/**
 * Internal version of refreshGithubToken (for use within actions).
 */
export const refreshGithubTokenInternal = internalAction({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }): Promise<{ success: boolean; error?: string }> => {
    // Get current token info
    const tokenInfo = await ctx.runQuery(internal.github.getGithubTokenInfo, { clerkUserId });

    if (!tokenInfo) {
      return { success: false, error: "User not found" };
    }

    if (!tokenInfo.githubExternalAccountId) {
      return { success: false, error: "No GitHub account linked" };
    }

    // Fetch fresh token from Clerk Backend API
    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      return { success: false, error: "CLERK_SECRET_KEY not configured" };
    }

    try {
      const response = await fetch(
        `https://api.clerk.com/v1/users/${clerkUserId}/oauth_access_tokens/github`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${clerkSecretKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Clerk API error:", response.status, errorText);

        if (response.status === 404) {
          return { success: false, error: "GitHub OAuth connection not found" };
        }

        return { success: false, error: `Clerk API error: ${response.status}` };
      }

      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) {
        return { success: false, error: "No GitHub OAuth token available" };
      }

      const tokenData = data[0];
      const accessToken = tokenData.token;
      const scopes = tokenData.scopes || [];
      const expiresAt = tokenData.expires_at
        ? new Date(tokenData.expires_at).getTime()
        : Date.now() + (60 * 60 * 1000);

      await ctx.runMutation(internal.github.storeGithubOAuthToken, {
        clerkUserId,
        accessToken,
        scopes,
        expiresAt,
      });

      return { success: true };
    } catch (error) {
      console.error("Failed to refresh GitHub token:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  },
});

/**
 * Query to check GitHub connection status for the UI.
 */
export const getGithubConnectionStatus = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .first();

    if (!user) {
      return {
        isConnected: false,
        githubUsername: null,
        hasValidToken: false,
        scopes: [] as string[],
        lastTokenFetch: null as number | null,
      };
    }

    const hasValidToken = !!user.githubAccessToken &&
      (!user.githubTokenExpiresAt || user.githubTokenExpiresAt > Date.now());

    return {
      isConnected: !!user.githubExternalAccountId,
      githubUsername: user.githubUsername || null,
      hasValidToken,
      scopes: user.githubScopes || [],
      lastTokenFetch: user.githubTokenLastFetchedAt || null,
    };
  },
});

/**
 * Unlink GitHub account (remove OAuth connection data).
 * Note: This doesn't revoke the OAuth token in Clerk/GitHub - user must do that manually.
 */
export const unlinkGithubAccount = mutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    await ctx.db.patch(user._id, {
      githubExternalAccountId: undefined,
      githubAccessToken: undefined,
      githubTokenExpiresAt: undefined,
      githubTokenLastFetchedAt: undefined,
      githubScopes: undefined,
      githubUsername: undefined,
      githubEmail: undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
