import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";

type AuthContext = {
  auth: {
    getUserIdentity: () => Promise<UserIdentity | null>;
  };
};

type DatabaseAuthContext =
  | Pick<QueryCtx, "auth" | "db">
  | Pick<MutationCtx, "auth" | "db">;

type ActionAuthContext = Pick<ActionCtx, "auth" | "runQuery">;

/**
 * Returns the authoritative Clerk subject for a request.
 *
 * Client-provided Clerk IDs exist only for backwards-compatible API arguments;
 * they must match the authenticated subject and are never used as authority.
 */
export async function requireAuthenticatedSubject(
  ctx: AuthContext,
  suppliedClerkUserId?: string,
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity?.subject) {
    throw new ConvexError("Unauthenticated");
  }

  if (suppliedClerkUserId !== undefined && suppliedClerkUserId !== identity.subject) {
    throw new ConvexError("Authenticated user does not match clerkUserId");
  }

  return identity.subject;
}

/** Look up the app user record for an already-verified Clerk subject. */
export async function getUserByAuthenticatedSubject(
  ctx: Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">,
  subject: string,
): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", subject))
    .first();
}

/** Require both a valid Clerk identity and its corresponding local user row. */
export async function requireAuthenticatedUser(
  ctx: DatabaseAuthContext,
  suppliedClerkUserId?: string,
): Promise<Doc<"users">> {
  const subject = await requireAuthenticatedSubject(ctx, suppliedClerkUserId);
  const user = await getUserByAuthenticatedSubject(ctx, subject);
  if (!user) {
    throw new ConvexError("User not found");
  }
  return user;
}

/**
 * Action equivalent of requireAuthenticatedUser. Actions have no direct DB
 * access, so the lookup is performed through the internal query only after
 * the action has verified its caller identity.
 */
export async function requireAuthenticatedActionUser(
  ctx: ActionAuthContext,
  suppliedClerkUserId?: string,
): Promise<Doc<"users">> {
  const subject = await requireAuthenticatedSubject(ctx, suppliedClerkUserId);
  const user = await ctx.runQuery(internal.users.getUserByClerkId, {
    clerkUserId: subject,
  });
  if (!user) {
    throw new ConvexError("User not found");
  }
  return user;
}

/** Fail without revealing whether a foreign resource exists. */
export function assertUserOwns(
  ownerId: Id<"users">,
  authenticatedUserId: Id<"users">,
  resource = "Resource",
): void {
  if (ownerId !== authenticatedUserId) {
    throw new ConvexError(`${resource} not found or access denied`);
  }
}
