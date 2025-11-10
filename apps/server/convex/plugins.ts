import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { authComponent } from "./auth";

/**
 * Helper to get authenticated user ID
 * Returns userId if authenticated, undefined otherwise
 */
async function getAuthUser(ctx: QueryCtx | MutationCtx) {
  return await authComponent.getAuthUser(ctx);
}

/**
 * Helper to get authenticated user ID or throw
 * Throws "Not authenticated" error if user is not authenticated
 */
async function requireAuthUser(ctx: QueryCtx | MutationCtx) {
  const user = await getAuthUser(ctx);

  if (!user) {
    throw new Error("Not authenticated");
  }
  return user;
}

/**
 * Get all plugins installed by the current user
 */
export const getUserPlugins = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthUser(ctx);

    // Return empty array if not authenticated (allows page to load)
    const plugins = await ctx.db
      .query("installed_plugins")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return plugins;
  },
});

/**
 * Check if a plugin is installed by the current user
 */
export const isPluginInstalled = query({
  args: { pluginId: v.string() },
  handler: async (ctx, { pluginId }) => {
    const user = await requireAuthUser(ctx);

    // Return false if not authenticated
    const plugin = await ctx.db
      .query("installed_plugins")
      .withIndex("by_user_and_plugin", (q) =>
        q.eq("userId", user._id).eq("pluginId", pluginId),
      )
      .unique();

    return plugin !== null;
  },
});

/**
 * Install a plugin for the current user
 */
export const installPlugin = mutation({
  args: {
    pluginId: v.string(),
    version: v.string(),
    config: v.optional(v.any()),
  },
  handler: async (ctx, { pluginId, version, config }) => {
    const user = await requireAuthUser(ctx);

    // Check if already installed
    const existing = await ctx.db
      .query("installed_plugins")
      .withIndex("by_user_and_plugin", (q) =>
        q.eq("userId", user._id).eq("pluginId", pluginId),
      )
      .unique();

    if (existing) {
      throw new Error("Plugin already installed");
    }

    // Install the plugin
    const pluginDoc = await ctx.db.insert("installed_plugins", {
      userId: user._id,
      pluginId,
      version,
      enabled: true,
      config: config ?? {},
      credentialsSet: false,
      installedAt: Date.now(),
    });

    return pluginDoc;
  },
});

/**
 * Uninstall a plugin for the current user
 */
export const uninstallPlugin = mutation({
  args: { pluginId: v.string() },
  handler: async (ctx, { pluginId }) => {
    const user = await requireAuthUser(ctx);

    const plugin = await ctx.db
      .query("installed_plugins")
      .withIndex("by_user_and_plugin", (q) =>
        q.eq("userId", user._id).eq("pluginId", pluginId),
      )
      .unique();

    if (!plugin) {
      throw new Error("Plugin not found");
    }

    // Delete plugin credentials if they exist
    const credentials = await ctx.db
      .query("plugin_credentials")
      .withIndex("by_user_and_plugin", (q) =>
        q.eq("userId", user._id).eq("pluginId", pluginId),
      )
      .unique();

    if (credentials) {
      await ctx.db.delete(credentials._id);
    }

    // Delete the plugin installation
    await ctx.db.delete(plugin._id);

    return { success: true };
  },
});

/**
 * Toggle plugin enabled state
 */
export const togglePlugin = mutation({
  args: {
    pluginId: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, { pluginId, enabled }) => {
    const user = await requireAuthUser(ctx);

    const plugin = await ctx.db
      .query("installed_plugins")
      .withIndex("by_user_and_plugin", (q) =>
        q.eq("userId", user._id).eq("pluginId", pluginId),
      )
      .unique();

    if (!plugin) {
      throw new Error("Plugin not found");
    }

    await ctx.db.patch(plugin._id, { enabled });

    return { success: true };
  },
});

/**
 * Update plugin configuration
 */
export const updatePluginConfig = mutation({
  args: {
    pluginId: v.string(),
    config: v.any(),
  },
  handler: async (ctx, { pluginId, config }) => {
    const user = await requireAuthUser(ctx);

    const plugin = await ctx.db
      .query("installed_plugins")
      .withIndex("by_user_and_plugin", (q) =>
        q.eq("userId", user._id).eq("pluginId", pluginId),
      )
      .unique();

    if (!plugin) {
      throw new Error("Plugin not found");
    }

    await ctx.db.patch(plugin._id, { config });

    return { success: true };
  },
});

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

    const plugin = await ctx.db
      .query("installed_plugins")
      .withIndex("by_user_and_plugin", (q) =>
        q.eq("userId", user._id).eq("pluginId", pluginId),
      )
      .unique();

    if (!plugin) {
      throw new Error("Plugin not installed");
    }

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

    // Mark credentials as set
    await ctx.db.patch(plugin._id, { credentialsSet: true });

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
