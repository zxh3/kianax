import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Legacy tables (demo)
  messages: defineTable({
    user: v.string(),
    body: v.string(),
  }),

  // Routine tables (user-created automation routines)
  routines: defineTable({
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived"),
    ),
    // Trigger configuration (routine-level, not a node in the DAG)
    triggerType: v.union(
      v.literal("manual"),
      v.literal("cron"),
      v.literal("webhook"),
      v.literal("event"),
    ),
    triggerConfig: v.optional(v.any()), // Type depends on triggerType
    // Routine definition (DAG structure)
    nodes: v.array(
      v.object({
        id: v.string(),
        pluginId: v.string(),
        label: v.string(),
        position: v.object({ x: v.number(), y: v.number() }),
        config: v.optional(v.any()), // Plugin behavior settings (timeout, format, etc.)
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
    version: v.number(),
    lastExecutedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_user_and_status", ["userId", "status"])
    .index("by_trigger_type", ["triggerType", "status"]),

  // Routine execution history
  routine_executions: defineTable({
    routineId: v.id("routines"),
    userId: v.string(),

    // Temporal workflow identifiers
    workflowId: v.string(),
    runId: v.string(),

    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
      v.literal("timeout"),
    ),
    // Trigger information
    triggerType: v.union(
      v.literal("manual"),
      v.literal("scheduled"),
      v.literal("webhook"),
      v.literal("event"),
    ),
    triggerData: v.optional(v.any()),

    // Execution path (ordered list of executed node IDs for conditional branching)
    executionPath: v.optional(v.array(v.string())),

    // Node execution states
    nodeStates: v.array(
      v.object({
        nodeId: v.string(),
        status: v.string(),
        input: v.optional(v.any()),
        output: v.optional(v.any()),
        error: v.optional(
          v.object({
            message: v.string(),
            stack: v.optional(v.string()),
          }),
        ),
        startedAt: v.optional(v.number()),
        completedAt: v.optional(v.number()),
        duration: v.optional(v.number()),
      }),
    ),

    // Error information (workflow-level)
    error: v.optional(
      v.object({
        message: v.string(),
        stack: v.optional(v.string()),
      }),
    ),

    // Metrics
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    duration: v.optional(v.number()),
  })
    .index("by_routine", ["routineId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_workflow_id", ["workflowId"]),

  // Plugin credentials (encrypted)
  plugin_credentials: defineTable({
    userId: v.string(),
    pluginId: v.string(),
    // Credentials stored as encrypted JSON
    credentials: v.string(), // Will be encrypted
  })
    .index("by_user", ["userId"])
    .index("by_user_and_plugin", ["userId", "pluginId"]),

  // User settings/preferences
  user_settings: defineTable({
    userId: v.string(),
    theme: v.optional(
      v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
    ),
  }).index("by_user", ["userId"]),
});
