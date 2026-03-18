import { ConvexError, v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { getUserByClerkIdHelper as getUserByClerkId } from "./users";

// GitHub API configuration
const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";
const RATE_LIMIT_THRESHOLD = 100;

/**
 * Helper to make GitHub API request with token refresh on 401.
 * Returns the response and updated token (if refreshed).
 */
async function fetchGitHubWithRetry(
  ctx: any,
  clerkUserId: string,
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<{ response: Response; token: string }> {
  const makeRequest = async (accessToken: string) => {
    return await fetch(url, {
      ...options,
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        ...options.headers,
      },
    });
  };

  let response = await makeRequest(token);

  // If 401, try to refresh token and retry once
  if (response.status === 401) {
    console.log("GitHub API returned 401, attempting token refresh...");

    const refreshResult = await ctx.runAction(internal.github.refreshGithubTokenInternal, {
      clerkUserId,
    });

    if (!refreshResult.success) {
      throw new ConvexError(`GitHub token expired and refresh failed: ${refreshResult.error}`);
    }

    // Get the fresh token
    const tokenInfo = await ctx.runQuery(internal.github.getGithubTokenInfo, { clerkUserId });
    if (!tokenInfo?.accessToken) {
      throw new ConvexError("Failed to get refreshed GitHub token");
    }

    // Retry the request with the new token
    response = await makeRequest(tokenInfo.accessToken);
    return { response, token: tokenInfo.accessToken };
  }

  return { response, token };
}

// Sync user's starred repositories from GitHub
// Now fetches token from database via OAuth instead of requiring it as parameter
export const syncStarredRepositories = action({
  args: {
    clerkUserId: v.string(),
    // githubToken is now optional for backward compatibility but deprecated
    githubToken: v.optional(v.string()),
    fullSync: v.optional(v.boolean()), // Full sync vs incremental
  },
  handler: async (ctx, { clerkUserId, githubToken: providedToken, fullSync = false }) => {
    console.log(`Starting sync for user ${clerkUserId}, fullSync: ${fullSync}`);

    const user = await ctx.runQuery(internal.users.getUserByClerkId, { clerkUserId });
    if (!user) {
      throw new ConvexError("User not found");
    }

    // Get GitHub token - prefer OAuth token from database, fall back to provided token
    let githubToken: string;

    if (providedToken) {
      // Legacy path: use provided token (backward compatibility)
      console.log("Using provided GitHub token (legacy mode)");
      githubToken = providedToken;
    } else {
      // OAuth path: get token from database, refreshing if needed
      console.log("Fetching GitHub OAuth token from database...");
      const tokenResult = await ctx.runAction(internal.github.getValidGithubTokenInternal, {
        clerkUserId,
      });

      if (!tokenResult.token) {
        throw new ConvexError(tokenResult.error || "No GitHub token available. Please connect your GitHub account.");
      }

      githubToken = tokenResult.token;
    }

    // Start sync record
    const syncId = await ctx.runMutation(internal.syncHistory.createSyncRecord, {
      userId: user._id,
      syncType: fullSync ? "full" : "incremental",
    });

    try {
      let page = 1;
      let allRepositories: any[] = [];
      let hasMore = true;
      let apiCallCount = 0;
      let rateLimitInfo = { remaining: 5000, reset: 0 };
      let currentToken = githubToken;

      while (hasMore) {
        console.log(`Fetching page ${page}...`);

        // Check rate limit before making request
        if (rateLimitInfo.remaining < RATE_LIMIT_THRESHOLD) {
          console.log(`Rate limit low (${rateLimitInfo.remaining}), waiting...`);
          const waitTime = Math.max(0, rateLimitInfo.reset * 1000 - Date.now());
          if (waitTime > 0) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }

        const { response, token: updatedToken } = await fetchGitHubWithRetry(
          ctx,
          clerkUserId,
          `${GITHUB_API_BASE}/user/starred?per_page=100&page=${page}&sort=created&direction=desc`,
          currentToken
        );

        // Update token if it was refreshed
        currentToken = updatedToken;
        apiCallCount++;

        // Update rate limit info
        rateLimitInfo = {
          remaining: parseInt(response.headers.get("x-ratelimit-remaining") || "0"),
          reset: parseInt(response.headers.get("x-ratelimit-reset") || "0"),
        };

        if (!response.ok) {
          if (response.status === 401) {
            throw new ConvexError("GitHub token is invalid or expired. Please reconnect your GitHub account.");
          }
          if (response.status === 403) {
            throw new ConvexError("GitHub API rate limit exceeded");
          }
          throw new ConvexError(`GitHub API error: ${response.status} ${response.statusText}`);
        }

        const repositories = await response.json();

        if (repositories.length === 0) {
          hasMore = false;
          break;
        }

        // Transform GitHub API response to our format
        const transformedRepos = repositories.map((repo: any) => ({
          githubId: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description || undefined,
          url: repo.url,
          htmlUrl: repo.html_url,
          language: repo.language || undefined,
          stargazersCount: repo.stargazers_count,
          forksCount: repo.forks_count,
          size: repo.size,
          defaultBranch: repo.default_branch,
          topics: repo.topics || [],
          isPrivate: repo.private,
          isFork: repo.fork,
          hasIssues: repo.has_issues,
          hasWiki: repo.has_wiki,
          archived: repo.archived,
          disabled: repo.disabled,
          pushedAt: repo.pushed_at || undefined,
          createdAt: repo.created_at,
          updatedAt: repo.updated_at,
          starredAt: repo.starred_at || repo.created_at, // Fallback if starred_at not available
          owner: {
            login: repo.owner.login,
            id: repo.owner.id,
            avatarUrl: repo.owner.avatar_url,
            type: repo.owner.type,
          },
          license: repo.license ? {
            key: repo.license.key,
            name: repo.license.name,
            url: repo.license.url || undefined,
          } : undefined,
        }));

        allRepositories.push(...transformedRepos);

        // Check if there are more pages
        const linkHeader = response.headers.get("link");
        hasMore = linkHeader ? linkHeader.includes('rel="next"') : false;
        page++;

        // For incremental sync, stop after first page if we find repositories we already have
        if (!fullSync && page > 1) {
          // Check if we've seen the latest repos before
          const latestRepo = transformedRepos[0];
          if (latestRepo) {
            const existing = await ctx.runQuery(internal.repositories.getRepositoryByGitHubId, {
              userId: user._id,
              githubId: latestRepo.githubId,
            });
            if (existing && existing.starredAt === latestRepo.starredAt) {
              console.log("Found existing repository, stopping incremental sync");
              hasMore = false;
            }
          }
        }
      }

      console.log(`Fetched ${allRepositories.length} repositories`);

      // Upsert repositories in batches
      const batchSize = 50;
      let processed = 0;
      let added = 0;
      let updated = 0;

      for (let i = 0; i < allRepositories.length; i += batchSize) {
        const batch = allRepositories.slice(i, i + batchSize);
        const result = await ctx.runMutation(internal.repositories.upsertRepositories, {
          userId: user._id,
          repositories: batch,
        });

        processed += batch.length;
        added += result.added;
        updated += result.updated;

        console.log(`Processed ${processed}/${allRepositories.length} repositories`);
      }

      // Update sync record
      await ctx.runMutation(internal.syncHistory.completeSyncRecord, {
        syncId,
        repositoriesProcessed: processed,
        repositoriesAdded: added,
        repositoriesUpdated: updated,
        repositoriesRemoved: 0, // We don't remove repos in this implementation
        rateLimitRemaining: rateLimitInfo.remaining,
        rateLimitReset: rateLimitInfo.reset,
        totalApiCalls: apiCallCount,
      });

      // Update user's last sync time
      await ctx.runMutation(internal.users.updateLastSyncTime, {
        userId: user._id,
        syncTime: Date.now(),
      });

      console.log(`Sync completed: ${added} added, ${updated} updated`);

      return {
        success: true,
        repositoriesProcessed: processed,
        repositoriesAdded: added,
        repositoriesUpdated: updated,
        apiCallsUsed: apiCallCount,
        rateLimitRemaining: rateLimitInfo.remaining,
      };
    } catch (error) {
      console.error("Sync failed:", error);

      // Mark sync as failed
      await ctx.runMutation(internal.syncHistory.failSyncRecord, {
        syncId,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    }
  },
});

// Star a repository via GitHub API
// Now uses OAuth token from database with optional legacy token parameter
export const starRepository = action({
  args: {
    clerkUserId: v.string(),
    githubToken: v.optional(v.string()), // Now optional for OAuth
    owner: v.string(),
    repo: v.string(),
  },
  handler: async (ctx, { clerkUserId, githubToken: providedToken, owner, repo }) => {
    // Get token (OAuth or provided)
    let token: string;
    if (providedToken) {
      token = providedToken;
    } else {
      const tokenResult = await ctx.runAction(internal.github.getValidGithubTokenInternal, { clerkUserId });
      if (!tokenResult.token) {
        throw new ConvexError(tokenResult.error || "No GitHub token available");
      }
      token = tokenResult.token;
    }

    const { response } = await fetchGitHubWithRetry(
      ctx,
      clerkUserId,
      `${GITHUB_API_BASE}/user/starred/${owner}/${repo}`,
      token,
      {
        method: "PUT",
        headers: { "Content-Length": "0" },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new ConvexError("GitHub token is invalid or expired. Please reconnect your GitHub account.");
      }
      throw new ConvexError(`Failed to star repository: ${response.status}`);
    }

    return { success: true };
  },
});

// Unstar a repository via GitHub API
// Now uses OAuth token from database with optional legacy token parameter
export const unstarRepository = action({
  args: {
    clerkUserId: v.string(),
    githubToken: v.optional(v.string()), // Now optional for OAuth
    owner: v.string(),
    repo: v.string(),
  },
  handler: async (ctx, { clerkUserId, githubToken: providedToken, owner, repo }) => {
    // Get token (OAuth or provided)
    let token: string;
    if (providedToken) {
      token = providedToken;
    } else {
      const tokenResult = await ctx.runAction(internal.github.getValidGithubTokenInternal, { clerkUserId });
      if (!tokenResult.token) {
        throw new ConvexError(tokenResult.error || "No GitHub token available");
      }
      token = tokenResult.token;
    }

    const { response } = await fetchGitHubWithRetry(
      ctx,
      clerkUserId,
      `${GITHUB_API_BASE}/user/starred/${owner}/${repo}`,
      token,
      { method: "DELETE" }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new ConvexError("GitHub token is invalid or expired. Please reconnect your GitHub account.");
      }
      throw new ConvexError(`Failed to unstar repository: ${response.status}`);
    }

    // Remove from local database
    const user = await ctx.runQuery(internal.users.getUserByClerkId, { clerkUserId });
    if (user) {
      await ctx.runMutation(internal.repositories.removeRepositoryByGitHubId, {
        userId: user._id,
        owner,
        repo,
      });
    }

    return { success: true };
  },
});

// Check if repository is starred
// Now uses OAuth token from database with optional legacy token parameter
export const isRepositoryStarred = action({
  args: {
    clerkUserId: v.string(),
    githubToken: v.optional(v.string()), // Now optional for OAuth
    owner: v.string(),
    repo: v.string(),
  },
  handler: async (ctx, { clerkUserId, githubToken: providedToken, owner, repo }) => {
    // Get token (OAuth or provided)
    let token: string;
    if (providedToken) {
      token = providedToken;
    } else {
      const tokenResult = await ctx.runAction(internal.github.getValidGithubTokenInternal, { clerkUserId });
      if (!tokenResult.token) {
        throw new ConvexError(tokenResult.error || "No GitHub token available");
      }
      token = tokenResult.token;
    }

    const { response } = await fetchGitHubWithRetry(
      ctx,
      clerkUserId,
      `${GITHUB_API_BASE}/user/starred/${owner}/${repo}`,
      token
    );

    return { isStarred: response.status === 204 };
  },
});

// Get GitHub rate limit status
// Now uses OAuth token from database with optional legacy token parameter
export const getRateLimitStatus = action({
  args: {
    clerkUserId: v.optional(v.string()), // Required for OAuth path
    githubToken: v.optional(v.string()), // Now optional for OAuth
  },
  handler: async (ctx, { clerkUserId, githubToken: providedToken }) => {
    // Get token (OAuth or provided)
    let token: string;
    if (providedToken) {
      token = providedToken;
    } else if (clerkUserId) {
      const tokenResult = await ctx.runAction(internal.github.getValidGithubTokenInternal, { clerkUserId });
      if (!tokenResult.token) {
        throw new ConvexError(tokenResult.error || "No GitHub token available");
      }
      token = tokenResult.token;
    } else {
      throw new ConvexError("Either clerkUserId or githubToken must be provided");
    }

    const response = await fetch(
      `${GITHUB_API_BASE}/rate_limit`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": GITHUB_API_VERSION,
        },
      }
    );

    if (!response.ok) {
      throw new ConvexError("Failed to get rate limit status");
    }

    const data = await response.json();

    return {
      core: {
        limit: data.resources.core.limit,
        remaining: data.resources.core.remaining,
        reset: data.resources.core.reset,
        used: data.resources.core.used,
      },
      search: {
        limit: data.resources.search.limit,
        remaining: data.resources.search.remaining,
        reset: data.resources.search.reset,
        used: data.resources.search.used,
      },
    };
  },
});
