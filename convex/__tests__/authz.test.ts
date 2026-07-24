import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import { createTestConvex } from "./setup.test-helper";

const ALICE = "clerk_alice";
const BOB = "clerk_bob";

async function provisionUser(t: any, clerkUserId: string) {
  const client = t.withIdentity({ subject: clerkUserId });
  const userId = await client.mutation(api.users.upsertUserFromClerk, {
    clerkUserId,
    email: `${clerkUserId}@example.com`,
  });

  return { client, userId };
}

describe("authorization boundaries", () => {
  test("denies anonymous public queries and mutations", async () => {
    const t = createTestConvex();

    await expect(
      t.query(api.categories.getUserCategories, { clerkUserId: ALICE }),
    ).rejects.toThrow("Unauthenticated");

    await expect(
      t.mutation(api.categories.createCategory, {
        clerkUserId: ALICE,
        name: "Private category",
        color: "#123456",
      }),
    ).rejects.toThrow("Unauthenticated");
  });

  test("rejects a client-supplied Clerk ID that differs from the identity", async () => {
    const t = createTestConvex();
    const alice = t.withIdentity({ subject: ALICE });

    await expect(
      alice.query(api.categories.getUserCategories, { clerkUserId: BOB }),
    ).rejects.toThrow("Authenticated user does not match clerkUserId");

    await expect(
      alice.mutation(api.categories.createCategory, {
        clerkUserId: BOB,
        name: "Impersonated category",
        color: "#654321",
      }),
    ).rejects.toThrow("Authenticated user does not match clerkUserId");
  });

  test("allows a matching identity to use a core CRUD route", async () => {
    const t = createTestConvex();
    const { client: alice } = await provisionUser(t, ALICE);

    const categoryId = await alice.mutation(api.categories.createCategory, {
      clerkUserId: ALICE,
      name: "Alice only",
      color: "#22c55e",
    });

    const categories = await alice.query(api.categories.getUserCategories, {
      clerkUserId: ALICE,
    });

    expect(categories.some((category: any) => category._id === categoryId)).toBe(true);
  });

  test("does not expose OAuth or personal-access-token fields in profiles", async () => {
    const t = createTestConvex();
    const clerkUserId = "clerk_profile";
    const now = Date.now();

    await t.run(async (ctx: any) => {
      await ctx.db.insert("users", {
        clerkUserId,
        email: "profile@example.com",
        githubExternalAccountId: "github-external-account",
        githubAccessToken: "oauth-access-token",
        githubTokenExpiresAt: now + 60_000,
        githubTokenLastFetchedAt: now,
        githubScopes: ["repo", "read:user"],
        githubUsername: "safe-handle",
        githubEmail: "github@example.com",
        githubToken: "legacy-personal-access-token",
        preferences: {
          theme: "system",
          defaultSort: "created",
          enableHaptics: true,
          syncFrequency: "manual",
        },
        createdAt: now,
        updatedAt: now,
      });
    });

    const profileClient = t.withIdentity({ subject: clerkUserId });
    const profile = await profileClient.query(api.users.getUserProfile, {
      clerkUserId,
    });
    expect(profile).not.toBeNull();

    const safeProfile = profile!;
    expect(safeProfile.githubUsername).toBe("safe-handle");
    for (const privateField of [
      "githubExternalAccountId",
      "githubAccessToken",
      "githubTokenExpiresAt",
      "githubTokenLastFetchedAt",
      "githubScopes",
      "githubEmail",
      "githubToken",
    ]) {
      expect(safeProfile).not.toHaveProperty(privateField);
    }
  });

  test("rejects cross-user category and repository access", async () => {
    const t = createTestConvex();
    const { client: alice } = await provisionUser(t, ALICE);
    const { client: bob, userId: bobUserId } = await provisionUser(t, BOB);

    const bobCategoryId = await bob.mutation(api.categories.createCategory, {
      clerkUserId: BOB,
      name: "Bob only",
      color: "#ef4444",
    });

    await expect(
      alice.mutation(api.categories.updateCategory, {
        clerkUserId: ALICE,
        categoryId: bobCategoryId,
        name: "Alice cannot rename this",
      }),
    ).rejects.toThrow();

    await t.mutation(internal.repositories.upsertRepositories, {
      userId: bobUserId,
      repositories: [
        {
          githubId: 42,
          name: "bob-repository",
          fullName: "bob/bob-repository",
          url: "https://api.github.com/repos/bob/bob-repository",
          htmlUrl: "https://github.com/bob/bob-repository",
          stargazersCount: 42,
          forksCount: 1,
          size: 10,
          defaultBranch: "main",
          topics: [],
          isPrivate: false,
          isFork: false,
          hasIssues: true,
          hasWiki: false,
          archived: false,
          disabled: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          starredAt: "2026-01-01T00:00:00.000Z",
          owner: {
            login: "bob",
            id: 42,
            avatarUrl: "https://example.com/bob.png",
            type: "User",
          },
        },
      ],
    });

    const bobRepositories = await bob.query(api.repositories.getUserRepositories, {
      clerkUserId: BOB,
    });
    const bobRepositoryId = bobRepositories.find(
      (repository: any) => repository.githubId === 42,
    )!._id;

    await expect(
      alice.query(api.repositories.getRepository, {
        userId: bobUserId,
        repositoryId: bobRepositoryId,
      }),
    ).rejects.toThrow("Repository not found or access denied");
  });
});
