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
        credentialMappings: v.optional(v.record(v.string(), v.string())),
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
          credentialMappings: v.optional(v.record(v.string(), v.string())),
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
      credentialMappings: v.optional(v.record(v.string(), v.string())),
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

// Variable validators (reusable)
const variableValidator = v.object({
  id: v.string(),
  name: v.string(),
  type: v.union(
    v.literal("string"),
    v.literal("number"),
    v.literal("boolean"),
    v.literal("json"),
  ),
  value: v.any(),
  description: v.optional(v.string()),
});

/**
 * Set all variables for a routine (replaces existing)
 */
export const setVariables = mutation({
  args: {
    routineId: v.id("routines"),
    variables: v.array(variableValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const routine = await ctx.db.get(args.routineId);
    if (!routine || routine.userId !== user._id) {
      throw new Error(`Routine ${args.routineId} not found or unauthorized`);
    }

    await ctx.db.patch(args.routineId, {
      variables: args.variables,
    });
  },
});

/**
 * Add a single variable to a routine
 */
export const addVariable = mutation({
  args: {
    routineId: v.id("routines"),
    variable: variableValidator,
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const routine = await ctx.db.get(args.routineId);
    if (!routine || routine.userId !== user._id) {
      throw new Error(`Routine ${args.routineId} not found or unauthorized`);
    }

    // Check for duplicate name
    const existingVars = routine.variables || [];
    if (existingVars.some((v) => v.name === args.variable.name)) {
      throw new Error(`Variable "${args.variable.name}" already exists`);
    }

    await ctx.db.patch(args.routineId, {
      variables: [...existingVars, args.variable],
    });

    return args.variable.id;
  },
});

/**
 * Update a single variable in a routine
 */
export const updateVariable = mutation({
  args: {
    routineId: v.id("routines"),
    variableId: v.string(),
    updates: v.object({
      name: v.optional(v.string()),
      type: v.optional(
        v.union(
          v.literal("string"),
          v.literal("number"),
          v.literal("boolean"),
          v.literal("json"),
        ),
      ),
      value: v.optional(v.any()),
      description: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const routine = await ctx.db.get(args.routineId);
    if (!routine || routine.userId !== user._id) {
      throw new Error(`Routine ${args.routineId} not found or unauthorized`);
    }

    const existingVars = routine.variables || [];
    const varIndex = existingVars.findIndex((v) => v.id === args.variableId);
    if (varIndex === -1) {
      throw new Error(`Variable ${args.variableId} not found`);
    }

    // Check for duplicate name if renaming
    if (
      args.updates.name &&
      existingVars.some(
        (v) => v.name === args.updates.name && v.id !== args.variableId,
      )
    ) {
      throw new Error(`Variable "${args.updates.name}" already exists`);
    }

    const updatedVars = [...existingVars];
    const currentVar = updatedVars[varIndex]!;
    updatedVars[varIndex] = {
      id: currentVar.id,
      name: args.updates.name ?? currentVar.name,
      type: args.updates.type ?? currentVar.type,
      value:
        args.updates.value !== undefined
          ? args.updates.value
          : currentVar.value,
      description: args.updates.description ?? currentVar.description,
    };

    await ctx.db.patch(args.routineId, {
      variables: updatedVars,
    });
  },
});

/**
 * Remove a variable from a routine
 */
export const removeVariable = mutation({
  args: {
    routineId: v.id("routines"),
    variableId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const routine = await ctx.db.get(args.routineId);
    if (!routine || routine.userId !== user._id) {
      throw new Error(`Routine ${args.routineId} not found or unauthorized`);
    }

    const existingVars = routine.variables || [];
    const updatedVars = existingVars.filter((v) => v.id !== args.variableId);

    if (updatedVars.length === existingVars.length) {
      throw new Error(`Variable ${args.variableId} not found`);
    }

    await ctx.db.patch(args.routineId, {
      variables: updatedVars,
    });
  },
});

/**
 * Get variables for a routine
 */
export const getVariables = query({
  args: {
    routineId: v.id("routines"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthUser(ctx);
    const routine = await ctx.db.get(args.routineId);
    if (!routine || routine.userId !== user._id) {
      return [];
    }
    return routine.variables || [];
  },
});
