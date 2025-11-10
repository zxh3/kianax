import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Create a new routine
 */
export const create = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived")
    ),
    triggerType: v.union(
      v.literal("manual"),
      v.literal("cron"),
      v.literal("webhook"),
      v.literal("event")
    ),
    triggerConfig: v.optional(v.any()),
    nodes: v.array(
      v.object({
        id: v.string(),
        pluginId: v.string(),
        type: v.union(
          v.literal("input"),
          v.literal("processor"),
          v.literal("logic"),
          v.literal("output")
        ),
        label: v.string(),
        position: v.object({ x: v.number(), y: v.number() }),
        config: v.optional(v.any()),
        enabled: v.boolean(),
      })
    ),
    connections: v.array(
      v.object({
        id: v.string(),
        sourceNodeId: v.string(),
        targetNodeId: v.string(),
        sourceHandle: v.optional(v.string()),
        targetHandle: v.optional(v.string()),
        condition: v.optional(
          v.object({
            type: v.union(v.literal("branch"), v.literal("default")),
            value: v.optional(v.string()),
          })
        ),
      })
    ),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const routineId = await ctx.db.insert("routines", {
      userId: args.userId,
      name: args.name,
      description: args.description,
      status: args.status,
      triggerType: args.triggerType,
      triggerConfig: args.triggerConfig,
      nodes: args.nodes,
      connections: args.connections,
      tags: args.tags,
      version: 1,
    });

    return routineId;
  },
});

/**
 * Get a routine by ID
 */
export const get = query({
  args: {
    id: v.id("routines"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * List all routines for a user
 */
export const listByUser = query({
  args: {
    userId: v.string(),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("active"),
        v.literal("paused"),
        v.literal("archived")
      )
    ),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("routines")
        .withIndex("by_user_and_status", (q) =>
          q.eq("userId", args.userId).eq("status", args.status)
        )
        .collect();
    }

    return await ctx.db
      .query("routines")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

/**
 * Update a routine
 */
export const update = mutation({
  args: {
    id: v.id("routines"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("active"),
        v.literal("paused"),
        v.literal("archived")
      )
    ),
    nodes: v.optional(
      v.array(
        v.object({
          id: v.string(),
          pluginId: v.string(),
          type: v.union(
            v.literal("input"),
            v.literal("processor"),
            v.literal("logic"),
            v.literal("output")
          ),
          label: v.string(),
          position: v.object({ x: v.number(), y: v.number() }),
          config: v.optional(v.any()),
          enabled: v.boolean(),
        })
      )
    ),
    connections: v.optional(
      v.array(
        v.object({
          id: v.string(),
          sourceNodeId: v.string(),
          targetNodeId: v.string(),
          sourceHandle: v.optional(v.string()),
          targetHandle: v.optional(v.string()),
          condition: v.optional(
            v.object({
              type: v.union(v.literal("branch"), v.literal("default")),
              value: v.optional(v.string()),
            })
          ),
        })
      )
    ),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    // Get current routine to increment version if nodes/connections changed
    const current = await ctx.db.get(id);
    if (!current) {
      throw new Error(`Routine ${id} not found`);
    }

    const shouldIncrementVersion = updates.nodes !== undefined || updates.connections !== undefined;

    await ctx.db.patch(id, {
      ...updates,
      ...(shouldIncrementVersion ? { version: current.version + 1 } : {}),
    });

    return id;
  },
});

/**
 * Delete a routine
 */
export const deleteRoutine = mutation({
  args: {
    id: v.id("routines"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

/**
 * Update last executed timestamp
 */
export const updateLastExecuted = mutation({
  args: {
    id: v.id("routines"),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      lastExecutedAt: args.timestamp,
    });
  },
});
