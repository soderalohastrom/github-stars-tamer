import { expect, test, describe } from "vitest";
import { api, internal } from "../_generated/api";
import { createTestConvex } from "./setup.test-helper";

async function setupUser(t: any, clerkUserId = "clerk_123") {
  await t.mutation(api.users.upsertUserFromClerk, {
    clerkUserId,
    email: `${clerkUserId}@example.com`,
  });
  const profile = await t.query(api.users.getUserProfile, { clerkUserId });
  return { clerkUserId, userId: profile!._id };
}

async function insertRepo(t: any, userId: any, clerkUserId: string, overrides: any = {}) {
  const githubId = overrides.githubId ?? 1;
  await t.mutation(internal.repositories.upsertRepositories, {
    userId,
    repositories: [{
      githubId,
      name: overrides.name ?? `repo-${githubId}`,
      fullName: overrides.fullName ?? `owner/repo-${githubId}`,
      url: `https://api.github.com/repos/owner/repo-${githubId}`,
      htmlUrl: `https://github.com/owner/repo-${githubId}`,
      stargazersCount: overrides.stargazersCount ?? 100,
      forksCount: 5,
      size: 1000,
      defaultBranch: "main",
      topics: overrides.topics ?? ["typescript", "react"],
      isPrivate: false,
      isFork: false,
      hasIssues: true,
      hasWiki: true,
      archived: overrides.archived ?? false,
      disabled: false,
      language: overrides.language ?? "TypeScript",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-06-01T00:00:00Z",
      starredAt: overrides.starredAt ?? "2024-03-01T00:00:00Z",
      owner: overrides.owner ?? { login: "owner", id: 1, avatarUrl: "https://avatar.example.com", type: "User" },
    }],
  });
  const repos = await t.query(api.repositories.getUserRepositories, { clerkUserId });
  return repos.find((r: any) => r.githubId === githubId)!._id;
}

async function insertKnowledgePage(t: any, userId: any, repositoryId: any, overrides: any = {}) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("repoKnowledge", {
      userId,
      repositoryId,
      markdownContent: overrides.markdownContent ?? "# Test Repo\n\nA test repository.",
      summary: overrides.summary ?? "A test repository for unit testing.",
      keyFeatures: overrides.keyFeatures ?? ["Feature 1", "Feature 2"],
      stack: overrides.stack ?? {
        languages: ["TypeScript"],
        keyDeps: ["React", "Convex"],
      },
      whyNotable: overrides.whyNotable ?? ["Great for testing"],
      crossReferences: overrides.crossReferences ?? [],
      processedAt: overrides.processedAt ?? Date.now(),
      readmeSha: overrides.readmeSha ?? "abc123",
      readmeLength: overrides.readmeLength ?? 500,
      processingModel: overrides.processingModel ?? "claude-haiku-4-5",
      processingTokens: overrides.processingTokens ?? { input: 400, output: 200 },
      processingTimeMs: overrides.processingTimeMs ?? 1500,
      status: overrides.status ?? "processed",
      errorMessage: overrides.errorMessage,
    });
  });
}

describe("knowledge", () => {
  // ── Queries ──────────────────────────────────────

  describe("getKnowledgePages", () => {
    test("returns empty array for user with no knowledge pages", async () => {
      const t = createTestConvex();
      const { clerkUserId } = await setupUser(t);

      const pages = await t.query(api.knowledge.getKnowledgePages, { clerkUserId });
      expect(pages).toEqual([]);
    });

    test("returns knowledge pages joined with repo data", async () => {
      const t = createTestConvex();
      const { clerkUserId, userId } = await setupUser(t);
      const repoId = await insertRepo(t, userId, clerkUserId, {
        githubId: 1,
        name: "my-lib",
        fullName: "owner/my-lib",
        language: "TypeScript",
        stargazersCount: 500,
      });

      await insertKnowledgePage(t, userId, repoId, {
        summary: "A great library",
      });

      const pages = await t.query(api.knowledge.getKnowledgePages, { clerkUserId });
      expect(pages.length).toBe(1);
      expect(pages[0].summary).toBe("A great library");
      expect(pages[0].repository).not.toBeNull();
      expect(pages[0].repository!.fullName).toBe("owner/my-lib");
      expect(pages[0].repository!.language).toBe("TypeScript");
      expect(pages[0].repository!.stargazersCount).toBe(500);
    });

    test("does not leak pages across users", async () => {
      const t = createTestConvex();
      const { clerkUserId: user1, userId: userId1 } = await setupUser(t, "user_1");
      const { clerkUserId: user2 } = await setupUser(t, "user_2");
      const repoId = await insertRepo(t, userId1, user1);

      await insertKnowledgePage(t, userId1, repoId);

      const user2Pages = await t.query(api.knowledge.getKnowledgePages, { clerkUserId: user2 });
      expect(user2Pages).toEqual([]);
    });
  });

  describe("getKnowledgePage", () => {
    test("returns null when page does not exist", async () => {
      const t = createTestConvex();
      const { clerkUserId, userId } = await setupUser(t);
      const repoId = await insertRepo(t, userId, clerkUserId);

      const page = await t.query(api.knowledge.getKnowledgePage, {
        clerkUserId,
        repositoryId: repoId,
      });
      expect(page).toBeNull();
    });

    test("returns full page with enriched cross-references", async () => {
      const t = createTestConvex();
      const { clerkUserId, userId } = await setupUser(t);
      const repo1 = await insertRepo(t, userId, clerkUserId, { githubId: 1, fullName: "owner/repo-1" });
      const repo2 = await insertRepo(t, userId, clerkUserId, { githubId: 2, fullName: "owner/repo-2" });

      await insertKnowledgePage(t, userId, repo2, { summary: "Target repo" });
      await insertKnowledgePage(t, userId, repo1, {
        crossReferences: [{
          targetRepositoryId: repo2,
          reason: "Both use React",
          edgeType: "shared_topic",
        }],
      });

      const page = await t.query(api.knowledge.getKnowledgePage, {
        clerkUserId,
        repositoryId: repo1,
      });
      expect(page).not.toBeNull();
      expect(page!.crossReferences.length).toBe(1);
      expect(page!.crossReferences[0].targetRepoName).toBe("owner/repo-2");
      expect(page!.crossReferences[0].reason).toBe("Both use React");
    });
  });

  describe("getGraphData", () => {
    test("returns empty graph for user with no repos", async () => {
      const t = createTestConvex();
      const { clerkUserId } = await setupUser(t);

      const graph = await t.query(api.knowledge.getGraphData, { clerkUserId });
      expect(graph.nodes).toEqual([]);
      expect(graph.edges).toEqual([]);
    });

    test("returns nodes for all repos with correct status", async () => {
      const t = createTestConvex();
      const { clerkUserId, userId } = await setupUser(t);
      const repo1 = await insertRepo(t, userId, clerkUserId, {
        githubId: 1,
        fullName: "owner/processed-repo",
      });
      const repo2 = await insertRepo(t, userId, clerkUserId, {
        githubId: 2,
        fullName: "owner/unprocessed-repo",
      });

      await insertKnowledgePage(t, userId, repo1, {
        status: "processed",
        summary: "Processed repo summary",
      });

      const graph = await t.query(api.knowledge.getGraphData, { clerkUserId });
      expect(graph.nodes.length).toBe(2);

      const processedNode = graph.nodes.find((n: any) => n.label === "owner/processed-repo");
      const unprocessedNode = graph.nodes.find((n: any) => n.label === "owner/unprocessed-repo");
      expect(processedNode!.status).toBe("processed");
      expect(processedNode!.summary).toBe("Processed repo summary");
      expect(unprocessedNode!.status).toBe("unprocessed");
    });

    test("returns deduplicated edges from cross-references", async () => {
      const t = createTestConvex();
      const { clerkUserId, userId } = await setupUser(t);
      const repo1 = await insertRepo(t, userId, clerkUserId, { githubId: 1 });
      const repo2 = await insertRepo(t, userId, clerkUserId, { githubId: 2 });

      // Both repos reference each other — should result in one edge
      await insertKnowledgePage(t, userId, repo1, {
        crossReferences: [{
          targetRepositoryId: repo2,
          reason: "Both use TypeScript",
          edgeType: "shared_language",
        }],
      });
      await insertKnowledgePage(t, userId, repo2, {
        crossReferences: [{
          targetRepositoryId: repo1,
          reason: "Both use TypeScript",
          edgeType: "shared_language",
        }],
      });

      const graph = await t.query(api.knowledge.getGraphData, { clerkUserId });
      expect(graph.edges.length).toBe(1);
      expect(graph.edges[0].edgeType).toBe("shared_language");
    });
  });

  describe("getKnowledgeStatus", () => {
    test("returns zero counts for user with no repos", async () => {
      const t = createTestConvex();
      const { clerkUserId } = await setupUser(t);

      const status = await t.query(api.knowledge.getKnowledgeStatus, { clerkUserId });
      expect(status).toEqual({ total: 0, processed: 0, failed: 0, noReadme: 0, unprocessed: 0 });
    });

    test("returns correct counts by status", async () => {
      const t = createTestConvex();
      const { clerkUserId, userId } = await setupUser(t);
      const repo1 = await insertRepo(t, userId, clerkUserId, { githubId: 1 });
      const repo2 = await insertRepo(t, userId, clerkUserId, { githubId: 2 });
      const repo3 = await insertRepo(t, userId, clerkUserId, { githubId: 3 });
      const repo4 = await insertRepo(t, userId, clerkUserId, { githubId: 4 });

      await insertKnowledgePage(t, userId, repo1, { status: "processed" });
      await insertKnowledgePage(t, userId, repo2, { status: "failed", errorMessage: "LLM error" });
      await insertKnowledgePage(t, userId, repo3, { status: "no_readme" });
      // repo4 has no knowledge page (unprocessed)

      const status = await t.query(api.knowledge.getKnowledgeStatus, { clerkUserId });
      expect(status.total).toBe(4);
      expect(status.processed).toBe(1);
      expect(status.failed).toBe(1);
      expect(status.noReadme).toBe(1);
      expect(status.unprocessed).toBe(1);
    });
  });

  describe("searchKnowledge", () => {
    test("returns empty array when no matches", async () => {
      const t = createTestConvex();
      const { clerkUserId } = await setupUser(t);

      const results = await t.query(api.knowledge.searchKnowledge, {
        clerkUserId,
        searchText: "nonexistent",
      });
      expect(results).toEqual([]);
    });

    test("finds pages by markdown content", async () => {
      const t = createTestConvex();
      const { clerkUserId, userId } = await setupUser(t);
      const repoId = await insertRepo(t, userId, clerkUserId, {
        githubId: 1,
        fullName: "owner/graph-lib",
      });

      await insertKnowledgePage(t, userId, repoId, {
        markdownContent: "# Graph Library\n\nA force-directed graph visualization library for React applications.",
        summary: "Force-directed graph visualization library",
      });

      const results = await t.query(api.knowledge.searchKnowledge, {
        clerkUserId,
        searchText: "force-directed graph",
      });
      expect(results.length).toBe(1);
      expect(results[0].repository!.fullName).toBe("owner/graph-lib");
    });
  });

  // ── Mutations ────────────────────────────────────

  describe("startKnowledgeBuild", () => {
    test("throws when AI is not enabled", async () => {
      const t = createTestConvex();
      const { clerkUserId } = await setupUser(t);

      await expect(
        t.mutation(api.knowledge.startKnowledgeBuild, { clerkUserId })
      ).rejects.toThrow("AI features are not enabled");
    });

    test("throws when all repos are already processed", async () => {
      const t = createTestConvex();
      const { clerkUserId, userId } = await setupUser(t);

      // Enable AI
      await t.mutation(api.ai.updateAiSettings, {
        clerkUserId,
        enableAI: true,
        aiProvider: "claude",
        aiModel: "claude-haiku-4-5",
      });

      const repoId = await insertRepo(t, userId, clerkUserId);
      await insertKnowledgePage(t, userId, repoId, { status: "processed" });

      await expect(
        t.mutation(api.knowledge.startKnowledgeBuild, { clerkUserId })
      ).rejects.toThrow("All repositories have already been processed");
    });

    test("creates job and schedules batch for unprocessed repos", async () => {
      const t = createTestConvex();
      const { clerkUserId, userId } = await setupUser(t);

      await t.mutation(api.ai.updateAiSettings, {
        clerkUserId,
        enableAI: true,
        aiProvider: "claude",
        aiModel: "claude-haiku-4-5",
      });

      const repo1 = await insertRepo(t, userId, clerkUserId, { githubId: 1 });
      const repo2 = await insertRepo(t, userId, clerkUserId, { githubId: 2 });
      // Process repo1 — repo2 should be the one scheduled
      await insertKnowledgePage(t, userId, repo1, { status: "processed" });

      const result = await t.mutation(api.knowledge.startKnowledgeBuild, { clerkUserId });
      expect(result.totalToProcess).toBe(1);
      expect(result.jobId).toBeDefined();
      expect(result.batchId).toMatch(/^kb_/);
    });
  });

  describe("startKnowledgeUpdate", () => {
    test("returns zero when all repos are up to date", async () => {
      const t = createTestConvex();
      const { clerkUserId, userId } = await setupUser(t);

      await t.mutation(api.ai.updateAiSettings, {
        clerkUserId,
        enableAI: true,
        aiProvider: "claude",
        aiModel: "claude-haiku-4-5",
      });

      const repoId = await insertRepo(t, userId, clerkUserId, {
        starredAt: "2024-01-01T00:00:00Z",
      });
      await insertKnowledgePage(t, userId, repoId, {
        processedAt: new Date("2024-06-01").getTime(),
        status: "processed",
      });

      const result = await t.mutation(api.knowledge.startKnowledgeUpdate, { clerkUserId });
      expect(result.totalToProcess).toBe(0);
      expect(result.jobId).toBeNull();
    });

    test("picks up newly starred repos", async () => {
      const t = createTestConvex();
      const { clerkUserId, userId } = await setupUser(t);

      await t.mutation(api.ai.updateAiSettings, {
        clerkUserId,
        enableAI: true,
        aiProvider: "claude",
        aiModel: "claude-haiku-4-5",
      });

      // Already processed repo
      const repo1 = await insertRepo(t, userId, clerkUserId, {
        githubId: 1,
        starredAt: "2024-01-01T00:00:00Z",
      });
      await insertKnowledgePage(t, userId, repo1, {
        processedAt: new Date("2024-06-01").getTime(),
      });

      // New unprocessed repo
      await insertRepo(t, userId, clerkUserId, {
        githubId: 2,
        starredAt: "2024-12-01T00:00:00Z",
      });

      const result = await t.mutation(api.knowledge.startKnowledgeUpdate, { clerkUserId });
      expect(result.totalToProcess).toBe(1);
    });
  });

  // ── Internal Mutations ───────────────────────────

  describe("storeKnowledgePage", () => {
    test("inserts a new knowledge page", async () => {
      const t = createTestConvex();
      const { clerkUserId, userId } = await setupUser(t);
      const repoId = await insertRepo(t, userId, clerkUserId);

      const knowledgeId = await t.mutation(internal.knowledge.storeKnowledgePage, {
        userId,
        repositoryId: repoId,
        markdownContent: "# Test\n\nContent",
        summary: "Test summary",
        keyFeatures: ["Feature 1"],
        stack: { languages: ["TypeScript"], keyDeps: ["React"] },
        whyNotable: ["Notable thing"],
        crossReferences: [],
        processedAt: Date.now(),
        readmeSha: "sha123",
        readmeLength: 100,
        processingModel: "claude-haiku-4-5",
        status: "processed",
      });

      expect(knowledgeId).toBeDefined();

      const page = await t.query(api.knowledge.getKnowledgePage, {
        clerkUserId,
        repositoryId: repoId,
      });
      expect(page!.summary).toBe("Test summary");
    });

    test("upserts existing knowledge page", async () => {
      const t = createTestConvex();
      const { clerkUserId, userId } = await setupUser(t);
      const repoId = await insertRepo(t, userId, clerkUserId);

      // First insert
      await t.mutation(internal.knowledge.storeKnowledgePage, {
        userId,
        repositoryId: repoId,
        markdownContent: "# First",
        summary: "First version",
        keyFeatures: [],
        stack: { languages: [], keyDeps: [] },
        whyNotable: [],
        crossReferences: [],
        processedAt: Date.now(),
        processingModel: "claude-haiku-4-5",
        status: "processed",
      });

      // Upsert with updated summary
      await t.mutation(internal.knowledge.storeKnowledgePage, {
        userId,
        repositoryId: repoId,
        markdownContent: "# Updated",
        summary: "Updated version",
        keyFeatures: ["New feature"],
        stack: { languages: ["Rust"], keyDeps: [] },
        whyNotable: [],
        crossReferences: [],
        processedAt: Date.now(),
        processingModel: "claude-haiku-4-5",
        status: "processed",
      });

      // Should only have one page with updated content
      const pages = await t.query(api.knowledge.getKnowledgePages, { clerkUserId });
      expect(pages.length).toBe(1);
      expect(pages[0].summary).toBe("Updated version");
      expect(pages[0].keyFeatures).toEqual(["New feature"]);
    });
  });

  describe("updateKnowledgeCrossRefs", () => {
    test("updates cross-references and markdown", async () => {
      const t = createTestConvex();
      const { clerkUserId, userId } = await setupUser(t);
      const repo1 = await insertRepo(t, userId, clerkUserId, { githubId: 1 });
      const repo2 = await insertRepo(t, userId, clerkUserId, { githubId: 2 });

      const knowledgeId = await insertKnowledgePage(t, userId, repo1, {
        markdownContent: "# Repo\n\n## Related Repos\n\n*Cross-references populated after graph build.*",
        crossReferences: [],
      });

      await t.mutation(internal.knowledge.updateKnowledgeCrossRefs, {
        knowledgeId,
        crossReferences: [{
          targetRepositoryId: repo2,
          reason: "Both use React",
          edgeType: "shared_topic" as const,
        }],
        markdownContent: "# Repo\n\n## Related Repos\n\n- [[owner/repo-2]] — Both use React",
      });

      const page = await t.query(api.knowledge.getKnowledgePage, {
        clerkUserId,
        repositoryId: repo1,
      });
      expect(page!.crossReferences.length).toBe(1);
      expect(page!.markdownContent).toContain("[[owner/repo-2]]");
    });
  });

  describe("recordKnowledgeUsage", () => {
    test("records usage with knowledge_distillation type", async () => {
      const t = createTestConvex();
      const { userId } = await setupUser(t);

      const usageId = await t.mutation(internal.knowledge.recordKnowledgeUsage, {
        userId,
        provider: "claude",
        model: "claude-haiku-4-5",
        inputTokens: 500,
        outputTokens: 300,
        totalTokens: 800,
        estimatedCostUsd: 0.002,
        requestType: "knowledge_distillation",
      });

      expect(usageId).toBeDefined();
    });
  });

  describe('resolveWikilinks', () => {
    test('returns not_found for repos not in user collection', async () => {
      const t = createTestConvex();
      const { clerkUserId } = await setupUser(t);

      const results = await t.query(api.knowledge.resolveWikilinks, {
        clerkUserId,
        fullNames: ['unknown/repo'],
      });

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('not_found');
      expect(results[0].fullName).toBe('unknown/repo');
    });

    test('returns no_knowledge for repos without knowledge pages', async () => {
      const t = createTestConvex();
      const { clerkUserId, userId } = await setupUser(t);
      await insertRepo(t, userId, clerkUserId, { githubId: 10, fullName: 'owner/my-repo' });

      const results = await t.query(api.knowledge.resolveWikilinks, {
        clerkUserId,
        fullNames: ['owner/my-repo'],
      });

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('no_knowledge');
      expect(results[0].fullName).toBe('owner/my-repo');
      expect(results[0].repositoryId).toBeDefined();
    });

    test('returns has_knowledge for repos with processed knowledge pages', async () => {
      const t = createTestConvex();
      const { clerkUserId, userId } = await setupUser(t);
      const repoId = await insertRepo(t, userId, clerkUserId, { githubId: 20, fullName: 'owner/known-repo' });
      await insertKnowledgePage(t, userId, repoId);

      const results = await t.query(api.knowledge.resolveWikilinks, {
        clerkUserId,
        fullNames: ['owner/known-repo'],
      });

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('has_knowledge');
      expect(results[0].repositoryId).toBeDefined();
      expect(results[0].knowledgeId).toBeDefined();
    });

    test('handles mixed resolution statuses', async () => {
      const t = createTestConvex();
      const { clerkUserId, userId } = await setupUser(t);
      const repoId = await insertRepo(t, userId, clerkUserId, { githubId: 30, fullName: 'owner/with-knowledge' });
      await insertKnowledgePage(t, userId, repoId);
      await insertRepo(t, userId, clerkUserId, { githubId: 31, fullName: 'owner/no-knowledge' });

      const results = await t.query(api.knowledge.resolveWikilinks, {
        clerkUserId,
        fullNames: ['owner/with-knowledge', 'owner/no-knowledge', 'owner/not-starred'],
      });

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('has_knowledge');
      expect(results[1].status).toBe('no_knowledge');
      expect(results[2].status).toBe('not_found');
    });

    test('returns empty array for empty fullNames', async () => {
      const t = createTestConvex();
      const { clerkUserId } = await setupUser(t);

      const results = await t.query(api.knowledge.resolveWikilinks, {
        clerkUserId,
        fullNames: [],
      });

      expect(results).toHaveLength(0);
    });

    test('returns empty array for unknown user', async () => {
      const t = createTestConvex();

      const results = await t.query(api.knowledge.resolveWikilinks, {
        clerkUserId: 'nonexistent_user',
        fullNames: ['owner/repo'],
      });

      expect(results).toHaveLength(0);
    });
  });
});
