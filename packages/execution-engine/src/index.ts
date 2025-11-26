/**
 * Kianax Execution Engine
 *
 * Temporal-agnostic execution engine for running Kianax routines.
 */

// Main executor
export { RoutineExecutor } from "./engine/executor.js";
export type { PluginRegistry } from "./engine/executor.js";

// Iteration strategies
export {
  BFSIterationStrategy,
  DFSIterationStrategy,
  getDefaultIterationStrategy,
  type IterationStrategy,
  type IterationOptions,
  type NodeExecutor,
} from "./engine/iteration-strategy.js";

// Types
export type {
  ExecutionItem,
  PortData,
  NodeExecutionResult,
  ExecutionResult,
  ExecutionError,
  ExecutionCallbacks,
  ExecutorOptions,
  ExecutionContext,
  ExecutionHelpers,
  HttpRequestOptions,
  NodeContext,
  RoutineContext,
  ExecutionMetadata,
  LoopState,
} from "./types/execution.js";

export type {
  Node,
  Edge,
  RoutineDefinition,
  ExecutionGraph,
  GraphValidationResult,
  GraphValidationError,
  GraphValidationWarning,
  PortType,
} from "./types/graph.js";

// Execution state
export { ExecutionState } from "./engine/execution-state.js";

// Validation
export { validateGraph } from "./validation/graph-validator.js";
export { validateConnection } from "./validation/connection-validator.js";
