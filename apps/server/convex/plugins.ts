import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUser } from "./auth";

/**
 * Set plugin credentials (for future encryption implementation)
 */
export const setPluginCredentials = mutation({
  args: {
    pluginId: v.string(),
    credentials: v.any(),
  },
  handler: async (ctx, { pluginId, credentials }) => {
    const user = await requireAuthUser(ctx);

    // Check if credentials already exist
    const existing = await ctx.db
      .query("plugin_credentials")
      .withIndex("by_user_and_plugin", (q) =>
        q.eq("userId", user._id).eq("pluginId", pluginId),
      )
      .unique();

    if (existing) {
      // Update existing credentials
      await ctx.db.patch(existing._id, {
        credentials, // TODO: Encrypt before storing
      });
    } else {
      // Create new credentials
      await ctx.db.insert("plugin_credentials", {
        userId: user._id,
        pluginId,
        credentials, // TODO: Encrypt before storing
      });
    }

    return { success: true };
  },
});

/**
 * Get plugin credentials for the current user
 */
export const getPluginCredentials = query({
  args: { pluginId: v.string() },
  handler: async (ctx, { pluginId }) => {
    const user = await requireAuthUser(ctx);

    const credentials = await ctx.db
      .query("plugin_credentials")
      .withIndex("by_user_and_plugin", (q) =>
        q.eq("userId", user._id).eq("pluginId", pluginId),
      )
      .unique();

    if (!credentials) {
      return null;
    }

    // TODO: Decrypt before returning
    return credentials.credentials;
  },
});

/**
 * Get plugin credentials for the worker (System Internal)
 * DANGEROUS: This query allows fetching credentials by userId.
 * It should only be used by the secure Worker environment.
 */
export const getWorkerCredentials = query({
  args: { userId: v.string(), pluginId: v.string() },
  handler: async (ctx, { userId, pluginId }) => {
    // TODO: Authenticate that this is the worker (e.g. check secret header or strict role)
    const credentials = await ctx.db
      .query("plugin_credentials")
      .withIndex("by_user_and_plugin", (q) =>
        q.eq("userId", userId).eq("pluginId", pluginId),
      )
      .unique();

    return credentials?.credentials || null;
  },
});
