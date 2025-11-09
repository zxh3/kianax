import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Legacy tables (demo)
  messages: defineTable({
    user: v.string(),
    body: v.string(),
  }),
  users: defineTable({
    name: v.string(),
    tokenIdentifier: v.string(),
  }).index("by_token", ["tokenIdentifier"]),

  // Workflow tables
  workflows: defineTable({
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived")
    ),
    // Workflow definition (DAG structure)
    nodes: v.array(
      v.object({
        id: v.string(),
        pluginId: v.string(),
        type: v.union(
          v.literal("trigger"),
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
      })
    ),
    tags: v.optional(v.array(v.string())),
    version: v.number(),
    lastExecutedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_user_and_status", ["userId", "status"]),

  // Workflow execution history
  workflow_executions: defineTable({
    workflowId: v.id("workflows"),
    userId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
      v.literal("timeout")
    ),
    // Trigger information
    triggerType: v.union(
      v.literal("manual"),
      v.literal("scheduled"),
      v.literal("webhook"),
      v.literal("event")
    ),
    triggerData: v.optional(v.any()),
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
          })
        ),
        startedAt: v.optional(v.number()),
        completedAt: v.optional(v.number()),
        duration: v.optional(v.number()),
      })
    ),
    // Metrics
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    duration: v.optional(v.number()),
  })
    .index("by_workflow", ["workflowId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  // Installed plugins (per user)
  installed_plugins: defineTable({
    userId: v.string(),
    pluginId: v.string(),
    version: v.string(),
    enabled: v.boolean(),
    config: v.optional(v.any()),
    credentialsSet: v.boolean(),
    installedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_plugin", ["pluginId"])
    .index("by_user_and_plugin", ["userId", "pluginId"]),

  // Plugin credentials (encrypted)
  plugin_credentials: defineTable({
    userId: v.string(),
    pluginId: v.string(),
    // Credentials stored as encrypted JSON
    credentials: v.string(), // Will be encrypted
  })
    .index("by_user", ["userId"])
    .index("by_user_and_plugin", ["userId", "pluginId"]),
});
