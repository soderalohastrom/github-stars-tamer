import { describe, expect, test } from "vitest";
import { api, internal } from "../_generated/api";
import { createTestConvex } from "./setup.test-helper";

describe("GitHub authorization", () => {
  test("denies anonymous GitHub actions before any token or network work", async () => {
    const t = createTestConvex();

    await expect(
      t.action(api.sync.starRepository, {
        clerkUserId: "clerk_user",
        owner: "octocat",
        repo: "hello-world",
      }),
    ).rejects.toThrow("Unauthenticated");

    await expect(
      t.action(api.github.refreshGithubToken, {
        clerkUserId: "clerk_user",
      }),
    ).rejects.toThrow("Unauthenticated");
  });

  test("rejects a supplied Clerk ID that does not match the authenticated subject", async () => {
    const t = createTestConvex().withIdentity({ subject: "clerk_authenticated" });

    await expect(
      t.action(api.github.refreshGithubToken, {
        clerkUserId: "clerk_other_user",
      }),
    ).rejects.toThrow("Authenticated user does not match clerkUserId");
  });

  test("binds an internal token write to the same user record and Clerk subject", async () => {
    const t = createTestConvex();
    const userId = await t.run(async (ctx) =>
      await ctx.db.insert("users", {
        clerkUserId: "clerk_owner",
        email: "owner@example.com",
        githubToken: "legacy-token",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );

    await expect(
      t.mutation(internal.github.storeGithubOAuthToken, {
        clerkUserId: "clerk_other",
        userId,
        accessToken: "test-token",
        scopes: [],
      }),
    ).rejects.toThrow("User not found or access denied");

    await t.mutation(internal.github.storeGithubOAuthToken, {
      clerkUserId: "clerk_owner",
      userId,
      accessToken: "server-token",
      scopes: ["repo"],
    });

    const user = await t.run(async (ctx) => await ctx.db.get(userId));
    expect(user?.githubAccessToken).toBe("server-token");
    expect(user?.githubToken).toBeUndefined();
  });
});
