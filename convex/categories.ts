import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getUserByClerkIdHelper as getUserByClerkId } from "./users";

// Get all categories for a user (internal version that accepts userId directly)
export const getUserCategoriesByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .order("asc")
      .collect();

    // Build hierarchical structure
    type CategoryWithChildren = typeof categories[number] & { children: CategoryWithChildren[] };
    const categoryMap = new Map<string, CategoryWithChildren>();
    const rootCategories: CategoryWithChildren[] = [];

    // First pass: create map of all categories
    categories.forEach((category) => {
      categoryMap.set(category._id, { ...category, children: [] });
    });

    // Second pass: build hierarchy
    categories.forEach((category) => {
      const cat = categoryMap.get(category._id);
      if (!cat) return;
      if (category.parentCategoryId) {
        const parent = categoryMap.get(category.parentCategoryId);
        if (parent) {
          parent.children.push(cat);
        }
      } else {
        rootCategories.push(cat);
      }
    });

    return rootCategories;
  },
});

// Get all categories for a user
export const getUserCategories = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", clerkUserId))
      .first();
      
    if (!user) {
      // Return empty array instead of throwing error
      // This allows the app to work gracefully while UserInitializer creates the user
      return [];
    }

    const categories = await ctx.db
      .query("categories")
      .withIndex("by_user_id", (q) => q.eq("userId", user._id))
      .order("asc")
      .collect();

    // Build hierarchical structure
    type CategoryWithChildren = typeof categories[number] & { children: CategoryWithChildren[] };
    const categoryMap = new Map<string, CategoryWithChildren>();
    const rootCategories: CategoryWithChildren[] = [];

    // First pass: create map of all categories
    categories.forEach((category) => {
      categoryMap.set(category._id, { ...category, children: [] });
    });

    // Second pass: build hierarchy
    categories.forEach((category) => {
      const cat = categoryMap.get(category._id);
      if (!cat) return;
      if (category.parentCategoryId) {
        const parent = categoryMap.get(category.parentCategoryId);
        if (parent) {
          parent.children.push(cat);
        }
      } else {
        rootCategories.push(cat);
      }
    });

    return rootCategories;
  },
});

// Create a new category
export const createCategory = mutation({
  args: {
    clerkUserId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.string(),
    icon: v.optional(v.string()),
    parentCategoryId: v.optional(v.id("categories")),
  },
  handler: async (ctx, args) => {
    const user = await getUserByClerkId(ctx, args.clerkUserId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    // Check if parent category exists and belongs to user
    if (args.parentCategoryId) {
      const parentCategory = await ctx.db.get(args.parentCategoryId);
      if (!parentCategory || parentCategory.userId !== user._id) {
        throw new ConvexError("Invalid parent category");
      }
    }

    // Get next sort order
    const existingCategories = await ctx.db
      .query("categories")
      .withIndex("by_user_and_parent", (q) => 
        q.eq("userId", user._id).eq("parentCategoryId", args.parentCategoryId ?? undefined)
      )
      .collect();

    const maxSortOrder = Math.max(...existingCategories.map(c => c.sortOrder), 0);

    const now = Date.now();
    return await ctx.db.insert("categories", {
      userId: user._id,
      name: args.name,
      description: args.description,
      color: args.color,
      icon: args.icon,
      parentCategoryId: args.parentCategoryId,
      sortOrder: maxSortOrder + 1,
      metadata: {
        repositoryCount: 0,
      },
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update category
export const updateCategory = mutation({
  args: {
    clerkUserId: v.string(),
    categoryId: v.id("categories"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    parentCategoryId: v.optional(v.id("categories")),
  },
  handler: async (ctx, args) => {
    const user = await getUserByClerkId(ctx, args.clerkUserId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== user._id) {
      throw new ConvexError("Category not found");
    }

    // Check if new parent category is valid
    if (args.parentCategoryId) {
      const parentCategory = await ctx.db.get(args.parentCategoryId);
      if (!parentCategory || parentCategory.userId !== user._id) {
        throw new ConvexError("Invalid parent category");
      }
      
      // Prevent circular references
      if (args.parentCategoryId === args.categoryId) {
        throw new ConvexError("Cannot make category a child of itself");
      }
    }

    const updateData: any = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updateData.name = args.name;
    if (args.description !== undefined) updateData.description = args.description;
    if (args.color !== undefined) updateData.color = args.color;
    if (args.icon !== undefined) updateData.icon = args.icon;
    if (args.parentCategoryId !== undefined) updateData.parentCategoryId = args.parentCategoryId;

    await ctx.db.patch(args.categoryId, updateData);
  },
});

// Delete category
export const deleteCategory = mutation({
  args: {
    clerkUserId: v.string(),
    categoryId: v.id("categories"),
    moveRepositoriesTo: v.optional(v.id("categories")), // Optional category to move repos to
  },
  handler: async (ctx, args) => {
    const user = await getUserByClerkId(ctx, args.clerkUserId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== user._id) {
      throw new ConvexError("Category not found");
    }

    // Check if destination category is valid
    if (args.moveRepositoriesTo) {
      const destCategory = await ctx.db.get(args.moveRepositoriesTo);
      if (!destCategory || destCategory.userId !== user._id) {
        throw new ConvexError("Invalid destination category");
      }
    }

    // Handle child categories - move to parent or root
    const childCategories = await ctx.db
      .query("categories")
      .withIndex("by_user_and_parent", (q) => 
        q.eq("userId", user._id).eq("parentCategoryId", args.categoryId)
      )
      .collect();

    for (const child of childCategories) {
      await ctx.db.patch(child._id, {
        parentCategoryId: category.parentCategoryId,
        updatedAt: Date.now(),
      });
    }

    // Handle repositories in this category
    const repositoryCategories = await ctx.db
      .query("repositoryCategories")
      .withIndex("by_category_id", (q) => q.eq("categoryId", args.categoryId))
      .collect();

    for (const repoCat of repositoryCategories) {
      if (args.moveRepositoriesTo) {
        // Move to specified category
        await ctx.db.patch(repoCat._id, {
          categoryId: args.moveRepositoriesTo,
        });
      } else {
        // Remove categorization
        await ctx.db.delete(repoCat._id);
      }
    }

    // Delete the category
    await ctx.db.delete(args.categoryId);
  },
});

// Reorder categories
export const reorderCategories = mutation({
  args: {
    clerkUserId: v.string(),
    categoryUpdates: v.array(v.object({
      categoryId: v.id("categories"),
      sortOrder: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const user = await getUserByClerkId(ctx, args.clerkUserId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    const now = Date.now();
    
    // Update sort orders for all categories in batch
    for (const update of args.categoryUpdates) {
      const category = await ctx.db.get(update.categoryId);
      if (category && category.userId === user._id) {
        await ctx.db.patch(update.categoryId, {
          sortOrder: update.sortOrder,
          updatedAt: now,
        });
      }
    }
  },
});

// Get category with repository count
export const getCategoryWithStats = query({
  args: {
    clerkUserId: v.string(),
    categoryId: v.id("categories"),
  },
  handler: async (ctx, { clerkUserId, categoryId }) => {
    const user = await getUserByClerkId(ctx, clerkUserId);
    if (!user) {
      throw new ConvexError("User not found");
    }

    const category = await ctx.db.get(categoryId);
    if (!category || category.userId !== user._id) {
      throw new ConvexError("Category not found");
    }

    // Get repository count
    const repositoryCount = await ctx.db
      .query("repositoryCategories")
      .withIndex("by_category_id", (q) => q.eq("categoryId", categoryId))
      .collect()
      .then(results => results.length);

    // Get child categories count
    const childrenCount = await ctx.db
      .query("categories")
      .withIndex("by_user_and_parent", (q) => 
        q.eq("userId", user._id).eq("parentCategoryId", categoryId)
      )
      .collect()
      .then(results => results.length);

    return {
      ...category,
      repositoryCount,
      childrenCount,
    };
  },
});
