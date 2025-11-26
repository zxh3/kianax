/**
 * Temporal Types
 * Shared type definitions for Temporal workflows and activities
 */

/**
 * Plugin execution context
 */
export interface PluginContext {
  userId: string;
  routineId: string;
  executionId: string;
  credentials?: Record<string, string>;
  triggerData?: unknown;
}

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
}

export interface Connection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string; // Output port on source node (e.g., "true", "false", "success", "error")
  targetHandle?: string; // Input port on target node
}

export interface ExecutePluginInput {
  pluginId: string;
  config: Record<string, unknown>;
  inputs: Record<string, unknown>;
  context: PluginContext & {
    nodeId: string; // Workflow-specific node tracking
  };
  nodeState?: Record<string, unknown>; // Persistent state for stateful nodes (e.g., loops)
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
  status: "running" | "completed" | "failed";
  output?: unknown;
  error?: {
    message: string;
    stack?: string;
  };
  startedAt?: number;
  completedAt?: number;
}
