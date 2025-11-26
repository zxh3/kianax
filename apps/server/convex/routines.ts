import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUser } from "./auth";

/**
 * Create a new routine
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived"),
    ),
    triggerType: v.union(
      v.literal("manual"),
      v.literal("cron"),
      v.literal("webhook"),
      v.literal("event"),
    ),
    triggerConfig: v.optional(v.any()),
    nodes: v.array(
      v.object({
        id: v.string(),
        pluginId: v.string(),
        label: v.string(),
        position: v.object({ x: v.number(), y: v.number() }),
        config: v.optional(v.any()),
      }),
    ),
    connections: v.array(
      v.object({
        id: v.string(),
        sourceNodeId: v.string(),
        targetNodeId: v.string(),
        sourceHandle: v.optional(v.string()),
        targetHandle: v.optional(v.string()),
      }),
    ),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const routineId = await ctx.db.insert("routines", {
      userId: user._id,
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
    const user = await requireAuthUser(ctx);
    const routine = await ctx.db.get(args.id);
    if (!routine || routine.userId !== user._id) {
      return null; // Hide if not owner
    }
    return routine;
  },
});

/**
 * List all routines for a user
 */
export const listByUser = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("active"),
        v.literal("paused"),
        v.literal("archived"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    if (args.status) {
      const status = args.status; // Narrow type for TypeScript
      return await ctx.db
        .query("routines")
        .withIndex("by_user_and_status", (q) =>
          q.eq("userId", user._id).eq("status", status),
        )
        .collect();
    }

    return await ctx.db
      .query("routines")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
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
        v.literal("archived"),
      ),
    ),
    nodes: v.optional(
      v.array(
        v.object({
          id: v.string(),
          pluginId: v.string(),
          label: v.string(),
          position: v.object({ x: v.number(), y: v.number() }),
          config: v.optional(v.any()),
        }),
      ),
    ),
    connections: v.optional(
      v.array(
        v.object({
          id: v.string(),
          sourceNodeId: v.string(),
          targetNodeId: v.string(),
          sourceHandle: v.optional(v.string()),
          targetHandle: v.optional(v.string()),
        }),
      ),
    ),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const { id, ...updates } = args;

    // Get current routine to increment version if nodes/connections changed
    const current = await ctx.db.get(id);
    if (!current || current.userId !== user._id) {
      throw new Error(`Routine ${id} not found or unauthorized`);
    }

    const shouldIncrementVersion =
      updates.nodes !== undefined || updates.connections !== undefined;

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
    const user = await requireAuthUser(ctx);
    const routine = await ctx.db.get(args.id);
    if (!routine || routine.userId !== user._id) {
      throw new Error(`Routine ${args.id} not found or unauthorized`);
    }
    await ctx.db.delete(args.id);
  },
});

/**
 * Add a node to a routine
 */
export const addNode = mutation({
  args: {
    routineId: v.id("routines"),
    node: v.object({
      id: v.string(),
      pluginId: v.string(),
      label: v.string(),
      position: v.object({ x: v.number(), y: v.number() }),
      config: v.optional(v.any()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const routine = await ctx.db.get(args.routineId);
    if (!routine || routine.userId !== user._id) {
      throw new Error(`Routine ${args.routineId} not found or unauthorized`);
    }

    const updatedNodes = [...routine.nodes, args.node];

    await ctx.db.patch(args.routineId, {
      nodes: updatedNodes,
      version: routine.version + 1,
    });

    return args.node.id;
  },
});

/**
 * Add a connection to a routine
 */
export const addConnection = mutation({
  args: {
    routineId: v.id("routines"),
    connection: v.object({
      id: v.string(),
      sourceNodeId: v.string(),
      targetNodeId: v.string(),
      sourceHandle: v.optional(v.string()),
      targetHandle: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const routine = await ctx.db.get(args.routineId);
    if (!routine || routine.userId !== user._id) {
      throw new Error(`Routine ${args.routineId} not found or unauthorized`);
    }

    const updatedConnections = [...routine.connections, args.connection];

    await ctx.db.patch(args.routineId, {
      connections: updatedConnections,
      version: routine.version + 1,
    });

    return args.connection.id;
  },
});

/**
 * Search routines by name or description
 */
export const search = query({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    // Fetch all user routines and filter in memory (efficient enough for <1000 items)
    const routines = await ctx.db
      .query("routines")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const lowerQuery = args.query.toLowerCase();

    return routines.filter(
      (r) =>
        r.name.toLowerCase().includes(lowerQuery) ||
        r.description?.toLowerCase().includes(lowerQuery),
    );
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
    const user = await requireAuthUser(ctx);
    const routine = await ctx.db.get(args.id);
    if (!routine || routine.userId !== user._id) {
      throw new Error(`Routine ${args.id} not found or unauthorized`);
    }
    await ctx.db.patch(args.id, {
      lastExecutedAt: args.timestamp,
    });
  },
});
