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

/**
 * Base interface for all connections
 */
interface BaseConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
}

/**
 * Flow Connection (Control Flow)
 * Dictates execution order and branching
 */
export interface FlowConnection extends BaseConnection {
  type: "flow";

  /**
   * The output port/handle name on the source node.
   * Represents the Control Signal (e.g., "default", "true", "false", "loop").
   */
  sourceHandle: string;

  /**
   * The input port/handle name on the target node.
   * For flow connections, this is primarily metadata for the UI (e.g., matching ReactFlow's targetHandle).
   * In the current executor logic, flow connections usually trigger the target node's default entry.
   * Future enhancements might use this for nodes with multiple distinct flow entry points.
   */
  targetHandle?: string;

  /**
   * Configuration for loop edges
   */
  loopConfig?: {
    maxIterations: number;
    accumulatorFields?: string[];
  };
}

/**
 * Data Connection (Data Flow)
 * Dictates data transfer between nodes
 */
export interface DataConnection extends BaseConnection {
  type: "data";

  /**
   * The output port/handle name on the source node.
   * Represents the Data Output Name (e.g., "temperature", "result").
   */
  sourceHandle: string;

  /**
   * The input port/handle name on the target node.
   * Represents the Data Input Name (e.g., "city", "input").
   */
  targetHandle: string;
}

/**
 * Connection Type Discriminated Union
 */
export type Connection = FlowConnection | DataConnection;

export type ConnectionType = Connection["type"];

/**
 * Standardized Plugin Execution Result
 */
export interface PluginResult {
  /**
   * Control signal to activate next nodes
   * Defaults to "default" if omitted
   */
  signal?: string;

  /**
   * Data outputs mapped to output ports
   */
  data: Record<string, unknown>;
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
