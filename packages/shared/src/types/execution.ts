/**
 * Execution Type Definitions
 *
 * Defines types for routine execution state, history, and monitoring.
 */

/**
 * Execution status
 */
export type ExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "timeout";

/**
 * Node execution state
 */
export interface NodeExecutionState {
  /** Node ID */
  nodeId: string;

  /** Execution status */
  status: ExecutionStatus;

  /** Input data */
  input?: unknown;

  /** Output data */
  output?: unknown;

  /** Error information */
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };

  /** Execution metrics */
  metrics: {
    startedAt?: number;
    completedAt?: number;
    duration?: number; // milliseconds
    retries: number;
  };
}

/**
 * Routine execution record
 */
export interface RoutineExecution {
  /** Unique execution ID */
  id: string;

  /** Routine ID */
  routineId: string;

  /** User ID */
  userId: string;

  /** Overall execution status */
  status: ExecutionStatus;

  /** Trigger information */
  trigger: {
    type: "manual" | "scheduled" | "webhook" | "event";
    timestamp: number;
    data?: unknown;
  };

  /** Node execution states */
  nodeStates: NodeExecutionState[];

  /** Execution metrics */
  metrics: {
    startedAt: number;
    completedAt?: number;
    duration?: number; // milliseconds
    nodesExecuted: number;
    nodesFailed: number;
  };

  /** Error information (if execution failed) */
  error?: {
    message: string;
    nodeId?: string;
    stack?: string;
  };

  /** Execution logs (for debugging) */
  logs?: ExecutionLog[];
}

/**
 * Execution log entry
 */
export interface ExecutionLog {
  timestamp: number;
  level: "debug" | "info" | "warn" | "error";
  nodeId?: string;
  message: string;
  data?: unknown;
}

/**
 * Execution statistics for a routine
 */
export interface ExecutionStatistics {
  routineId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number; // milliseconds
  lastExecution?: {
    id: string;
    status: ExecutionStatus;
    timestamp: number;
  };
  executionsByStatus: Record<ExecutionStatus, number>;
  executionsByDay: Array<{
    date: string; // YYYY-MM-DD
    count: number;
  }>;
}

/**
 * Real-time execution event
 */
export interface ExecutionEvent {
  executionId: string;
  routineId: string;
  type: "started" | "node_started" | "node_completed" | "node_failed" | "completed" | "failed";
  timestamp: number;
  nodeId?: string;
  data?: unknown;
}
