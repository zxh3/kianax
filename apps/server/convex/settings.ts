import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get user settings
 */
export const get = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("user_settings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

/**
 * Update user settings
 * Upserts the record if it doesn't exist
 */
export const updateTheme = mutation({
  args: {
    userId: v.string(),
    theme: v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("user_settings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        theme: args.theme,
      });
    } else {
      await ctx.db.insert("user_settings", {
        userId: args.userId,
        theme: args.theme,
      });
    }
  },
});
