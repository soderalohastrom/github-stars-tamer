import { expect, test, describe } from "vitest";
import { api, internal } from "../_generated/api";
import { createTestConvex } from "./setup.test-helper";

// Helper to set up a user and return userId + clerkUserId
async function setupUser(t: any, clerkUserId = "clerk_123") {
  await t.mutation(api.users.upsertUserFromClerk, {
    clerkUserId,
    email: `${clerkUserId}@example.com`,
  });
  const profile = await t.query(api.users.getUserProfile, { clerkUserId });
  return { clerkUserId, userId: profile!._id };
}

// Minimal repo data matching the upsertRepositories schema
function makeRepo(overrides: Partial<{
  githubId: number;
  name: string;
  fullName: string;
  description: string;
  language: string;
  stargazersCount: number;
  topics: string[];
  isPrivate: boolean;
  isFork: boolean;
  archived: boolean;
}> = {}) {
  const githubId = overrides.githubId ?? 1;
  const name = overrides.name ?? "test-repo";
  return {
    githubId,
    name,
    fullName: overrides.fullName ?? `owner/${name}`,
    description: overrides.description,
    url: `https://api.github.com/repos/owner/${name}`,
    htmlUrl: `https://github.com/owner/${name}`,
    language: overrides.language,
    stargazersCount: overrides.stargazersCount ?? 10,
    forksCount: 2,
    size: 100,
    defaultBranch: "main",
    topics: overrides.topics ?? [],
    isPrivate: overrides.isPrivate ?? false,
    isFork: overrides.isFork ?? false,
    hasIssues: true,
    hasWiki: true,
    archived: overrides.archived ?? false,
    disabled: false,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-06-01T00:00:00Z",
    starredAt: "2024-03-01T00:00:00Z",
    owner: {
      login: "owner",
      id: 1,
      avatarUrl: "https://avatar.example.com",
      type: "User",
    },
  };
}

describe("repositories", () => {
  describe("upsertRepositories", () => {
    test("inserts new repositories", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      const result = await t.mutation(internal.repositories.upsertRepositories, {
        userId,
        repositories: [
          makeRepo({ githubId: 1, name: "repo-a" }),
          makeRepo({ githubId: 2, name: "repo-b" }),
        ],
      });

      expect(result.added).toBe(2);
      expect(result.updated).toBe(0);

      const repos = await t.query(api.repositories.getUserRepositories, {
        clerkUserId,
      });
      expect(repos.length).toBe(2);
    });

    test("updates existing repositories preserving notes and tags", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      // Insert
      await t.mutation(internal.repositories.upsertRepositories, {
        userId,
        repositories: [makeRepo({ githubId: 1, name: "repo-a", stargazersCount: 10 })],
      });

      // Add notes via updateRepositoryMetadata
      const repos = await t.query(api.repositories.getUserRepositories, { clerkUserId });
      await t.mutation(api.repositories.updateRepositoryMetadata, {
        clerkUserId,
        repositoryId: repos[0]._id,
        notes: "My custom notes",
        localTags: ["favorite"],
      });

      // Upsert again with updated stars
      const result = await t.mutation(internal.repositories.upsertRepositories, {
        userId,
        repositories: [makeRepo({ githubId: 1, name: "repo-a", stargazersCount: 50 })],
      });

      expect(result.added).toBe(0);
      expect(result.updated).toBe(1);

      // Verify notes/tags preserved, stars updated
      const updated = await t.query(api.repositories.getUserRepositories, { clerkUserId });
      expect(updated[0].stargazersCount).toBe(50);
      expect(updated[0].notes).toBe("My custom notes");
      expect(updated[0].localTags).toEqual(["favorite"]);
    });
  });

  describe("getRepository", () => {
    test("returns repo for correct user", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      await t.mutation(internal.repositories.upsertRepositories, {
        userId,
        repositories: [makeRepo({ githubId: 1, name: "my-repo" })],
      });

      const repos = await t.query(api.repositories.getUserRepositories, { clerkUserId });
      const repo = await t.query(api.repositories.getRepository, {
        userId,
        repositoryId: repos[0]._id,
      });
      expect(repo).not.toBeNull();
      expect(repo!.name).toBe("my-repo");
    });

    test("returns null for wrong user", async () => {
      const t = createTestConvex();
      const { userId } = await setupUser(t);
      const { userId: otherUserId } = await setupUser(t, "clerk_456");

      await t.mutation(internal.repositories.upsertRepositories, {
        userId,
        repositories: [makeRepo({ githubId: 1, name: "private-repo" })],
      });

      const repos = await t.query(api.repositories.getUserRepositories, {
        clerkUserId: "clerk_123",
      });
      const repo = await t.query(api.repositories.getRepository, {
        userId: otherUserId,
        repositoryId: repos[0]._id,
      });
      expect(repo).toBeNull();
    });
  });

  describe("getUserRepositories", () => {
    test("returns empty array for non-existent user", async () => {
      const t = createTestConvex();
      const repos = await t.query(api.repositories.getUserRepositories, {
        clerkUserId: "nonexistent",
      });
      expect(repos).toEqual([]);
    });

    test("filters by language", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      await t.mutation(internal.repositories.upsertRepositories, {
        userId,
        repositories: [
          makeRepo({ githubId: 1, name: "ts-repo", language: "TypeScript" }),
          makeRepo({ githubId: 2, name: "py-repo", language: "Python" }),
          makeRepo({ githubId: 3, name: "ts-repo-2", language: "TypeScript" }),
        ],
      });

      const repos = await t.query(api.repositories.getUserRepositories, {
        clerkUserId,
        filters: { language: "TypeScript" },
      });
      expect(repos.length).toBe(2);
      expect(repos.every((r: any) => r.language === "TypeScript")).toBe(true);
    });

    test("filters by star range", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      await t.mutation(internal.repositories.upsertRepositories, {
        userId,
        repositories: [
          makeRepo({ githubId: 1, name: "low", stargazersCount: 5 }),
          makeRepo({ githubId: 2, name: "mid", stargazersCount: 50 }),
          makeRepo({ githubId: 3, name: "high", stargazersCount: 500 }),
        ],
      });

      const repos = await t.query(api.repositories.getUserRepositories, {
        clerkUserId,
        filters: { minStars: 10, maxStars: 100 },
      });
      expect(repos.length).toBe(1);
      expect(repos[0].name).toBe("mid");
    });

    test("sorts by stars descending", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      await t.mutation(internal.repositories.upsertRepositories, {
        userId,
        repositories: [
          makeRepo({ githubId: 1, name: "low", stargazersCount: 5 }),
          makeRepo({ githubId: 2, name: "high", stargazersCount: 500 }),
          makeRepo({ githubId: 3, name: "mid", stargazersCount: 50 }),
        ],
      });

      const repos = await t.query(api.repositories.getUserRepositories, {
        clerkUserId,
        sort: "stars",
        direction: "desc",
      });
      expect(repos[0].name).toBe("high");
      expect(repos[1].name).toBe("mid");
      expect(repos[2].name).toBe("low");
    });

    test("respects limit", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      await t.mutation(internal.repositories.upsertRepositories, {
        userId,
        repositories: [
          makeRepo({ githubId: 1, name: "a" }),
          makeRepo({ githubId: 2, name: "b" }),
          makeRepo({ githubId: 3, name: "c" }),
        ],
      });

      const repos = await t.query(api.repositories.getUserRepositories, {
        clerkUserId,
        limit: 2,
      });
      expect(repos.length).toBe(2);
    });

    test("enriches repos with category data", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      await t.mutation(internal.repositories.upsertRepositories, {
        userId,
        repositories: [makeRepo({ githubId: 1, name: "categorized" })],
      });

      const catId = await t.mutation(api.categories.createCategory, {
        clerkUserId,
        name: "TestCat",
        color: "#ff0000",
      });

      const repos = await t.query(api.repositories.getUserRepositories, { clerkUserId });
      await t.mutation(api.repositories.addRepositoryToCategory, {
        clerkUserId,
        repositoryId: repos[0]._id,
        categoryId: catId,
      });

      const enriched = await t.query(api.repositories.getUserRepositories, { clerkUserId });
      expect(enriched[0].categories.length).toBe(1);
      expect(enriched[0].categories[0].name).toBe("TestCat");
    });
  });

  describe("addRepositoryToCategory / removeRepositoryFromCategory", () => {
    test("adds and removes repository from category", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      await t.mutation(internal.repositories.upsertRepositories, {
        userId,
        repositories: [makeRepo({ githubId: 1, name: "repo" })],
      });

      const catId = await t.mutation(api.categories.createCategory, {
        clerkUserId,
        name: "MyCat",
        color: "#123456",
      });

      const repos = await t.query(api.repositories.getUserRepositories, { clerkUserId });
      const repoId = repos[0]._id;

      // Add
      await t.mutation(api.repositories.addRepositoryToCategory, {
        clerkUserId,
        repositoryId: repoId,
        categoryId: catId,
      });

      let stats = await t.query(api.categories.getCategoryWithStats, {
        clerkUserId,
        categoryId: catId,
      });
      expect(stats.repositoryCount).toBe(1);

      // Duplicate add should throw
      await expect(
        t.mutation(api.repositories.addRepositoryToCategory, {
          clerkUserId,
          repositoryId: repoId,
          categoryId: catId,
        })
      ).rejects.toThrow("already in this category");

      // Remove
      await t.mutation(api.repositories.removeRepositoryFromCategory, {
        clerkUserId,
        repositoryId: repoId,
        categoryId: catId,
      });

      stats = await t.query(api.categories.getCategoryWithStats, {
        clerkUserId,
        categoryId: catId,
      });
      expect(stats.repositoryCount).toBe(0);
    });

    test("rejects adding repo from another user", async () => {
      const t = createTestConvex();
      const { userId } = await setupUser(t);
      const { clerkUserId: otherClerk } = await setupUser(t, "clerk_456");

      await t.mutation(internal.repositories.upsertRepositories, {
        userId,
        repositories: [makeRepo({ githubId: 1, name: "repo" })],
      });

      const catId = await t.mutation(api.categories.createCategory, {
        clerkUserId: otherClerk,
        name: "OtherCat",
        color: "#999999",
      });

      const repos = await t.query(api.repositories.getUserRepositories, {
        clerkUserId: "clerk_123",
      });

      await expect(
        t.mutation(api.repositories.addRepositoryToCategory, {
          clerkUserId: otherClerk,
          repositoryId: repos[0]._id,
          categoryId: catId,
        })
      ).rejects.toThrow();
    });
  });

  describe("getRepositoryStats", () => {
    test("returns correct aggregated stats", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      await t.mutation(internal.repositories.upsertRepositories, {
        userId,
        repositories: [
          makeRepo({ githubId: 1, name: "ts1", language: "TypeScript", stargazersCount: 100, topics: ["react", "web"] }),
          makeRepo({ githubId: 2, name: "ts2", language: "TypeScript", stargazersCount: 200, topics: ["react"] }),
          makeRepo({ githubId: 3, name: "py1", language: "Python", stargazersCount: 50, topics: ["ml"] }),
        ],
      });

      const stats = await t.query(api.repositories.getRepositoryStats, { clerkUserId });
      expect(stats.totalCount).toBe(3);
      expect(stats.totalStars).toBe(350);
      expect(stats.averageStars).toBe(117); // Math.round(350/3)
      expect(stats.topLanguages[0].language).toBe("TypeScript");
      expect(stats.topLanguages[0].count).toBe(2);
      expect(stats.topTopics[0].topic).toBe("react");
      expect(stats.topTopics[0].count).toBe(2);
    });

    test("returns defaults for non-existent user", async () => {
      const t = createTestConvex();
      const stats = await t.query(api.repositories.getRepositoryStats, {
        clerkUserId: "nonexistent",
      });
      expect(stats.totalCount).toBe(0);
      expect(stats.totalStars).toBe(0);
    });
  });

  describe("getLanguages / getTopics", () => {
    test("returns language counts sorted by frequency", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      await t.mutation(internal.repositories.upsertRepositories, {
        userId,
        repositories: [
          makeRepo({ githubId: 1, name: "a", language: "Go" }),
          makeRepo({ githubId: 2, name: "b", language: "TypeScript" }),
          makeRepo({ githubId: 3, name: "c", language: "TypeScript" }),
        ],
      });

      const languages = await t.query(api.repositories.getLanguages, { clerkUserId });
      expect(languages[0].language).toBe("TypeScript");
      expect(languages[0].count).toBe(2);
      expect(languages[1].language).toBe("Go");
      expect(languages[1].count).toBe(1);
    });

    test("returns topic counts sorted by frequency", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      await t.mutation(internal.repositories.upsertRepositories, {
        userId,
        repositories: [
          makeRepo({ githubId: 1, name: "a", topics: ["react", "web"] }),
          makeRepo({ githubId: 2, name: "b", topics: ["react", "mobile"] }),
        ],
      });

      const topics = await t.query(api.repositories.getTopics, { clerkUserId });
      expect(topics[0].topic).toBe("react");
      expect(topics[0].count).toBe(2);
    });
  });

  describe("removeRepositoryByGitHubId", () => {
    test("removes repository by owner/repo fullName", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      await t.mutation(internal.repositories.upsertRepositories, {
        userId,
        repositories: [makeRepo({ githubId: 1, name: "target", fullName: "owner/target" })],
      });

      await t.mutation(internal.repositories.removeRepositoryByGitHubId, {
        userId,
        owner: "owner",
        repo: "target",
      });

      const repos = await t.query(api.repositories.getUserRepositories, { clerkUserId });
      expect(repos.length).toBe(0);
    });
  });
});
