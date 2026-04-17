import { expect, test, describe } from "vitest";
import { api, internal } from "../_generated/api";
import { createTestConvex } from "./setup.test-helper";
import { buildSearchText } from "../search";

// Helper to set up a user
async function setupUser(t: any, clerkUserId = "clerk_123") {
  await t.mutation(api.users.upsertUserFromClerk, {
    clerkUserId,
    email: `${clerkUserId}@example.com`,
  });
  const profile = await t.query(api.users.getUserProfile, { clerkUserId });
  return { clerkUserId, userId: profile!._id };
}

function makeRepo(overrides: Partial<{
  githubId: number;
  name: string;
  fullName: string;
  description: string;
  language: string;
  stargazersCount: number;
  topics: string[];
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
    isPrivate: false,
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

describe("search", () => {
  describe("buildSearchText (pure function)", () => {
    test("concatenates all fields lowercase", () => {
      const result = buildSearchText({
        name: "MyRepo",
        fullName: "owner/MyRepo",
        description: "A great project",
        topics: ["react", "typescript"],
        owner: { login: "owner" },
      });
      expect(result).toBe("myrepo owner/myrepo a great project react typescript owner");
    });

    test("handles missing description", () => {
      const result = buildSearchText({
        name: "Repo",
        fullName: "org/Repo",
        description: undefined,
        topics: [],
        owner: { login: "org" },
      });
      expect(result).toContain("repo");
      expect(result).toContain("org/repo");
      expect(result).toContain("org");
    });

    test("handles null description", () => {
      const result = buildSearchText({
        name: "Repo",
        fullName: "org/Repo",
        description: null,
        topics: ["ai"],
        owner: { login: "org" },
      });
      expect(result).toBe("repo org/repo  ai org");
    });
  });

  describe("searchRepositories (query)", () => {
    test("returns empty results for non-existent user", async () => {
      const t = createTestConvex();
      const result = await t.query(api.search.searchRepositories, {
        clerkUserId: "nonexistent",
      });
      expect(result.results).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.nextCursor).toBeNull();
    });

    test("returns all repos without query", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      await t.mutation(internal.repositories.upsertRepositories, {
        userId,
        repositories: [
          makeRepo({ githubId: 1, name: "alpha" }),
          makeRepo({ githubId: 2, name: "beta" }),
        ],
      });

      const result = await t.query(api.search.searchRepositories, { clerkUserId });
      expect(result.totalCount).toBe(2);
      expect(result.results.length).toBe(2);
    });

    test("filters by language", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      await t.mutation(internal.repositories.upsertRepositories, {
        userId,
        repositories: [
          makeRepo({ githubId: 1, name: "ts", language: "TypeScript" }),
          makeRepo({ githubId: 2, name: "py", language: "Python" }),
        ],
      });

      const result = await t.query(api.search.searchRepositories, {
        clerkUserId,
        filters: { language: "Python" },
      });
      expect(result.totalCount).toBe(1);
      expect(result.results[0].name).toBe("py");
    });

    test("filters by star range", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      await t.mutation(internal.repositories.upsertRepositories, {
        userId,
        repositories: [
          makeRepo({ githubId: 1, name: "small", stargazersCount: 5 }),
          makeRepo({ githubId: 2, name: "big", stargazersCount: 500 }),
        ],
      });

      const result = await t.query(api.search.searchRepositories, {
        clerkUserId,
        filters: { minStars: 100 },
      });
      expect(result.totalCount).toBe(1);
      expect(result.results[0].name).toBe("big");
    });

    test("paginates with cursor", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      await t.mutation(internal.repositories.upsertRepositories, {
        userId,
        repositories: Array.from({ length: 5 }, (_, i) =>
          makeRepo({ githubId: i + 1, name: `repo-${i}` })
        ),
      });

      const page1 = await t.query(api.search.searchRepositories, {
        clerkUserId,
        limit: 3,
      });
      expect(page1.results.length).toBe(3);
      expect(page1.nextCursor).not.toBeNull();
      expect(page1.totalCount).toBe(5);

      const page2 = await t.query(api.search.searchRepositories, {
        clerkUserId,
        limit: 3,
        cursor: page1.nextCursor!,
      });
      expect(page2.results.length).toBe(2);
      expect(page2.nextCursor).toBeNull();
    });

    test("sorts by stargazersCount ascending", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      await t.mutation(internal.repositories.upsertRepositories, {
        userId,
        repositories: [
          makeRepo({ githubId: 1, name: "high", stargazersCount: 500 }),
          makeRepo({ githubId: 2, name: "low", stargazersCount: 5 }),
          makeRepo({ githubId: 3, name: "mid", stargazersCount: 50 }),
        ],
      });

      const result = await t.query(api.search.searchRepositories, {
        clerkUserId,
        sort: { field: "stargazersCount", order: "asc" },
      });
      expect(result.results[0].name).toBe("low");
      expect(result.results[1].name).toBe("mid");
      expect(result.results[2].name).toBe("high");
    });

    test("enriches results with categories", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      await t.mutation(internal.repositories.upsertRepositories, {
        userId,
        repositories: [makeRepo({ githubId: 1, name: "categorized" })],
      });

      const catId = await t.mutation(api.categories.createCategory, {
        clerkUserId,
        name: "SearchCat",
        color: "#abcdef",
      });

      // Get repo ID, then categorize
      const allRepos = await t.query(api.repositories.getUserRepositories, { clerkUserId });
      await t.mutation(api.repositories.addRepositoryToCategory, {
        clerkUserId,
        repositoryId: allRepos[0]._id,
        categoryId: catId,
      });

      const result = await t.query(api.search.searchRepositories, { clerkUserId });
      expect(result.results[0].categories.length).toBe(1);
      expect(result.results[0].categories[0].name).toBe("SearchCat");
    });
  });

  describe("recordSearch", () => {
    test("records search in history", async () => {
      const t = createTestConvex();
      const { clerkUserId } = await setupUser(t);

      await t.mutation(api.search.recordSearch, {
        clerkUserId,
        query: "react hooks",
        resultCount: 5,
      });

      const recent = await t.query(api.search.getRecentSearches, { clerkUserId });
      expect(recent.length).toBe(1);
      expect(recent[0].query).toBe("react hooks");
      expect(recent[0].resultCount).toBe(5);
    });
  });

  describe("getRecentSearches", () => {
    test("deduplicates by query string", async () => {
      const t = createTestConvex();
      const { clerkUserId } = await setupUser(t);

      await t.mutation(api.search.recordSearch, {
        clerkUserId,
        query: "react",
        resultCount: 10,
      });
      await t.mutation(api.search.recordSearch, {
        clerkUserId,
        query: "React",
        resultCount: 10,
      });
      await t.mutation(api.search.recordSearch, {
        clerkUserId,
        query: "vue",
        resultCount: 3,
      });

      const recent = await t.query(api.search.getRecentSearches, { clerkUserId });
      // "react" and "React" should deduplicate (case-insensitive)
      const queries = recent.map((s: any) => s.query.toLowerCase());
      const uniqueQueries = [...new Set(queries)];
      expect(uniqueQueries.length).toBe(queries.length);
    });

    test("respects limit", async () => {
      const t = createTestConvex();
      const { clerkUserId } = await setupUser(t);

      for (let i = 0; i < 5; i++) {
        await t.mutation(api.search.recordSearch, {
          clerkUserId,
          query: `query-${i}`,
          resultCount: i,
        });
      }

      const recent = await t.query(api.search.getRecentSearches, {
        clerkUserId,
        limit: 2,
      });
      expect(recent.length).toBeLessThanOrEqual(2);
    });
  });

  describe("updateSearchTextForUser", () => {
    test("backfills searchText for all repos", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      await t.mutation(internal.repositories.upsertRepositories, {
        userId,
        repositories: [
          makeRepo({ githubId: 1, name: "alpha", description: "First repo" }),
          makeRepo({ githubId: 2, name: "beta", description: "Second repo" }),
        ],
      });

      const result = await t.mutation(api.search.updateSearchTextForUser, {
        clerkUserId,
      });
      expect(result.total).toBe(2);
    });
  });
});
