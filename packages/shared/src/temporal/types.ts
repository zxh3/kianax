/**
 * Temporal Types
 * Shared type definitions for Temporal workflows and activities
 */

import type { PluginContext as BasePluginContext } from "../types/plugin";

export interface RoutineInput {
  routineId: string;
  userId: string;
  nodes: Node[];
  connections: Connection[];
  triggerData?: unknown;
}

export interface Node {
  id: string;
  pluginId: string;
  /**
   * Node type (for UI categorization/labeling only)
   * All nodes behave identically regardless of type:
   * - Receive inputs from upstream nodes
   * - Process via plugin
   * - Output data to downstream nodes
   */
  type: "input" | "processor" | "logic" | "output";
  /**
   * Plugin configuration (behavior settings)
   * Examples: timeout, format, retries, model, etc.
   * Note: Use static-data plugin for constant input values
   */
  config: Record<string, unknown>;
  enabled: boolean;
}

export interface Connection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string; // Output port on source node
  targetHandle?: string; // Input port on target node

  // Conditional execution (for logic nodes)
  condition?: {
    type: "branch" | "default";
    value?: string; // Branch value: "true", "false", etc.
  };
}

/**
 * Plugin execution context for Temporal workflows
 * Extends base PluginContext with nodeId for workflow-specific tracking
 */
export interface TemporalPluginContext extends BasePluginContext {
  nodeId: string;
}

export interface ExecutePluginInput {
  pluginId: string;
  config: Record<string, unknown>;
  inputs: Record<string, unknown>;
  context: TemporalPluginContext;
}

export interface CreateRoutineExecutionInput {
  routineId: string;
  userId: string;
  workflowId: string;
  runId: string;
  triggerType: "manual" | "scheduled" | "webhook" | "event";
  triggerData?: unknown;
}

export interface UpdateRoutineStatusInput {
  workflowId: string; // Temporal workflow ID for tracking
  routineId: string;
  status: "running" | "completed" | "failed";
  startedAt?: number;
  completedAt?: number;
  error?: {
    message: string;
    stack?: string;
  };
  executionPath?: string[]; // Track which nodes executed (for conditional branching)
}

export interface StoreNodeResultInput {
  workflowId: string; // Temporal workflow ID for tracking
  routineId: string;
  nodeId: string;
  status: "completed" | "failed";
  output?: unknown;
  error?: {
    message: string;
    stack?: string;
  };
  completedAt: number;
}
