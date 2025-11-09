/**
 * Workflow Type Definitions
 *
 * Defines the structure for workflows, nodes, and connections.
 * Workflows are directed acyclic graphs (DAGs) of plugin nodes.
 */

import type { PluginType } from "./plugin";

/**
 * Position coordinates for visual workflow editor
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Workflow node representing a plugin instance in the workflow
 */
export interface WorkflowNode {
  /** Unique node ID within the workflow */
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
 * Connection between two workflow nodes
 */
export interface WorkflowConnection {
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
 * Workflow status
 */
export type WorkflowStatus = "draft" | "active" | "paused" | "archived";

/**
 * Complete workflow definition
 */
export interface Workflow {
  /** Unique workflow ID */
  id: string;

  /** User who owns this workflow */
  userId: string;

  /** Workflow name */
  name: string;

  /** Workflow description */
  description?: string;

  /** Workflow status */
  status: WorkflowStatus;

  /** Workflow nodes */
  nodes: WorkflowNode[];

  /** Connections between nodes */
  connections: WorkflowConnection[];

  /** Workflow-level configuration */
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

  /** Workflow tags */
  tags?: string[];

  /** Workflow version (for versioning support) */
  version: number;

  /** Timestamps */
  createdAt: number;
  updatedAt: number;

  /** Last execution timestamp */
  lastExecutedAt?: number;
}

/**
 * Workflow creation input (before ID and timestamps are assigned)
 */
export type WorkflowCreateInput = Omit<
  Workflow,
  "id" | "createdAt" | "updatedAt" | "version"
>;

/**
 * Workflow update input (partial update)
 */
export type WorkflowUpdateInput = Partial<
  Omit<Workflow, "id" | "userId" | "createdAt">
>;

/**
 * Workflow template for sharing/marketplace
 */
export interface WorkflowTemplate {
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

  /** Workflow structure (without credentials) */
  workflow: Omit<Workflow, "id" | "userId" | "createdAt" | "updatedAt">;

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
 * Workflow validation error
 */
export interface WorkflowValidationError {
  type: "missing_plugin" | "invalid_connection" | "missing_credentials" | "cycle_detected" | "invalid_config";
  message: string;
  nodeId?: string;
  connectionId?: string;
}

/**
 * Workflow validation result
 */
export interface WorkflowValidationResult {
  valid: boolean;
  errors: WorkflowValidationError[];
  warnings: WorkflowValidationError[];
}
