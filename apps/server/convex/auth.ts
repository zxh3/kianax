import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth";
import type { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";

const siteUrl = process.env.SITE_URL!;

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (
  ctx: GenericCtx<DataModel>,
  { optionsOnly } = { optionsOnly: false },
) => {
  return betterAuth({
    // disable logging when createAuth is called just to generate options.
    // this is not required, but there's a lot of noise in logs without it.
    logger: {
      disabled: optionsOnly,
    },
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    // Configure simple, non-verified email/password to get started
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      },
    },
    plugins: [
      // The Convex plugin is required for Convex compatibility
      convex(),
    ],
  });
};

/**
 * Helper to get authenticated user ID
 * Returns userId if authenticated, undefined otherwise
 */
export async function getAuthUser(ctx: QueryCtx | MutationCtx | ActionCtx) {
  return await authComponent.getAuthUser(
    ctx as unknown as GenericCtx<DataModel>,
  );
}

/**
 * Helper to get authenticated user ID or throw
 * Throws "Not authenticated" error if user is not authenticated
 */
export async function requireAuthUser(ctx: QueryCtx | MutationCtx | ActionCtx) {
  const user = await getAuthUser(ctx);

  if (!user) {
    throw new Error("Not authenticated");
  }
  return user;
}

// Example function for getting the current user
// Feel free to edit, omit, etc.
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx as unknown as GenericCtx<DataModel>);
  },
});
