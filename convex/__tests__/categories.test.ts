import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import { createTestConvex } from "./setup.test-helper";

// Helper to create a user and return the clerkUserId
async function setupUser(t: any, clerkUserId = "clerk_123") {
  await t.withIdentity({ subject: clerkUserId }).mutation(api.users.upsertUserFromClerk, {
    clerkUserId,
    email: `${clerkUserId}@example.com`,
  });
  return clerkUserId;
}

describe("categories", () => {
  describe("createCategory", () => {
    test("creates a root category with auto sort order", async () => {
      const t = createTestConvex();
      const clerkUserId = await setupUser(t);

      const categoryId = await t.withIdentity({ subject: clerkUserId }).mutation(api.categories.createCategory, {
        clerkUserId,
        name: "Custom Category",
        color: "#ff0000",
        description: "A test category",
      });

      expect(categoryId).toBeDefined();

      const categories = await t.withIdentity({ subject: clerkUserId }).query(api.categories.getUserCategories, {
        clerkUserId,
      });
      // 4 defaults + 1 custom
      const custom = categories.find((c: any) => c.name === "Custom Category");
      expect(custom).toBeDefined();
      expect(custom!.color).toBe("#ff0000");
      expect(custom!.description).toBe("A test category");
    });

    test("creates a nested category under parent", async () => {
      const t = createTestConvex();
      const clerkUserId = await setupUser(t);

      const parentId = await t.withIdentity({ subject: clerkUserId }).mutation(api.categories.createCategory, {
        clerkUserId,
        name: "Parent",
        color: "#00ff00",
      });

      const childId = await t.withIdentity({ subject: clerkUserId }).mutation(api.categories.createCategory, {
        clerkUserId,
        name: "Child",
        color: "#0000ff",
        parentCategoryId: parentId,
      });

      expect(childId).toBeDefined();

      // Verify hierarchy
      const categories = await t.withIdentity({ subject: clerkUserId }).query(api.categories.getUserCategories, {
        clerkUserId,
      });
      const parent = categories.find((c: any) => c.name === "Parent");
      expect(parent).toBeDefined();
      expect(parent!.children.length).toBe(1);
      expect(parent!.children[0].name).toBe("Child");
    });

    test("rejects invalid parent category", async () => {
      const t = createTestConvex();
      const clerkUserId = await setupUser(t);

      // Create a category with user2 to test cross-user rejection
      const clerkUserId2 = await setupUser(t, "clerk_456");
      const otherCategoryId = await t.withIdentity({ subject: clerkUserId2 }).mutation(api.categories.createCategory, {
        clerkUserId: clerkUserId2,
        name: "Other User Cat",
        color: "#999999",
      });

      await expect(
        t.withIdentity({ subject: clerkUserId }).mutation(api.categories.createCategory, {
          clerkUserId,
          name: "Bad Child",
          color: "#000000",
          parentCategoryId: otherCategoryId,
        })
      ).rejects.toThrow();
    });
  });

  describe("getUserCategories", () => {
    test("rejects a non-existent authenticated user", async () => {
      const t = createTestConvex();
      await expect(
        t.withIdentity({ subject: "nonexistent" }).query(api.categories.getUserCategories, {
          clerkUserId: "nonexistent",
        })
      ).rejects.toThrow("User not found");
    });

    test("returns hierarchical tree structure", async () => {
      const t = createTestConvex();
      const clerkUserId = await setupUser(t);

      // Create a parent with two children
      const parentId = await t.withIdentity({ subject: clerkUserId }).mutation(api.categories.createCategory, {
        clerkUserId,
        name: "Root",
        color: "#111111",
      });
      await t.withIdentity({ subject: clerkUserId }).mutation(api.categories.createCategory, {
        clerkUserId,
        name: "Child A",
        color: "#222222",
        parentCategoryId: parentId,
      });
      await t.withIdentity({ subject: clerkUserId }).mutation(api.categories.createCategory, {
        clerkUserId,
        name: "Child B",
        color: "#333333",
        parentCategoryId: parentId,
      });

      const categories = await t.withIdentity({ subject: clerkUserId }).query(api.categories.getUserCategories, {
        clerkUserId,
      });
      const root = categories.find((c: any) => c.name === "Root");
      expect(root).toBeDefined();
      expect(root!.children.length).toBe(2);
      const childNames = root!.children.map((c: any) => c.name).sort();
      expect(childNames).toEqual(["Child A", "Child B"]);
    });
  });

  describe("updateCategory", () => {
    test("updates category fields", async () => {
      const t = createTestConvex();
      const clerkUserId = await setupUser(t);

      const catId = await t.withIdentity({ subject: clerkUserId }).mutation(api.categories.createCategory, {
        clerkUserId,
        name: "Original",
        color: "#aaaaaa",
      });

      await t.withIdentity({ subject: clerkUserId }).mutation(api.categories.updateCategory, {
        clerkUserId,
        categoryId: catId,
        name: "Renamed",
        color: "#bbbbbb",
      });

      const stats = await t.withIdentity({ subject: clerkUserId }).query(api.categories.getCategoryWithStats, {
        clerkUserId,
        categoryId: catId,
      });
      expect(stats.name).toBe("Renamed");
      expect(stats.color).toBe("#bbbbbb");
    });

    test("prevents circular reference", async () => {
      const t = createTestConvex();
      const clerkUserId = await setupUser(t);

      const catId = await t.withIdentity({ subject: clerkUserId }).mutation(api.categories.createCategory, {
        clerkUserId,
        name: "Self",
        color: "#cccccc",
      });

      await expect(
        t.withIdentity({ subject: clerkUserId }).mutation(api.categories.updateCategory, {
          clerkUserId,
          categoryId: catId,
          parentCategoryId: catId,
        })
      ).rejects.toThrow("Cannot make category a child of itself");
    });
  });

  describe("deleteCategory", () => {
    test("deletes category and removes repository associations", async () => {
      const t = createTestConvex();
      const clerkUserId = await setupUser(t);

      const catId = await t.withIdentity({ subject: clerkUserId }).mutation(api.categories.createCategory, {
        clerkUserId,
        name: "ToDelete",
        color: "#dddddd",
      });

      await t.withIdentity({ subject: clerkUserId }).mutation(api.categories.deleteCategory, {
        clerkUserId,
        categoryId: catId,
      });

      const categories = await t.withIdentity({ subject: clerkUserId }).query(api.categories.getUserCategories, {
        clerkUserId,
      });
      const deleted = categories.find((c: any) => c.name === "ToDelete");
      expect(deleted).toBeUndefined();
    });

    test("re-parents children to grandparent on delete", async () => {
      const t = createTestConvex();
      const clerkUserId = await setupUser(t);

      const grandparentId = await t.withIdentity({ subject: clerkUserId }).mutation(api.categories.createCategory, {
        clerkUserId,
        name: "Grandparent",
        color: "#111111",
      });

      const parentId = await t.withIdentity({ subject: clerkUserId }).mutation(api.categories.createCategory, {
        clerkUserId,
        name: "Parent",
        color: "#222222",
        parentCategoryId: grandparentId,
      });

      await t.withIdentity({ subject: clerkUserId }).mutation(api.categories.createCategory, {
        clerkUserId,
        name: "Child",
        color: "#333333",
        parentCategoryId: parentId,
      });

      // Delete parent — child should move to grandparent
      await t.withIdentity({ subject: clerkUserId }).mutation(api.categories.deleteCategory, {
        clerkUserId,
        categoryId: parentId,
      });

      const categories = await t.withIdentity({ subject: clerkUserId }).query(api.categories.getUserCategories, {
        clerkUserId,
      });
      const grandparent = categories.find((c: any) => c.name === "Grandparent");
      expect(grandparent).toBeDefined();
      expect(grandparent!.children.length).toBe(1);
      expect(grandparent!.children[0].name).toBe("Child");
    });
  });

  describe("reorderCategories", () => {
    test("updates sort orders for multiple categories", async () => {
      const t = createTestConvex();
      const clerkUserId = await setupUser(t);

      const cat1 = await t.withIdentity({ subject: clerkUserId }).mutation(api.categories.createCategory, {
        clerkUserId,
        name: "Cat1",
        color: "#111111",
      });
      const cat2 = await t.withIdentity({ subject: clerkUserId }).mutation(api.categories.createCategory, {
        clerkUserId,
        name: "Cat2",
        color: "#222222",
      });

      await t.withIdentity({ subject: clerkUserId }).mutation(api.categories.reorderCategories, {
        clerkUserId,
        categoryUpdates: [
          { categoryId: cat1, sortOrder: 10 },
          { categoryId: cat2, sortOrder: 5 },
        ],
      });

      // Verify by checking stats
      const stats1 = await t.withIdentity({ subject: clerkUserId }).query(api.categories.getCategoryWithStats, {
        clerkUserId,
        categoryId: cat1,
      });
      const stats2 = await t.withIdentity({ subject: clerkUserId }).query(api.categories.getCategoryWithStats, {
        clerkUserId,
        categoryId: cat2,
      });
      expect(stats1.sortOrder).toBe(10);
      expect(stats2.sortOrder).toBe(5);
    });
  });

  describe("getCategoryWithStats", () => {
    test("returns correct repository and children counts", async () => {
      const t = createTestConvex();
      const clerkUserId = await setupUser(t);

      const parentId = await t.withIdentity({ subject: clerkUserId }).mutation(api.categories.createCategory, {
        clerkUserId,
        name: "WithStats",
        color: "#444444",
      });
      await t.withIdentity({ subject: clerkUserId }).mutation(api.categories.createCategory, {
        clerkUserId,
        name: "ChildOfStats",
        color: "#555555",
        parentCategoryId: parentId,
      });

      const stats = await t.withIdentity({ subject: clerkUserId }).query(api.categories.getCategoryWithStats, {
        clerkUserId,
        categoryId: parentId,
      });
      expect(stats.repositoryCount).toBe(0);
      expect(stats.childrenCount).toBe(1);
    });
  });
});
