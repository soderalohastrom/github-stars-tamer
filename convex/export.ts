import { ConvexError, v } from "convex/values";
import { query } from "./_generated/server";

// Helper to format numbers nicely (1234 -> 1.2k)
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k";
  }
  return num.toString();
};

// Helper to get language color
const languageColors: Record<string, string> = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python: "#3572A5",
  Rust: "#dea584",
  Go: "#00ADD8",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  Ruby: "#701516",
  Swift: "#ffac45",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  PHP: "#4F5D95",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
};

// Export list to Markdown
export const exportListToMarkdown = query({
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
          listNotes: lr.notes,
        };
      })
    );

    const filteredRepos = repositories.filter(Boolean);

    // Generate Markdown
    let markdown = `# ${list.name}\n\n`;

    if (list.description) {
      markdown += `${list.description}\n\n`;
    }

    markdown += `> *${filteredRepos.length} repositories* | `;
    markdown += `*Created: ${new Date(list.createdAt).toLocaleDateString()}*\n\n`;
    markdown += `---\n\n`;
    markdown += `## Repositories\n\n`;

    for (const repo of filteredRepos) {
      if (!repo) continue;

      markdown += `### [${repo.name}](${repo.htmlUrl})\n\n`;

      if (repo.description) {
        markdown += `> ${repo.description}\n\n`;
      }

      // Stats line
      const stats = [];
      if (repo.language) {
        stats.push(`**Language:** ${repo.language}`);
      }
      stats.push(`**Stars:** ${formatNumber(repo.stargazersCount)}`);
      stats.push(`**Forks:** ${formatNumber(repo.forksCount)}`);

      markdown += stats.join(" | ") + "\n\n";

      // Topics
      if (repo.topics && repo.topics.length > 0) {
        markdown += `**Topics:** ${repo.topics.map((t: string) => `\`${t}\``).join(", ")}\n\n`;
      }

      // Custom notes
      if (repo.listNotes) {
        markdown += `*Note: ${repo.listNotes}*\n\n`;
      }

      markdown += `---\n\n`;
    }

    markdown += `\n*Exported from GitHub Stars Organizer*\n`;

    return {
      content: markdown,
      filename: `${list.name.toLowerCase().replace(/\s+/g, "-")}.md`,
    };
  },
});

// Export list to JSON
export const exportListToJson = query({
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
          githubId: repo.githubId,
          name: repo.name,
          fullName: repo.fullName,
          description: repo.description,
          htmlUrl: repo.htmlUrl,
          language: repo.language,
          stargazersCount: repo.stargazersCount,
          forksCount: repo.forksCount,
          topics: repo.topics,
          owner: {
            login: repo.owner.login,
            avatarUrl: repo.owner.avatarUrl,
          },
          starredAt: repo.starredAt,
          listNotes: lr.notes,
          addedToList: lr.addedAt,
        };
      })
    );

    const exportData = {
      exportedAt: new Date().toISOString(),
      exportVersion: "1.0",
      list: {
        name: list.name,
        description: list.description,
        visibility: list.visibility,
        shareId: list.shareId,
        createdAt: new Date(list.createdAt).toISOString(),
        repositoryCount: list.repositoryCount,
      },
      repositories: repositories.filter(Boolean),
    };

    return {
      content: JSON.stringify(exportData, null, 2),
      filename: `${list.name.toLowerCase().replace(/\s+/g, "-")}.json`,
    };
  },
});

// Export all user data (repos and categories)
export const exportAllData = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (!user) {
      throw new ConvexError("User not found");
    }

    // Get all repositories
    const repositories = await ctx.db
      .query("repositories")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    // Get all categories
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    // Get all repository-category mappings
    const repoCategoryMappings = await ctx.db
      .query("repositoryCategories")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .collect();

    // Get all lists
    const lists = await ctx.db
      .query("lists")
      .withIndex("by_owner_id", (q) => q.eq("ownerId", user._id))
      .collect();

    // Get all list repositories
    const listRepositories = await Promise.all(
      lists.map(async (list) => {
        const entries = await ctx.db
          .query("listRepositories")
          .withIndex("by_list_id", (q) => q.eq("listId", list._id))
          .collect();
        return {
          listId: list._id,
          listName: list.name,
          entries: entries.map((e) => ({
            repositoryId: e.repositoryId,
            notes: e.notes,
            sortOrder: e.sortOrder,
          })),
        };
      })
    );

    // Build category map for enrichment
    const categoryMap = new Map(categories.map((c) => [c._id, c]));

    // Enrich repositories with their categories
    const enrichedRepositories = repositories.map((repo) => {
      const repoCats = repoCategoryMappings.filter(
        (rc) => rc.repositoryId === repo._id
      );
      const cats = repoCats
        .map((rc) => categoryMap.get(rc.categoryId))
        .filter(Boolean);

      return {
        githubId: repo.githubId,
        name: repo.name,
        fullName: repo.fullName,
        description: repo.description,
        htmlUrl: repo.htmlUrl,
        language: repo.language,
        stargazersCount: repo.stargazersCount,
        forksCount: repo.forksCount,
        topics: repo.topics,
        owner: {
          login: repo.owner.login,
          avatarUrl: repo.owner.avatarUrl,
        },
        starredAt: repo.starredAt,
        notes: repo.notes,
        localTags: repo.localTags,
        categories: cats.map((c: any) => ({
          name: c.name,
          color: c.color,
        })),
      };
    });

    const exportData = {
      exportedAt: new Date().toISOString(),
      exportVersion: "1.0",
      user: {
        email: user.email,
        githubUsername: user.githubUsername,
      },
      stats: {
        totalRepositories: repositories.length,
        totalCategories: categories.length,
        totalLists: lists.length,
      },
      categories: categories.map((c) => ({
        name: c.name,
        description: c.description,
        color: c.color,
        icon: c.icon,
        repositoryCount: c.metadata?.repositoryCount || 0,
      })),
      lists: lists.map((l) => ({
        name: l.name,
        description: l.description,
        visibility: l.visibility,
        shareId: l.shareId,
        repositoryCount: l.repositoryCount,
      })),
      listRepositories,
      repositories: enrichedRepositories,
    };

    return {
      content: JSON.stringify(exportData, null, 2),
      filename: `github-stars-backup-${new Date().toISOString().split("T")[0]}.json`,
    };
  },
});
