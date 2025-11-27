/**
 * Kianax Execution Engine
 *
 * Temporal-agnostic execution engine for running Kianax routines.
 */

// Main executor
export { RoutineExecutor } from "./engine/executor.js";
export type { PluginRegistry } from "./engine/executor.js";

// Expression resolver for variable system
export {
  ExpressionResolver,
  createEmptyContext,
} from "./engine/expression-resolver.js";
export type {
  ExpressionContext,
  VariableReference,
} from "./engine/expression-resolver.js";

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
  RoutineVariable,
  ExecutionGraph,
  GraphValidationResult,
  GraphValidationError,
  GraphValidationWarning,
} from "./types/graph.js";

// PortType enum (value export)
export { PortType } from "./types/graph.js";

// Execution state
export { ExecutionState } from "./engine/execution-state.js";

// Validation
export { validateGraph } from "./validation/graph-validator.js";
export { validateConnection } from "./validation/connection-validator.js";
export {
  validateExpressions,
  getExpressionErrors,
  hasValidExpressions,
} from "./validation/expression-validator.js";
export type {
  ExpressionValidationError,
  ExpressionValidationWarning,
  ExpressionValidationResult,
} from "./validation/expression-validator.js";
