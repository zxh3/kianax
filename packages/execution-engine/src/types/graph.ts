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
 * Note: Edges are simple port-to-port connections with no conditional logic.
 * Routing/branching logic is handled by nodes themselves, which output data
 * to specific ports based on their evaluation (e.g., IF nodes output to "true"
 * or "false" ports). The execution engine simply follows where data flows.
 */
export interface Edge {
  /** Unique edge identifier */
  id: string;
  /** Source node ID */
  sourceNodeId: string;
  /** Source port name */
  sourcePort: string;
  /** Target node ID */
  targetNodeId: string;
  /** Target port name */
  targetPort: string;
  /** Connection type */
  type: PortType;
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
