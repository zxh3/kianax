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
