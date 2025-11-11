import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { createAuth, authComponent } from "./auth";

/**
 * Helper to get authenticated user or throw
 * Throws "Not authenticated" error if user is not authenticated
 */
export async function getCurrentUserOrThrow(ctx: QueryCtx | MutationCtx) {
  const user = await authComponent.getAuthUser(ctx);

  if (!user) {
    throw new Error("Not authenticated");
  }

  return user;
}

/**
 * Helper to get current authenticated user (returns null if not authenticated)
 */
export async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  return await authComponent.getAuthUser(ctx);
}

/**
 * Query to get current user information
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});

export const updateUserPassword = mutation({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    await auth.api.changePassword({
      body: {
        currentPassword: args.currentPassword,
        newPassword: args.newPassword,
      },
      headers,
    });
  },
});
