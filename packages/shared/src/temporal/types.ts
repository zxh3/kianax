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
    type: "branch" | "default" | "loop";
    value?: string; // Branch value: "true", "false", etc.
    loopConfig?: {
      maxIterations: number;
      accumulatorFields?: string[];
    };
  };
}

/**
 * Loop state tracking for iterative execution
 */
export interface LoopState {
  iteration: number;
  maxIterations: number;
  accumulator: Record<string, unknown>;
  startedAt: number;
}

/**
 * Plugin execution context for Temporal workflows
 * Extends base PluginContext with nodeId for workflow-specific tracking
 */
export interface TemporalPluginContext extends BasePluginContext {
  nodeId: string;
  loopIteration?: number; // Current iteration if in a loop
  loopAccumulator?: Record<string, unknown>; // Accumulated data from previous iterations
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
  iteration?: number; // Iteration number for nodes in loops (0-based)
  status: "completed" | "failed";
  output?: unknown;
  error?: {
    message: string;
    stack?: string;
  };
  completedAt: number;
}
