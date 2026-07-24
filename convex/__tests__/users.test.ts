import { expect, test, describe } from "vitest";
import { api, internal } from "../_generated/api";
import { createTestConvex } from "./setup.test-helper";

describe("users", () => {
  describe("upsertUserFromClerk", () => {
    test("creates new user with default preferences and default categories", async () => {
      const t = createTestConvex();

      const userId = await t.withIdentity({ subject: "clerk_123" }).mutation(api.users.upsertUserFromClerk, {
        clerkUserId: "clerk_123",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
      });

      expect(userId).toBeDefined();

      // Verify user was created with correct defaults
      const profile = await t.withIdentity({ subject: "clerk_123" }).query(api.users.getUserProfile, {
        clerkUserId: "clerk_123",
      });
      expect(profile).not.toBeNull();
      expect(profile!.email).toBe("test@example.com");
      expect(profile!.firstName).toBe("Test");
      expect(profile!.preferences).toEqual({
        theme: "system",
        defaultSort: "created",
        enableHaptics: true,
        syncFrequency: "manual",
      });

      // Verify default categories were created
      const categories = await t.withIdentity({ subject: "clerk_123" }).query(api.categories.getUserCategories, {
        clerkUserId: "clerk_123",
      });
      expect(categories.length).toBe(4);
      const names = categories.map((c: any) => c.name).sort();
      expect(names).toEqual(["Inspiration", "Learning", "Tools", "Work"]);
    });

    test("updates existing user without duplicating", async () => {
      const t = createTestConvex();

      const userId1 = await t.withIdentity({ subject: "clerk_123" }).mutation(api.users.upsertUserFromClerk, {
        clerkUserId: "clerk_123",
        email: "test@example.com",
        firstName: "Test",
      });

      const userId2 = await t.withIdentity({ subject: "clerk_123" }).mutation(api.users.upsertUserFromClerk, {
        clerkUserId: "clerk_123",
        email: "updated@example.com",
        firstName: "Updated",
      });

      expect(userId1).toEqual(userId2);

      const profile = await t.withIdentity({ subject: "clerk_123" }).query(api.users.getUserProfile, {
        clerkUserId: "clerk_123",
      });
      expect(profile!.email).toBe("updated@example.com");
      expect(profile!.firstName).toBe("Updated");
    });

    test("returns only safe GitHub account fields when provided", async () => {
      const t = createTestConvex();

      await t.withIdentity({ subject: "clerk_123" }).mutation(api.users.upsertUserFromClerk, {
        clerkUserId: "clerk_123",
        email: "test@example.com",
        githubAccount: {
          externalAccountId: "ext_123",
          username: "testuser",
          email: "gh@example.com",
        },
      });

      const profile = await t.withIdentity({ subject: "clerk_123" }).query(api.users.getUserProfile, {
        clerkUserId: "clerk_123",
      });
      expect(profile!.githubUsername).toBe("testuser");
      expect(profile).not.toHaveProperty("githubExternalAccountId");
      expect(profile).not.toHaveProperty("githubEmail");
    });
  });

  describe("getUserProfile", () => {
    test("returns null for non-existent user", async () => {
      const t = createTestConvex();
      const profile = await t.withIdentity({ subject: "nonexistent" }).query(api.users.getUserProfile, {
        clerkUserId: "nonexistent",
      });
      expect(profile).toBeNull();
    });
  });

  describe("updateUserPreferences", () => {
    test("merges partial preference updates", async () => {
      const t = createTestConvex();

      await t.withIdentity({ subject: "clerk_123" }).mutation(api.users.upsertUserFromClerk, {
        clerkUserId: "clerk_123",
        email: "test@example.com",
      });

      await t.withIdentity({ subject: "clerk_123" }).mutation(api.users.updateUserPreferences, {
        clerkUserId: "clerk_123",
        preferences: { theme: "dark" },
      });

      const profile = await t.withIdentity({ subject: "clerk_123" }).query(api.users.getUserProfile, {
        clerkUserId: "clerk_123",
      });
      expect(profile!.preferences!.theme).toBe("dark");
      // Other defaults preserved
      expect(profile!.preferences!.enableHaptics).toBe(true);
      expect(profile!.preferences!.syncFrequency).toBe("manual");
    });

    test("throws for non-existent user", async () => {
      const t = createTestConvex();
      await expect(
        t.withIdentity({ subject: "nonexistent" }).mutation(api.users.updateUserPreferences, {
          clerkUserId: "nonexistent",
          preferences: { theme: "dark" },
        })
      ).rejects.toThrow();
    });
  });

  describe("isGitHubConnected", () => {
    test("returns disconnected for user without GitHub", async () => {
      const t = createTestConvex();

      await t.withIdentity({ subject: "clerk_123" }).mutation(api.users.upsertUserFromClerk, {
        clerkUserId: "clerk_123",
        email: "test@example.com",
      });

      const result = await t.withIdentity({ subject: "clerk_123" }).query(api.users.isGitHubConnected, {
        clerkUserId: "clerk_123",
      });
      expect(result.connected).toBe(false);
      expect(result.username).toBeNull();
      expect(result.hasToken).toBe(false);
    });

    test("returns connected for user with GitHub account", async () => {
      const t = createTestConvex();

      await t.withIdentity({ subject: "clerk_123" }).mutation(api.users.upsertUserFromClerk, {
        clerkUserId: "clerk_123",
        email: "test@example.com",
        githubAccount: {
          externalAccountId: "ext_123",
          username: "ghuser",
        },
      });

      const result = await t.withIdentity({ subject: "clerk_123" }).query(api.users.isGitHubConnected, {
        clerkUserId: "clerk_123",
      });
      expect(result.connected).toBe(true);
      expect(result.username).toBe("ghuser");
    });

    test("returns disconnected for non-existent user", async () => {
      const t = createTestConvex();
      const result = await t.withIdentity({ subject: "nonexistent" }).query(api.users.isGitHubConnected, {
        clerkUserId: "nonexistent",
      });
      expect(result.connected).toBe(false);
    });
  });

  describe("storeGitHubToken", () => {
    test("rejects legacy token storage and does not create a user", async () => {
      const t = createTestConvex();

      await expect(
        t.withIdentity({ subject: "clerk_new" }).mutation(api.users.storeGitHubToken, {
          clerkUserId: "clerk_new",
          encryptedToken: "encrypted_abc",
          githubUsername: "newuser",
        })
      ).rejects.toThrow("Legacy GitHub token storage is disabled");

      const profile = await t.withIdentity({ subject: "clerk_new" }).query(api.users.getUserProfile, {
        clerkUserId: "clerk_new",
      });
      expect(profile).toBeNull();
    });

    test("rejects legacy token storage for an existing user", async () => {
      const t = createTestConvex();

      await t.withIdentity({ subject: "clerk_123" }).mutation(api.users.upsertUserFromClerk, {
        clerkUserId: "clerk_123",
        email: "test@example.com",
      });

      await expect(
        t.withIdentity({ subject: "clerk_123" }).mutation(api.users.storeGitHubToken, {
          clerkUserId: "clerk_123",
          encryptedToken: "encrypted_xyz",
          githubUsername: "existinguser",
        })
      ).rejects.toThrow("Legacy GitHub token storage is disabled");

      const profile = await t.withIdentity({ subject: "clerk_123" }).query(api.users.getUserProfile, {
        clerkUserId: "clerk_123",
      });
      expect(profile).not.toHaveProperty("githubToken");
      expect(profile!.githubUsername).toBeUndefined();
    });
  });
});
