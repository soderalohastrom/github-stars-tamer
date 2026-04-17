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

describe("syncHistory", () => {
  describe("createSyncRecord", () => {
    test("creates record with running status", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      const syncId = await t.mutation(internal.syncHistory.createSyncRecord, {
        userId,
        syncType: "full",
      });

      expect(syncId).toBeDefined();

      const history = await t.query(api.syncHistory.getSyncHistory, {
        clerkUserId,
      });
      expect(history.length).toBe(1);
      expect(history[0].status).toBe("running");
      expect(history[0].syncType).toBe("full");
      expect(history[0].repositoriesProcessed).toBe(0);
    });
  });

  describe("completeSyncRecord", () => {
    test("marks sync as completed with stats", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      const syncId = await t.mutation(internal.syncHistory.createSyncRecord, {
        userId,
        syncType: "incremental",
      });

      await t.mutation(internal.syncHistory.completeSyncRecord, {
        syncId,
        repositoriesProcessed: 100,
        repositoriesAdded: 10,
        repositoriesUpdated: 90,
        repositoriesRemoved: 0,
        rateLimitRemaining: 4900,
        totalApiCalls: 2,
      });

      const history = await t.query(api.syncHistory.getSyncHistory, {
        clerkUserId,
      });
      expect(history[0].status).toBe("completed");
      expect(history[0].repositoriesProcessed).toBe(100);
      expect(history[0].repositoriesAdded).toBe(10);
      expect(history[0].completedAt).toBeDefined();
      expect(history[0].metadata?.rateLimitRemaining).toBe(4900);
    });
  });

  describe("failSyncRecord", () => {
    test("marks sync as failed with error", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      const syncId = await t.mutation(internal.syncHistory.createSyncRecord, {
        userId,
        syncType: "manual",
      });

      await t.mutation(internal.syncHistory.failSyncRecord, {
        syncId,
        errorMessage: "Rate limit exceeded",
      });

      const history = await t.query(api.syncHistory.getSyncHistory, {
        clerkUserId,
      });
      expect(history[0].status).toBe("failed");
      expect(history[0].errorMessage).toBe("Rate limit exceeded");
      expect(history[0].completedAt).toBeDefined();
    });
  });

  describe("getSyncHistory", () => {
    test("returns most recent first", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      await t.mutation(internal.syncHistory.createSyncRecord, {
        userId,
        syncType: "full",
      });
      const secondId = await t.mutation(internal.syncHistory.createSyncRecord, {
        userId,
        syncType: "incremental",
      });

      const history = await t.query(api.syncHistory.getSyncHistory, {
        clerkUserId,
      });
      expect(history.length).toBe(2);
      // Most recent should be first (desc order)
      expect(history[0].syncType).toBe("incremental");
    });

    test("respects limit", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      for (let i = 0; i < 5; i++) {
        await t.mutation(internal.syncHistory.createSyncRecord, {
          userId,
          syncType: "full",
        });
      }

      const history = await t.query(api.syncHistory.getSyncHistory, {
        clerkUserId,
        limit: 2,
      });
      expect(history.length).toBe(2);
    });
  });

  describe("getLatestSyncStatus", () => {
    test("returns most recent sync", async () => {
      const t = createTestConvex();
      const { userId, clerkUserId } = await setupUser(t);

      await t.mutation(internal.syncHistory.createSyncRecord, {
        userId,
        syncType: "full",
      });
      const latestId = await t.mutation(internal.syncHistory.createSyncRecord, {
        userId,
        syncType: "incremental",
      });

      await t.mutation(internal.syncHistory.completeSyncRecord, {
        syncId: latestId,
        repositoriesProcessed: 50,
        repositoriesAdded: 5,
        repositoriesUpdated: 45,
        repositoriesRemoved: 0,
      });

      const latest = await t.query(api.syncHistory.getLatestSyncStatus, {
        clerkUserId,
      });
      expect(latest).not.toBeNull();
      expect(latest!.syncType).toBe("incremental");
      expect(latest!.status).toBe("completed");
    });

    test("returns null when no syncs exist", async () => {
      const t = createTestConvex();
      const { clerkUserId } = await setupUser(t);

      const latest = await t.query(api.syncHistory.getLatestSyncStatus, {
        clerkUserId,
      });
      expect(latest).toBeNull();
    });
  });
});
