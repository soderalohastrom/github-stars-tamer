import { ConvexError, v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { assertUserOwns, requireAuthenticatedActionUser } from "./authz";

// GitHub API configuration
const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";

// Maximum README excerpt length
const MAX_EXCERPT_LENGTH = 500;

// Rate limiting
const RATE_LIMIT_DELAY_MS = 100; // Delay between requests to avoid rate limiting

/**
 * Truncate README content to a reasonable excerpt
 * Attempts to truncate at sentence boundaries when possible
 */
function truncateReadme(content: string, maxLength: number = MAX_EXCERPT_LENGTH): string {
  if (content.length <= maxLength) {
    return content;
  }

  // Try to find a good break point (sentence end)
  const truncated = content.substring(0, maxLength);

  // Look for sentence endings
  const sentenceEnd = truncated.lastIndexOf('. ');
  if (sentenceEnd > maxLength * 0.5) {
    return truncated.substring(0, sentenceEnd + 1).trim();
  }

  // Look for paragraph break
  const paragraphEnd = truncated.lastIndexOf('\n\n');
  if (paragraphEnd > maxLength * 0.5) {
    return truncated.substring(0, paragraphEnd).trim();
  }

  // Fall back to word boundary
  const wordEnd = truncated.lastIndexOf(' ');
  if (wordEnd > maxLength * 0.7) {
    return truncated.substring(0, wordEnd).trim() + '...';
  }

  return truncated.trim() + '...';
}

/**
 * Clean markdown content for AI processing
 * Removes images, links, and code blocks while preserving text
 */
function cleanMarkdown(content: string): string {
  let cleaned = content;

  // Remove code blocks
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '[code block]');
  cleaned = cleaned.replace(/`[^`]+`/g, '[code]');

  // Remove images
  cleaned = cleaned.replace(/!\[.*?\]\(.*?\)/g, '');

  // Convert links to just their text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, '');

  // Remove badges (common in README files)
  cleaned = cleaned.replace(/\[!\[.*?\].*?\]/g, '');

  // Collapse multiple newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Fetch README from a GitHub repository
 */
export const fetchReadmeExcerpt = action({
  args: {
    clerkUserId: v.string(),
    repositoryId: v.id("repositories"),
    githubToken: v.optional(v.string()),
    forceRefresh: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    cached?: boolean;
    excerpt?: string | null;
    error?: string;
    message?: string;
  }> => {
    const user = await requireAuthenticatedActionUser(ctx, args.clerkUserId);

    // Keep the legacy githubToken argument for compatibility, but never use a
    // client-supplied credential. OAuth tokens stay in server-side actions.
    const tokenResult = await ctx.runAction(internal.github.getValidGithubTokenInternal, {
      clerkUserId: user.clerkUserId,
    });
    if (!tokenResult.token) {
      throw new ConvexError(tokenResult.error || "No GitHub token available");
    }

    return await ctx.runAction(internal.readme.fetchReadmeExcerptInternal, {
      userId: user._id,
      repositoryId: args.repositoryId,
      githubToken: tokenResult.token,
      forceRefresh: args.forceRefresh,
    });
  },
});

/**
 * Fetch READMEs for multiple repositories in batch
 */
export const fetchReadmesBatch = action({
  args: {
    clerkUserId: v.string(),
    repositoryIds: v.array(v.id("repositories")),
    githubToken: v.optional(v.string()),
    forceRefresh: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedActionUser(ctx, args.clerkUserId);
    const tokenResult = await ctx.runAction(internal.github.getValidGithubTokenInternal, {
      clerkUserId: user.clerkUserId,
    });
    if (!tokenResult.token) {
      throw new ConvexError(tokenResult.error || "No GitHub token available");
    }

    const results: {
      repositoryId: Id<"repositories">;
      success: boolean;
      cached: boolean;
      excerpt: string | null;
      error?: string;
    }[] = [];

    for (const repositoryId of args.repositoryIds) {
      try {
        // Add delay to avoid rate limiting
        if (results.length > 0) {
          await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
        }

        const result = await ctx.runAction(internal.readme.fetchReadmeExcerptInternal, {
          userId: user._id,
          repositoryId,
          githubToken: tokenResult.token,
          forceRefresh: args.forceRefresh,
        });

        results.push({
          repositoryId,
          ...result,
        });
      } catch (error) {
        results.push({
          repositoryId,
          success: false,
          cached: false,
          excerpt: null,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const cachedCount = results.filter((r) => r.cached).length;

    return {
      results,
      summary: {
        total: results.length,
        success: successCount,
        cached: cachedCount,
        fetched: successCount - cachedCount,
        failed: results.length - successCount,
      },
    };
  },
});

/**
 * Internal action for fetching README (used by batch)
 */
export const fetchReadmeExcerptInternal = internalAction({
  args: {
    userId: v.id("users"),
    repositoryId: v.id("repositories"),
    githubToken: v.string(),
    forceRefresh: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    cached: boolean;
    excerpt: string | null;
    error?: string;
    message?: string;
  }> => {
    const repository = await ctx.runQuery(internal.readme.getRepositoryById, {
      userId: args.userId,
      repositoryId: args.repositoryId,
    });

    if (!repository) {
      return {
        success: false,
        cached: false,
        excerpt: null,
        error: "Repository not found",
      };
    }

    // Check cache
    if (!args.forceRefresh && repository.readmeExcerpt && repository.readmeFetchedAt) {
      const cacheAge = Date.now() - repository.readmeFetchedAt;
      if (cacheAge < 7 * 24 * 60 * 60 * 1000) {
        return {
          success: true,
          cached: true,
          excerpt: repository.readmeExcerpt,
        };
      }
    }

    try {
      const response = await fetch(
        `${GITHUB_API_BASE}/repos/${repository.fullName}/readme`,
        {
          headers: {
            Authorization: `Bearer ${args.githubToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": GITHUB_API_VERSION,
          },
        }
      );

      if (response.status === 404) {
        await ctx.runMutation(internal.readme.updateReadmeExcerpt, {
          userId: args.userId,
          repositoryId: args.repositoryId,
          excerpt: null,
          sha: null,
        });
        return {
          success: true,
          cached: false,
          excerpt: null,
          message: "No README found",
        };
      }

      if (!response.ok) {
        return {
          success: false,
          cached: false,
          excerpt: null,
          error: `GitHub API error: ${response.status}`,
        };
      }

      const data = await response.json();
      const sha = data.sha;

      // Check SHA
      if (!args.forceRefresh && repository.readmeSha === sha && repository.readmeExcerpt) {
        return {
          success: true,
          cached: true,
          excerpt: repository.readmeExcerpt,
        };
      }

      // Decode and process (base64 line-wrapped by GitHub; V8 has no Buffer)
      const base64 = (data.content ?? "").replace(/\s/g, "");
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const content = new TextDecoder("utf-8").decode(bytes);
      const cleaned = cleanMarkdown(content);
      const excerpt = truncateReadme(cleaned);

      await ctx.runMutation(internal.readme.updateReadmeExcerpt, {
        userId: args.userId,
        repositoryId: args.repositoryId,
        excerpt,
        sha,
      });

      return {
        success: true,
        cached: false,
        excerpt,
      };
    } catch (error) {
      return {
        success: false,
        cached: false,
        excerpt: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Create a job to fetch READMEs for repositories
 */
export const createReadmeFetchJob = action({
  args: {
    clerkUserId: v.string(),
    repositoryIds: v.optional(v.array(v.id("repositories"))),
    fetchAll: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    message?: string;
    jobId: string | null;
    totalRepositories?: number;
    batchId?: string;
    repositoryCount?: number;
  }> => {
    const user = await requireAuthenticatedActionUser(ctx, args.clerkUserId);

    let repoIds = args.repositoryIds || [];

    if (args.fetchAll || repoIds.length === 0) {
      // Get all repositories without README excerpts
      repoIds = await ctx.runQuery(internal.readme.getRepositoriesWithoutReadme, {
        userId: user._id,
      });
    }

    if (repoIds.length === 0) {
      return {
        success: true,
        message: "No repositories need README fetching",
        jobId: null,
      };
    }

    // Create the job
    const batchId = `readme_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const jobId = await ctx.runMutation(internal.readme.createJob, {
      userId: user._id,
      repositoryIds: repoIds,
      batchId,
    });

    return {
      success: true,
      jobId,
      batchId,
      repositoryCount: repoIds.length,
    };
  },
});

// Internal queries and mutations

export const getRepositoryById = internalQuery({
  args: {
    userId: v.id("users"),
    repositoryId: v.id("repositories"),
  },
  handler: async (ctx, { userId, repositoryId }) => {
    const repository = await ctx.db.get(repositoryId);
    if (!repository || repository.userId !== userId) {
      return null;
    }
    return repository;
  },
});

export const getRepositoriesWithoutReadme = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const repositories = await ctx.db
      .query("repositories")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .collect();

    return repositories
      .filter((r) => !r.readmeExcerpt)
      .map((r) => r._id);
  },
});

export const updateReadmeExcerpt = internalMutation({
  args: {
    userId: v.id("users"),
    repositoryId: v.id("repositories"),
    excerpt: v.union(v.string(), v.null()),
    sha: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { userId, repositoryId, excerpt, sha }) => {
    const repository = await ctx.db.get(repositoryId);
    if (!repository) {
      throw new ConvexError("Repository not found or access denied");
    }
    assertUserOwns(repository.userId, userId, "Repository");

    await ctx.db.patch(repositoryId, {
      readmeExcerpt: excerpt ?? undefined,
      readmeSha: sha ?? undefined,
      readmeFetchedAt: Date.now(),
    });
  },
});

export const createJob = internalMutation({
  args: {
    userId: v.id("users"),
    repositoryIds: v.array(v.id("repositories")),
    batchId: v.string(),
  },
  handler: async (ctx, { userId, repositoryIds, batchId }) => {
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    for (const repositoryId of repositoryIds) {
      const repository = await ctx.db.get(repositoryId);
      if (!repository) {
        throw new ConvexError("Repository not found or access denied");
      }
      assertUserOwns(repository.userId, userId, "Repository");
    }

    return await ctx.db.insert("aiProcessingJobs", {
      userId,
      jobType: "fetch_readmes",
      status: "pending",
      repositoryIds,
      batchId,
      progress: {
        processed: 0,
        total: repositoryIds.length,
      },
      startedAt: Date.now(),
    });
  },
});
