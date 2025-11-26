/**
 * Routine Execution Mutations and Queries
 *
 * Convex functions for managing routine execution state.
 * Called by Temporal workers during workflow execution.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Create a new routine execution
 * Called when a Temporal workflow starts
 */
export const create = mutation({
  args: {
    routineId: v.id("routines"),
    userId: v.string(),
    workflowId: v.string(),
    runId: v.string(),
    triggerType: v.union(
      v.literal("manual"),
      v.literal("scheduled"),
      v.literal("webhook"),
      v.literal("event"),
    ),
    triggerData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const executionId = await ctx.db.insert("routine_executions", {
      routineId: args.routineId,
      userId: args.userId,
      workflowId: args.workflowId,
      runId: args.runId,
      status: "running",
      triggerType: args.triggerType,
      triggerData: args.triggerData,
      nodeStates: [],
      startedAt: Date.now(),
    });

    return executionId;
  },
});

/**
 * Update routine execution status
 * Called by Temporal activities during workflow execution
 */
export const updateStatus = mutation({
  args: {
    workflowId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
      v.literal("timeout"),
    ),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    error: v.optional(
      v.object({
        message: v.string(),
        stack: v.optional(v.string()),
      }),
    ),
    executionPath: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Find execution by workflow ID
    const execution = await ctx.db
      .query("routine_executions")
      .withIndex("by_workflow_id", (q) => q.eq("workflowId", args.workflowId))
      .first();

    if (!execution) {
      throw new Error(
        `Execution not found for workflow ID: ${args.workflowId}`,
      );
    }

    // Calculate duration if completed
    let duration: number | undefined;
    if (args.completedAt) {
      duration = args.completedAt - execution.startedAt;
    }

    // Update execution status
    await ctx.db.patch(execution._id, {
      status: args.status,
      ...(args.startedAt !== undefined && { startedAt: args.startedAt }),
      ...(args.completedAt !== undefined && { completedAt: args.completedAt }),
      ...(duration !== undefined && { duration }),
      ...(args.error !== undefined && { error: args.error }),
      ...(args.executionPath !== undefined && {
        executionPath: args.executionPath,
      }),
    });

    return execution._id;
  },
});

/**
 * Store a node execution result
 * Called by Temporal activities after each node executes
 *
 * For loop nodes, this creates a new entry for each iteration.
 * Query by (nodeId + iteration) to get specific iteration results.
 */
export const storeNodeResult = mutation({
  args: {
    workflowId: v.string(),
    nodeId: v.string(),
    iteration: v.optional(v.number()),
    status: v.string(),
    output: v.optional(v.any()),
    error: v.optional(
      v.object({
        message: v.string(),
        stack: v.optional(v.string()),
      }),
    ),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Find execution by workflow ID
    const execution = await ctx.db
      .query("routine_executions")
      .withIndex("by_workflow_id", (q) => q.eq("workflowId", args.workflowId))
      .first();

    if (!execution) {
      throw new Error(
        `Execution not found for workflow ID: ${args.workflowId}`,
      );
    }

    // For "running" status, update existing entry if present, otherwise add new
    if (args.status === "running") {
      // Check if there's already an entry for this node
      const existingIndex = execution.nodeStates.findIndex(
        (s: any) => s.nodeId === args.nodeId,
      );

      if (existingIndex >= 0) {
        // Update existing entry
        const updatedNodeStates = [...execution.nodeStates];
        updatedNodeStates[existingIndex] = {
          ...updatedNodeStates[existingIndex],
          nodeId: args.nodeId,
          status: "running",
          startedAt: args.startedAt,
        };
        await ctx.db.patch(execution._id, { nodeStates: updatedNodeStates });
      } else {
        // Add new running entry
        const nodeState = {
          nodeId: args.nodeId,
          status: "running",
          startedAt: args.startedAt,
        };
        await ctx.db.patch(execution._id, {
          nodeStates: [...execution.nodeStates, nodeState],
        });
      }
    } else {
      // For completed/failed, update existing running entry or add new
      const existingIndex = execution.nodeStates.findIndex(
        (s: any) => s.nodeId === args.nodeId && s.status === "running",
      );

      if (existingIndex >= 0) {
        // Update the running entry with final status
        const existingEntry = execution.nodeStates[existingIndex];
        // biome-ignore lint/style/noNonNullAssertion: index was just checked
        const startedAt = existingEntry!.startedAt;

        const nodeState = {
          ...existingEntry,
          nodeId: args.nodeId,
          ...(args.iteration !== undefined && { iteration: args.iteration }),
          status: args.status,
          output: args.output,
          error: args.error,
          completedAt: args.completedAt,
          // Calculate duration based on node's start time
          duration:
            args.completedAt && startedAt
              ? args.completedAt - startedAt
              : undefined,
        };

        const updatedNodeStates = [...execution.nodeStates];
        updatedNodeStates[existingIndex] = nodeState;
        await ctx.db.patch(execution._id, { nodeStates: updatedNodeStates });
      } else {
        // Append new entry (case where we missed the running event or it's instantaneous)
        const nodeState = {
          nodeId: args.nodeId,
          ...(args.iteration !== undefined && { iteration: args.iteration }),
          status: args.status,
          output: args.output,
          error: args.error,
          startedAt: args.startedAt,
          completedAt: args.completedAt,
          duration:
            args.completedAt && args.startedAt
              ? args.completedAt - args.startedAt
              : undefined,
        };

        await ctx.db.patch(execution._id, {
          nodeStates: [...execution.nodeStates, nodeState],
        });
      }
    }

    return execution._id;
  },
});

/**
 * Get execution by workflow ID
 */
export const getByWorkflowId = query({
  args: {
    workflowId: v.string(),
  },
  handler: async (ctx, args) => {
    const execution = await ctx.db
      .query("routine_executions")
      .withIndex("by_workflow_id", (q) => q.eq("workflowId", args.workflowId))
      .first();

    return execution;
  },
});

/**
 * Get all executions for a routine
 */
export const getByRoutine = query({
  args: {
    routineId: v.id("routines"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const query = ctx.db
      .query("routine_executions")
      .withIndex("by_routine", (q) => q.eq("routineId", args.routineId))
      .order("desc");

    if (args.limit) {
      return await query.take(args.limit);
    }

    return await query.collect();
  },
});

/**
 * Get recent executions for a user
 */
export const getRecentByUser = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const query = ctx.db
      .query("routine_executions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc");

    if (args.limit) {
      return await query.take(args.limit);
    }

    return await query.collect();
  },
});

/**
 * Get execution with routine details
 */
export const getWithRoutine = query({
  args: {
    executionId: v.id("routine_executions"),
  },
  handler: async (ctx, args) => {
    const execution = await ctx.db.get(args.executionId);
    if (!execution) {
      return null;
    }

    const routine = await ctx.db.get(execution.routineId);

    return {
      ...execution,
      routine,
    };
  },
});
