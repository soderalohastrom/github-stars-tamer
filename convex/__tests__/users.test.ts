import { expect, test, describe } from "vitest";
import { api, internal } from "../_generated/api";
import { createTestConvex } from "./setup";

describe("users", () => {
  describe("upsertUserFromClerk", () => {
    test("creates new user with default preferences and default categories", async () => {
      const t = createTestConvex();

      const userId = await t.mutation(api.users.upsertUserFromClerk, {
        clerkUserId: "clerk_123",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
      });

      expect(userId).toBeDefined();

      // Verify user was created with correct defaults
      const profile = await t.query(api.users.getUserProfile, {
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
      const categories = await t.query(api.categories.getUserCategories, {
        clerkUserId: "clerk_123",
      });
      expect(categories.length).toBe(4);
      const names = categories.map((c: any) => c.name).sort();
      expect(names).toEqual(["Inspiration", "Learning", "Tools", "Work"]);
    });

    test("updates existing user without duplicating", async () => {
      const t = createTestConvex();

      const userId1 = await t.mutation(api.users.upsertUserFromClerk, {
        clerkUserId: "clerk_123",
        email: "test@example.com",
        firstName: "Test",
      });

      const userId2 = await t.mutation(api.users.upsertUserFromClerk, {
        clerkUserId: "clerk_123",
        email: "updated@example.com",
        firstName: "Updated",
      });

      expect(userId1).toEqual(userId2);

      const profile = await t.query(api.users.getUserProfile, {
        clerkUserId: "clerk_123",
      });
      expect(profile!.email).toBe("updated@example.com");
      expect(profile!.firstName).toBe("Updated");
    });

    test("stores GitHub account data when provided", async () => {
      const t = createTestConvex();

      await t.mutation(api.users.upsertUserFromClerk, {
        clerkUserId: "clerk_123",
        email: "test@example.com",
        githubAccount: {
          externalAccountId: "ext_123",
          username: "testuser",
          email: "gh@example.com",
        },
      });

      const profile = await t.query(api.users.getUserProfile, {
        clerkUserId: "clerk_123",
      });
      expect(profile!.githubExternalAccountId).toBe("ext_123");
      expect(profile!.githubUsername).toBe("testuser");
      expect(profile!.githubEmail).toBe("gh@example.com");
    });
  });

  describe("getUserProfile", () => {
    test("returns null for non-existent user", async () => {
      const t = createTestConvex();
      const profile = await t.query(api.users.getUserProfile, {
        clerkUserId: "nonexistent",
      });
      expect(profile).toBeNull();
    });
  });

  describe("updateUserPreferences", () => {
    test("merges partial preference updates", async () => {
      const t = createTestConvex();

      await t.mutation(api.users.upsertUserFromClerk, {
        clerkUserId: "clerk_123",
        email: "test@example.com",
      });

      await t.mutation(api.users.updateUserPreferences, {
        clerkUserId: "clerk_123",
        preferences: { theme: "dark" },
      });

      const profile = await t.query(api.users.getUserProfile, {
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
        t.mutation(api.users.updateUserPreferences, {
          clerkUserId: "nonexistent",
          preferences: { theme: "dark" },
        })
      ).rejects.toThrow();
    });
  });

  describe("isGitHubConnected", () => {
    test("returns disconnected for user without GitHub", async () => {
      const t = createTestConvex();

      await t.mutation(api.users.upsertUserFromClerk, {
        clerkUserId: "clerk_123",
        email: "test@example.com",
      });

      const result = await t.query(api.users.isGitHubConnected, {
        clerkUserId: "clerk_123",
      });
      expect(result.connected).toBe(false);
      expect(result.username).toBeNull();
      expect(result.hasToken).toBe(false);
    });

    test("returns connected for user with GitHub account", async () => {
      const t = createTestConvex();

      await t.mutation(api.users.upsertUserFromClerk, {
        clerkUserId: "clerk_123",
        email: "test@example.com",
        githubAccount: {
          externalAccountId: "ext_123",
          username: "ghuser",
        },
      });

      const result = await t.query(api.users.isGitHubConnected, {
        clerkUserId: "clerk_123",
      });
      expect(result.connected).toBe(true);
      expect(result.username).toBe("ghuser");
    });

    test("returns disconnected for non-existent user", async () => {
      const t = createTestConvex();
      const result = await t.query(api.users.isGitHubConnected, {
        clerkUserId: "nonexistent",
      });
      expect(result.connected).toBe(false);
    });
  });

  describe("storeGitHubToken", () => {
    test("creates user if missing and stores token", async () => {
      const t = createTestConvex();

      await t.mutation(api.users.storeGitHubToken, {
        clerkUserId: "clerk_new",
        encryptedToken: "encrypted_abc",
        githubUsername: "newuser",
      });

      const profile = await t.query(api.users.getUserProfile, {
        clerkUserId: "clerk_new",
      });
      expect(profile).not.toBeNull();
      expect(profile!.githubToken).toBe("encrypted_abc");
      expect(profile!.githubUsername).toBe("newuser");
    });

    test("stores token for existing user", async () => {
      const t = createTestConvex();

      await t.mutation(api.users.upsertUserFromClerk, {
        clerkUserId: "clerk_123",
        email: "test@example.com",
      });

      await t.mutation(api.users.storeGitHubToken, {
        clerkUserId: "clerk_123",
        encryptedToken: "encrypted_xyz",
        githubUsername: "existinguser",
      });

      const profile = await t.query(api.users.getUserProfile, {
        clerkUserId: "clerk_123",
      });
      expect(profile!.githubToken).toBe("encrypted_xyz");
      expect(profile!.githubUsername).toBe("existinguser");
    });
  });
});
