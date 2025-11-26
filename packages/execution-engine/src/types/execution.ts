/**
 * Execution types for the Kianax execution engine
 *
 * These types define the structure of execution data, results, and state.
 */

/**
 * A single item of data flowing through the routine
 */
export interface ExecutionItem {
  /** The actual data payload */
  data: unknown;

  /** Metadata about this item's lineage */
  metadata: {
    /** Source node that produced this item */
    sourceNode?: string;
    /** Source port name */
    sourcePort?: string;
    /** Index of the source item that produced this */
    sourceItemIndex?: number;
    /** Loop iteration number (if inside a loop) */
    iteration?: number;
  };

  /** Error information if this item represents an error */
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Data for a specific port (can contain multiple items)
 */
export interface PortData {
  /** Name of the port */
  portName: string;
  /** Items flowing through this port */
  items: ExecutionItem[];
}

/**
 * Result of executing a single node
 */
export interface NodeExecutionResult {
  /** Output data organized by port */
  outputs: PortData[];
  /** Execution time in milliseconds */
  executionTime: number;
  /** Execution status */
  status: "success" | "error";
  /** Error information if status is error */
  error?: ExecutionError;
}

/**
 * Detailed error information
 */
export interface ExecutionError {
  message: string;
  stack?: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Overall execution result
 */
export interface ExecutionResult {
  /** Final status */
  status: "completed" | "failed";
  /** Results for each node (keyed by node ID) */
  nodeResults: Map<string, NodeExecutionResult[]>;
  /** Execution path (order of node execution with run indexes) */
  executionPath: Array<{ nodeId: string; runIndex: number }>;
  /** Errors encountered during execution */
  errors: Array<{
    nodeId: string;
    error: ExecutionError;
  }>;
}

/**
 * Loop state for tracking iterations
 */
export interface LoopState {
  /** Current iteration number (0-indexed) */
  iteration: number;
  /** Maximum iterations allowed */
  maxIterations: number;
  /** Accumulated data across iterations */
  accumulator: Record<string, unknown>;
  /** Fields to accumulate */
  accumulatorFields: string[];
}

/**
 * Execution callbacks for lifecycle hooks
 */
export interface ExecutionCallbacks {
  /** Called when a node starts executing */
  onNodeStart?: (nodeId: string) => Promise<void>;
  /** Called when a node completes successfully */
  onNodeComplete?: (
    nodeId: string,
    result: NodeExecutionResult,
  ) => Promise<void>;
  /** Called when a node fails */
  onNodeError?: (nodeId: string, error: Error) => Promise<void>;
}

/**
 * Options for the executor
 */
export interface ExecutorOptions {
  /** Maximum execution time in milliseconds */
  maxExecutionTime?: number;
  /** Maximum number of nodes to execute */
  maxNodes?: number;
  /** Enable detailed logging */
  verbose?: boolean;
}

/**
 * Context provided to plugins during execution
 */
export interface ExecutionContext {
  // Parameters
  getParameter<T = unknown>(name: string): T;
  getParameters(): Record<string, unknown>;

  // Inputs
  getInput(portName: string): ExecutionItem[];
  getAllInputs(): PortData[];

  // Node state (persistent across executions)
  getNodeState<T = Record<string, unknown>>(): T;
  getRunIndex(): number;

  // Credentials (async because might need to decrypt/fetch)
  getCredentials<T = unknown>(type: string): Promise<T>;

  // Utilities
  helpers: ExecutionHelpers;

  // Metadata
  node: NodeContext;
  routine: RoutineContext;
  execution: ExecutionMetadata;
}

/**
 * Helper utilities available during execution
 */
export interface ExecutionHelpers {
  /** Make HTTP requests */
  httpRequest<T = unknown>(options: HttpRequestOptions): Promise<T>;
  /** Evaluate expressions (for future expression system) */
  evaluateExpression?(expr: string, context?: unknown): unknown;
}

/**
 * HTTP request options
 */
export interface HttpRequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  followRedirects?: boolean;
}

/**
 * Node context information
 */
export interface NodeContext {
  id: string;
  pluginId: string;
  label: string;
}

/**
 * Routine context information
 */
export interface RoutineContext {
  id: string;
  name: string;
  userId: string;
}

/**
 * Execution metadata
 */
export interface ExecutionMetadata {
  executionId: string;
  startedAt: number;
  triggerData?: unknown;
}
