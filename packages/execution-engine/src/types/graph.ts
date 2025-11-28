/**
 * Graph types for routine structure
 *
 * These types define the structure of a routine as a directed graph.
 */

/**
 * Port type enumeration
 *
 * Currently only Main is supported. Future port types (Config, Error, etc.)
 * can be added when needed and will be used for UI/validation, not execution logic.
 */
export enum PortType {
  /** Standard data flow between nodes */
  Main = "main",
}

/**
 * A node in the routine graph
 */
export interface Node {
  /** Unique node identifier */
  id: string;
  /** Plugin type identifier */
  pluginId: string;
  /** Display label */
  label: string;
  /** Node configuration parameters */
  parameters: Record<string, unknown>;
  /** Visual position (for UI) */
  position?: { x: number; y: number };
  /**
   * Mapping of Credential Request Alias (or ID) -> User Credential ID
   */
  credentialMappings?: Record<string, string>;
}

/**
 * An edge connecting two nodes
 *
 * Flow-based connection model:
 * - Normal connections: No handle specified, activates when source node outputs ANY data
 * - Control flow connections: sourceHandle specifies which output path activates the edge
 *   (e.g., "true"/"false" for if-else, "success"/"error" for try-catch)
 *
 * The execution engine:
 * 1. For edges with sourceHandle: only follows if that handle was activated
 * 2. For edges without sourceHandle: follows if source node produced any output
 */
export interface Edge {
  /** Unique edge identifier */
  id: string;
  /** Source node ID */
  sourceNodeId: string;
  /** Target node ID */
  targetNodeId: string;
  /**
   * Source handle for control flow routing.
   * - If specified: edge only activates when this handle is triggered (e.g., "true", "false")
   * - If not specified: edge activates on any output from source node
   */
  sourceHandle?: string;
  /**
   * Target handle (for UI positioning, not execution logic)
   */
  targetHandle?: string;

  // Legacy fields for backwards compatibility with port-based system
  /** @deprecated Use sourceHandle instead */
  sourcePort?: string;
  /** @deprecated Use targetHandle instead */
  targetPort?: string;
  /** @deprecated Connection type - no longer used in flow-based system */
  type?: PortType;
}

/**
 * Routine variable definition
 */
export interface RoutineVariable {
  /** Unique identifier */
  id: string;
  /** Variable name (alphanumeric + underscore) */
  name: string;
  /** Variable type */
  type: "string" | "number" | "boolean" | "json";
  /** The actual value */
  value: unknown;
  /** Optional description */
  description?: string;
}

/**
 * Complete routine definition
 */
export interface RoutineDefinition {
  /** Routine identifier */
  id?: string;
  /** Routine name */
  name: string;
  /** Nodes in the routine */
  nodes: Node[];
  /** Edges connecting nodes */
  connections: Edge[];
  /** Trigger data (for manual/test executions) */
  triggerData?: unknown;
  /** Routine-level variables */
  variables?: RoutineVariable[];
}

/**
 * Execution graph (optimized for traversal)
 */
export interface ExecutionGraph {
  /** Routine metadata */
  routineId: string;
  triggerData?: unknown;
  /** Routine-level variables as a map for easy lookup */
  variables: Record<string, unknown>;

  /** Nodes indexed by ID for O(1) lookup */
  nodes: Map<string, Node>;
  /** Edges indexed by source for O(1) lookup */
  edges: Edge[];
  /** Edges grouped by target for O(1) lookup */
  edgesByTarget: Map<string, Edge[]>;
  /** Edges grouped by source for O(1) lookup */
  edgesBySource: Map<string, Edge[]>;
}

/**
 * Graph validation result
 */
export interface GraphValidationResult {
  valid: boolean;
  errors: GraphValidationError[];
  warnings: GraphValidationWarning[];
}

/**
 * Graph validation error
 */
export interface GraphValidationError {
  type:
    | "no_entry_nodes"
    | "orphaned_node"
    | "cycle_detected"
    | "invalid_connection"
    | "missing_node";
  nodeId?: string;
  edgeId?: string;
  message: string;
}

/**
 * Graph validation warning
 */
export interface GraphValidationWarning {
  type: "unreachable_node" | "dead_end" | "multiple_entry_points";
  nodeId?: string;
  message: string;
}
