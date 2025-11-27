/**
 * Kianax Execution Engine
 *
 * Temporal-agnostic execution engine for running Kianax routines.
 */

// Main executor
export { RoutineExecutor } from "./engine/executor";
export type { PluginRegistry } from "./engine/executor";

// Expression resolver for variable system
export {
  ExpressionResolver,
  createEmptyContext,
} from "./engine/expression-resolver";
export type {
  ExpressionContext,
  VariableReference,
} from "./engine/expression-resolver";

// Iteration strategies
export {
  BFSIterationStrategy,
  DFSIterationStrategy,
  getDefaultIterationStrategy,
  type IterationStrategy,
  type IterationOptions,
  type NodeExecutor,
} from "./engine/iteration-strategy";

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
} from "./types/execution";

export type {
  Node,
  Edge,
  RoutineDefinition,
  RoutineVariable,
  ExecutionGraph,
  GraphValidationResult,
  GraphValidationError,
  GraphValidationWarning,
} from "./types/graph";

// PortType enum (value export)
export { PortType } from "./types/graph";

// Execution state
export { ExecutionState } from "./engine/execution-state";

// Validation
export { validateGraph } from "./validation/graph-validator";
export { validateConnection } from "./validation/connection-validator";
export {
  validateExpressions,
  getExpressionErrors,
  hasValidExpressions,
} from "./validation/expression-validator";
export type {
  ExpressionValidationError,
  ExpressionValidationWarning,
  ExpressionValidationResult,
} from "./validation/expression-validator";
