/**
 * Routine Type Definitions
 *
 * Defines the structure for user-created automation routines (formerly "workflows").
 * Routines are directed acyclic graphs (DAGs) of plugin nodes.
 *
 * Note: "Routine" is the product concept. "Workflow" refers to Temporal's execution engine.
 */

import type { PluginType } from "./plugin";

/**
 * Position coordinates for visual routine editor
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Routine node representing a plugin instance in the routine
 */
export interface RoutineNode {
  /** Unique node ID within the routine */
  id: string;

  /** Plugin ID this node uses */
  pluginId: string;

  /** Plugin type */
  type: PluginType;

  /** Display label for this node */
  label: string;

  /** Node position in the visual editor */
  position: Position;

  /** Plugin-specific configuration */
  config?: Record<string, unknown>;

  /** Whether this node is enabled */
  enabled: boolean;
}

/**
 * Connection between two routine nodes
 */
export interface RoutineConnection {
  /** Unique connection ID */
  id: string;

  /** Source node ID */
  sourceNodeId: string;

  /** Target node ID */
  targetNodeId: string;

  /** Source output field (optional, for plugins with multiple outputs) */
  sourceHandle?: string;

  /** Target input field (optional, for plugins with multiple inputs) */
  targetHandle?: string;

  /** AI transformation instruction (if types don't match) */
  transform?: {
    instruction: string;
    enabled: boolean;
  };
}

/**
 * Routine status
 */
export type RoutineStatus = "draft" | "active" | "paused" | "archived";

/**
 * Complete routine definition
 */
export interface Routine {
  /** Unique routine ID */
  id: string;

  /** User who owns this routine */
  userId: string;

  /** Routine name */
  name: string;

  /** Routine description */
  description?: string;

  /** Routine status */
  status: RoutineStatus;

  /** Routine nodes */
  nodes: RoutineNode[];

  /** Connections between nodes */
  connections: RoutineConnection[];

  /** Routine-level configuration */
  config?: {
    /** Maximum execution time (ms) */
    timeout?: number;

    /** Retry configuration */
    retries?: {
      maxAttempts: number;
      backoff: "linear" | "exponential";
    };

    /** Rate limiting */
    rateLimit?: {
      maxExecutionsPerHour: number;
    };
  };

  /** Routine tags */
  tags?: string[];

  /** Routine version (for versioning support) */
  version: number;

  /** Timestamps */
  createdAt: number;
  updatedAt: number;

  /** Last execution timestamp */
  lastExecutedAt?: number;
}

/**
 * Routine creation input (before ID and timestamps are assigned)
 */
export type RoutineCreateInput = Omit<
  Routine,
  "id" | "createdAt" | "updatedAt" | "version"
>;

/**
 * Routine update input (partial update)
 */
export type RoutineUpdateInput = Partial<
  Omit<Routine, "id" | "userId" | "createdAt">
>;

/**
 * Routine template for sharing/marketplace
 */
export interface RoutineTemplate {
  /** Template ID */
  id: string;

  /** Template name */
  name: string;

  /** Template description */
  description: string;

  /** Template author */
  author: {
    name: string;
    userId?: string;
  };

  /** Template category */
  category: string;

  /** Template tags */
  tags: string[];

  /** Routine structure (without credentials) */
  routine: Omit<Routine, "id" | "userId" | "createdAt" | "updatedAt">;

  /** Required plugins */
  requiredPlugins: string[];

  /** Template popularity */
  usageCount: number;

  /** Template rating */
  rating: number;

  /** Timestamps */
  createdAt: number;
  updatedAt: number;
}

/**
 * Routine validation error
 */
export interface RoutineValidationError {
  type: "missing_plugin" | "invalid_connection" | "missing_credentials" | "cycle_detected" | "invalid_config";
  message: string;
  nodeId?: string;
  connectionId?: string;
}

/**
 * Routine validation result
 */
export interface RoutineValidationResult {
  valid: boolean;
  errors: RoutineValidationError[];
  warnings: RoutineValidationError[];
}
