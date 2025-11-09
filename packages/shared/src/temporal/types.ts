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
  triggerData?: any;
}

export interface Node {
  id: string;
  pluginId: string;
  type: 'input' | 'processor' | 'logic' | 'output';
  config: any;
  enabled: boolean;
}

export interface Connection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
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
  config: any;
  inputs: any;
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
  output?: any;
  error?: {
    message: string;
    stack?: string;
  };
  completedAt: number;
}
