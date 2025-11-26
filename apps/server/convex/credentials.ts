import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  action,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import { requireAuthUser } from "./auth";
import { getCredentialType } from "@kianax/plugins";

/**
 * List all credentials for the current user.
 * Returns the list without the sensitive 'data' field.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthUser(ctx);

    const credentials = await ctx.db
      .query("user_credentials")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Return without the sensitive data
    return credentials.map(({ data, ...rest }) => rest);
  },
});

/**
 * Create a new credential.
 */
export const create = mutation({
  args: {
    typeId: v.string(),
    name: v.string(),
    data: v.string(), // Encrypted JSON string (or plain for MVP)
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);

    const credentialId = await ctx.db.insert("user_credentials", {
      userId: user._id,
      typeId: args.typeId,
      name: args.name,
      data: args.data,
      metadata: args.metadata,
    });

    return credentialId;
  },
});

/**
 * Delete a credential.
 */
export const remove = mutation({
  args: {
    id: v.id("user_credentials"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);

    const credential = await ctx.db.get(args.id);
    if (!credential) {
      throw new Error("Credential not found");
    }

    if (credential.userId !== user._id) {
      throw new Error("Unauthorized");
    }

    await ctx.db.delete(args.id);
  },
});

/**
 * Internal: Get full credential with secrets.
 */
export const getInternal = internalQuery({
  args: { id: v.id("user_credentials") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Internal: Update credential data.
 */
export const updateInternal = internalMutation({
  args: {
    id: v.id("user_credentials"),
    data: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      data: args.data,
      metadata: args.metadata,
    });
  },
});

/**
 * Get credential data for execution.
 * Handles decryption and OAuth token refresh if necessary.
 */
export const getForExecution = action({
  args: {
    credentialId: v.id("user_credentials"),
  },
  handler: async (ctx, args): Promise<Record<string, any>> => {
    // Fetch credential
    const credential = await ctx.runQuery(internal.credentials.getInternal, {
      id: args.credentialId,
    });

    if (!credential) {
      throw new Error(`Credential not found: ${args.credentialId}`);
    }

    const typeDef = getCredentialType(credential.typeId);

    if (typeDef?.type === "oauth2") {
      // Use OAuth action to ensure token is fresh
      const accessToken = await ctx.runAction(api.oauth.getAccessToken, {
        credentialId: args.credentialId,
      });

      return { access_token: accessToken };
    }

    // Simple credential: return parsed data
    return JSON.parse(credential.data);
  },
});
