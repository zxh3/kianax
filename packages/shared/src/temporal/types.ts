/**
 * Temporal Types
 * Shared type definitions for Temporal workflows and activities
 */

import type { PluginContext as BasePluginContext } from '../types/plugin';

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
  type: 'input' | 'processor' | 'logic' | 'output';
  config: Record<string, unknown>;
  enabled: boolean;
}

export interface Connection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;  // Output port on source node
  targetHandle?: string;  // Input port on target node

  // Conditional execution (for logic nodes)
  condition?: {
    type: 'branch' | 'default';
    value?: string;  // Branch value: "true", "false", etc.
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

export interface UpdateRoutineStatusInput {
  routineId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt?: number;
  completedAt?: number;
  error?: {
    message: string;
    stack?: string;
  };
}

export interface StoreNodeResultInput {
  routineId: string;
  nodeId: string;
  status: 'completed' | 'failed';
  output?: unknown;
  error?: {
    message: string;
    stack?: string;
  };
  completedAt: number;
}
