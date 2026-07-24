import { expect, test, describe } from "vitest";
import { api, internal } from "../_generated/api";
import { createTestConvex } from "./setup.test-helper";

async function setupUser(t: any, clerkUserId = "clerk_123") {
  await t.withIdentity({ subject: clerkUserId }).mutation(api.users.upsertUserFromClerk, {
    clerkUserId,
    email: `${clerkUserId}@example.com`,
  });
  const profile = await t.withIdentity({ subject: clerkUserId }).query(api.users.getUserProfile, { clerkUserId });
  return { clerkUserId, userId: profile!._id };
}

// Helper to insert a repo and return its ID
async function insertRepo(t: any, userId: any, clerkUserId: string, githubId = 1) {
  await t.mutation(internal.repositories.upsertRepositories, {
    userId,
    repositories: [{
      githubId,
      name: `repo-${githubId}`,
      fullName: `owner/repo-${githubId}`,
      url: `https://api.github.com/repos/owner/repo-${githubId}`,
      htmlUrl: `https://github.com/owner/repo-${githubId}`,
      stargazersCount: 10,
      forksCount: 2,
      size: 100,
      defaultBranch: "main",
      topics: [],
      isPrivate: false,
      isFork: false,
      hasIssues: true,
      hasWiki: true,
      archived: false,
      disabled: false,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-06-01T00:00:00Z",
      starredAt: "2024-03-01T00:00:00Z",
      owner: { login: "owner", id: 1, avatarUrl: "https://avatar.example.com", type: "User" },
    }],
  });
  const repos = await t.withIdentity({ subject: clerkUserId }).query(api.repositories.getUserRepositories, { clerkUserId });
  return repos.find((r: any) => r.githubId === githubId)!._id;
}

// Helper to insert a suggestion directly
async function insertSuggestion(t: any, userId: any, repositoryId: any, overrides: any = {}) {
  const now = Date.now();
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("aiCategorizationSuggestions", {
      userId,
      repositoryId,
      suggestedCategoryName: overrides.suggestedCategoryName ?? "AI Tools",
      suggestedCategoryColor: overrides.suggestedCategoryColor ?? "#6366f1",
      confidence: overrides.confidence ?? 0.85,
      status: overrides.status ?? "pending",
      reasoning: "This repo focuses on AI tooling",
      createdAt: now,
      updatedAt: now,
    });
  });
}

describe("ai", () => {
  describe("getAiSettings", () => {
    test("returns defaults when no settings exist", async () => {
      const t = createTestConvex();
      const { clerkUserId } = await setupUser(t);

      const settings = await t.withIdentity({ subject: clerkUserId }).query(api.ai.getAiSettings, { clerkUserId });
      expect(settings).not.toBeNull();
      expect(settings!.aiProvider).toBe("cloudflare");
      expect(settings!.aiModel).toBe("@cf/meta/llama-3.1-8b-instruct-fast");
      expect(settings!.enableAI).toBe(false);
      expect(settings!.batchSize).toBe(10);
      expect(settings!.confidenceThreshold).toBe(0.6);
    });

    test("rejects a non-existent authenticated user", async () => {
      const t = createTestConvex();
      await expect(
        t.withIdentity({ subject: "nonexistent" }).query(api.ai.getAiSettings, {
          clerkUserId: "nonexistent",
        })
      ).rejects.toThrow("User not found");
    });

    test("returns saved settings after update", async () => {
      const t = createTestConvex();
      const { clerkUserId } = await setupUser(t);

      await t.withIdentity({ subject: clerkUserId }).mutation(api.ai.updateAiSettings, {
        clerkUserId,
        aiProvider: "openai",
        aiModel: "gpt-5.4-nano",
        enableAI: true,
      });

      const settings = await t.withIdentity({ subject: clerkUserId }).query(api.ai.getAiSettings, { clerkUserId });
      expect(settings!.aiProvider).toBe("openai");
      expect(settings!.aiModel).toBe("gpt-5.4-nano");
      expect(settings!.enableAI).toBe(true);
    });

    test("supports Cloudflare as the default hosted provider", async () => {
      const t = createTestConvex();
      const { clerkUserId } = await setupUser(t);

      await t.withIdentity({ subject: clerkUserId }).mutation(api.ai.updateAiSettings, {
        clerkUserId,
        aiProvider: "cloudflare",
        aiModel: "@cf/meta/llama-3.1-8b-instruct-fast",
        enableAI: true,
      });

      const settings = await t.withIdentity({ subject: clerkUserId }).query(api.ai.getAiSettings, { clerkUserId });
      expect(settings!.aiProvider).toBe("cloudflare");
      expect(settings!.aiModel).toBe("@cf/meta/llama-3.1-8b-instruct-fast");
    });
  });

  describe("updateAiSettings", () => {
    test("creates settings if none exist", async () => {
      const t = createTestConvex();
      const { clerkUserId } = await setupUser(t);

      const settingsId = await t.withIdentity({ subject: clerkUserId }).mutation(api.ai.updateAiSettings, {
        clerkUserId,
        aiProvider: "ollama",
        aiModel: "gemma:2b",
        enableAI: true,
        ollamaEndpoint: "http://localhost:11434",
      });

      expect(settingsId).toBeDefined();

      const settings = await t.withIdentity({ subject: clerkUserId }).query(api.ai.getAiSettings, { clerkUserId });
      expect(settings!.aiProvider).toBe("ollama");
      expect("ollamaEndpoint" in settings! && settings!.ollamaEndpoint).toBe("http://localhost:11434");
    });

    test("updates existing settings with partial data", async () => {
      const t = createTestConvex();
      const { clerkUserId } = await setupUser(t);

      // Create initial
      await t.withIdentity({ subject: clerkUserId }).mutation(api.ai.updateAiSettings, {
        clerkUserId,
        aiProvider: "claude",
        aiModel: "claude-haiku-4-5",
        enableAI: false,
      });

      // Partial update
      await t.withIdentity({ subject: clerkUserId }).mutation(api.ai.updateAiSettings, {
        clerkUserId,
        enableAI: true,
        batchSize: 20,
      });

      const settings = await t.withIdentity({ subject: clerkUserId }).query(api.ai.getAiSettings, { clerkUserId });
      expect(settings!.aiProvider).toBe("claude"); // unchanged
      expect(settings!.enableAI).toBe(true); // updated
      expect(settings!.batchSize).toBe(20); // updated
    });

    test("uses the authenticated user when the legacy user ID is omitted", async () => {
      const t = createTestConvex();
      const { clerkUserId } = await setupUser(t);
      const settingsId = await t.withIdentity({ subject: clerkUserId }).mutation(api.ai.updateAiSettings, {
          enableAI: true,
      });
      expect(settingsId).toBeDefined();
    });
  });

  describe("applySuggestion", () => {
    test("applies suggestion and creates category if needed", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);
      const repoId = await insertRepo(t, userId, clerkUserId);

      const suggestionId = await insertSuggestion(t, userId, repoId, {
        suggestedCategoryName: "New AI Category",
        suggestedCategoryColor: "#ff00ff",
      });

      const result = await t.withIdentity({ subject: clerkUserId }).mutation(api.ai.applySuggestion, {
        clerkUserId,
        suggestionId,
      });

      expect(result.success).toBe(true);
      expect(result.categoryId).toBeDefined();

      // Verify category was created
      const categories = await t.withIdentity({ subject: clerkUserId }).query(api.categories.getUserCategories, { clerkUserId });
      const newCat = categories.find((c: any) => c.name === "New AI Category");
      expect(newCat).toBeDefined();

      // Verify suggestion status changed
      const suggestion = await t.run(async (ctx: any) => ctx.db.get(suggestionId));
      expect(suggestion.status).toBe("applied");
    });

    test("uses existing category if name matches", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);
      const repoId = await insertRepo(t, userId, clerkUserId);

      // Pre-create the category
      await t.withIdentity({ subject: clerkUserId }).mutation(api.categories.createCategory, {
        clerkUserId,
        name: "Existing Cat",
        color: "#abcdef",
      });

      const suggestionId = await insertSuggestion(t, userId, repoId, {
        suggestedCategoryName: "Existing Cat",
      });

      await t.withIdentity({ subject: clerkUserId }).mutation(api.ai.applySuggestion, {
        clerkUserId,
        suggestionId,
      });

      // Should not create a duplicate
      const categories = await t.withIdentity({ subject: clerkUserId }).query(api.categories.getUserCategories, { clerkUserId });
      const matching = categories.filter((c: any) => c.name === "Existing Cat");
      expect(matching.length).toBe(1);
    });

    test("rejects already processed suggestion", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);
      const repoId = await insertRepo(t, userId, clerkUserId);

      const suggestionId = await insertSuggestion(t, userId, repoId, {
        status: "applied",
      });

      await expect(
        t.withIdentity({ subject: clerkUserId }).mutation(api.ai.applySuggestion, {
          clerkUserId,
          suggestionId,
        })
      ).rejects.toThrow("already processed");
    });
  });

  describe("rejectSuggestion", () => {
    test("marks suggestion as rejected", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);
      const repoId = await insertRepo(t, userId, clerkUserId);

      const suggestionId = await insertSuggestion(t, userId, repoId);

      const result = await t.withIdentity({ subject: clerkUserId }).mutation(api.ai.rejectSuggestion, {
        clerkUserId,
        suggestionId,
      });

      expect(result.success).toBe(true);

      const suggestion = await t.run(async (ctx: any) => ctx.db.get(suggestionId));
      expect(suggestion.status).toBe("rejected");
    });
  });

  describe("getPendingSuggestionsCount", () => {
    test("counts only pending suggestions", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);
      const repoId = await insertRepo(t, userId, clerkUserId);

      await insertSuggestion(t, userId, repoId, { status: "pending" });
      await insertSuggestion(t, userId, repoId, { status: "pending", suggestedCategoryName: "Cat2" });
      await insertSuggestion(t, userId, repoId, { status: "applied", suggestedCategoryName: "Cat3" });
      await insertSuggestion(t, userId, repoId, { status: "rejected", suggestedCategoryName: "Cat4" });

      const count = await t.withIdentity({ subject: clerkUserId }).query(api.ai.getPendingSuggestionsCount, { clerkUserId });
      expect(count).toBe(2);
    });

    test("rejects a non-existent authenticated user", async () => {
      const t = createTestConvex();
      await expect(
        t.withIdentity({ subject: "nonexistent" }).query(api.ai.getPendingSuggestionsCount, {
          clerkUserId: "nonexistent",
        })
      ).rejects.toThrow("User not found");
    });
  });

  describe("getUsageStats", () => {
    test("aggregates usage data correctly", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      // Insert usage records directly
      const now = Date.now();
      await t.run(async (ctx: any) => {
        await ctx.db.insert("aiUsage", {
          userId,
          provider: "claude",
          model: "claude-haiku-4-5",
          inputTokens: 500,
          outputTokens: 200,
          totalTokens: 700,
          estimatedCostUsd: 0.001,
          requestType: "categorization",
          createdAt: now,
        });
        await ctx.db.insert("aiUsage", {
          userId,
          provider: "openai",
          model: "gpt-5.4-nano",
          inputTokens: 300,
          outputTokens: 100,
          totalTokens: 400,
          estimatedCostUsd: 0.0004,
          requestType: "categorization",
          createdAt: now,
        });
      });

      const stats = await t.withIdentity({ subject: clerkUserId }).query(api.ai.getUsageStats, { clerkUserId });
      expect(stats).not.toBeNull();
      expect(stats!.totalTokens).toBe(1100);
      expect(stats!.requestCount).toBe(2);
      expect(stats!.totalCost).toBeGreaterThan(0);
    });

    test("rejects a non-existent authenticated user", async () => {
      const t = createTestConvex();
      await expect(
        t.withIdentity({ subject: "nonexistent" }).query(api.ai.getUsageStats, {
          clerkUserId: "nonexistent",
        })
      ).rejects.toThrow("User not found");
    });
  });

  describe("saveTaxonomyAsCategories", () => {
    test("creates new categories from taxonomy", async () => {
      const t = createTestConvex();
      const { clerkUserId } = await setupUser(t);

      const result = await t.withIdentity({ subject: clerkUserId }).mutation(api.ai.saveTaxonomyAsCategories, {
        clerkUserId,
        categories: [
          { name: "Frontend", description: "UI frameworks", color: "#3b82f6" },
          { name: "Backend", description: "Server tools", color: "#10b981" },
        ],
      });

      expect(result.created).toEqual(["Frontend", "Backend"]);
      expect(result.skipped).toEqual([]);

      const categories = await t.withIdentity({ subject: clerkUserId }).query(api.categories.getUserCategories, { clerkUserId });
      const names = categories.map((c: any) => c.name);
      expect(names).toContain("Frontend");
      expect(names).toContain("Backend");
    });

    test("skips categories that already exist", async () => {
      const t = createTestConvex();
      const { clerkUserId } = await setupUser(t);

      // "Learning" is a default category created with the user
      const result = await t.withIdentity({ subject: clerkUserId }).mutation(api.ai.saveTaxonomyAsCategories, {
        clerkUserId,
        categories: [
          { name: "Learning", description: "Already exists", color: "#ff0000" },
          { name: "NewOne", description: "Fresh", color: "#00ff00" },
        ],
      });

      expect(result.skipped).toEqual(["Learning"]);
      expect(result.created).toEqual(["NewOne"]);
    });

    test("clearExisting removes unassigned categories", async () => {
      const t = createTestConvex();
      const { clerkUserId } = await setupUser(t);

      // Default categories exist (Learning, Tools, Inspiration, Work)
      // None have repos assigned, so clearExisting should remove them
      const result = await t.withIdentity({ subject: clerkUserId }).mutation(api.ai.saveTaxonomyAsCategories, {
        clerkUserId,
        categories: [
          { name: "AI", description: "AI repos", color: "#6366f1" },
        ],
        clearExisting: true,
      });

      expect(result.created).toEqual(["AI"]);

      const categories = await t.withIdentity({ subject: clerkUserId }).query(api.categories.getUserCategories, { clerkUserId });
      // Only the new one should remain (defaults were cleared)
      expect(categories.length).toBe(1);
      expect(categories[0].name).toBe("AI");
    });
  });
});
