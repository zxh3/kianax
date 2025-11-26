/**
 * Dynamic DAG Executor for Routines
 *
 * Executes user-defined routine graphs with support for:
 * - Conditional branching (if-else, switch)
 * - Parallel execution (independent nodes)
 * - Data flow (output → input mapping)
 * - Deterministic replay (for Temporal)
 * - Nested loops and complex control flow
 */

import type {
  RoutineInput,
  Node,
  Connection,
  FlowConnection,
  DataConnection,
  LoopState,
  PluginResult,
} from "@kianax/shared/temporal";

/**
 * Constants for loop validation
 */
export const MIN_LOOP_ITERATIONS = 1;
export const MAX_LOOP_ITERATIONS = 1000;

/**
 * Execution Context for a specific node run
 * Tracks the loop stack to support nested loops
 */
export interface ExecutionContext {
  loopStack: Array<{
    edgeId: string;
    iteration: number;
    accumulator: Record<string, unknown>;
  }>;
}

/**
 * Task ready for execution
 */
export interface ExecutionTask {
  nodeId: string;
  context: ExecutionContext;
}

/**
 * Execution state tracking
 */
export class ExecutionState {
  // Map of nodeId -> output value.
  nodeOutputs = new Map<string, unknown>();

  // Set of executed nodes with context hash
  executed = new Set<string>();

  executionPath: string[] = [];

  // Global state of loops (iteration counts)
  loopStates = new Map<string, LoopState>();

  // Internal queue of ready tasks
  queue: ExecutionTask[] = [];

  // Track running nodes to detect completion/deadlock
  running = new Set<string>();
}

/**
 * Execution graph structure
 */
export interface ExecutionGraph {
  nodes: Map<string, Node>;
  edges: Connection[];
  routineId: string;
  userId: string;
  triggerData?: unknown;
}

/**
 * Graph Iterator
 *
 * Encapsulates the traversal logic.
 * - Maintains state
 * - Decides what runs next
 * - Handles loops and branches
 */
export class GraphIterator {
  private graph: ExecutionGraph;
  private state: ExecutionState;

  constructor(graph: ExecutionGraph, initialState?: ExecutionState) {
    this.graph = graph;
    this.state = initialState || new ExecutionState();

    // If fresh state, find entry nodes
    if (
      this.state.queue.length === 0 &&
      this.state.executed.size === 0 &&
      this.state.running.size === 0
    ) {
      const entryNodes = findEntryNodes(this.graph.nodes, this.graph.edges);
      for (const nodeId of entryNodes) {
        this.state.queue.push({
          nodeId,
          context: { loopStack: [] },
        });
      }
    }
  }

  public getState(): ExecutionState {
    return this.state;
  }

  /**
   * Get a batch of nodes ready to execute immediately
   */
  public nextBatch(): ExecutionTask[] {
    const readyTasks: ExecutionTask[] = [];
    const remainingQueue: ExecutionTask[] = [];

    // Process queue to find ready tasks
    for (const task of this.state.queue) {
      if (this.isReady(task)) {
        readyTasks.push(task);
        this.state.running.add(this.getContextKey(task.nodeId, task.context));
      } else {
        remainingQueue.push(task);
      }
    }

    // Update queue to only keep waiting tasks
    this.state.queue = remainingQueue;
    return readyTasks;
  }

  /**
   * Mark a node as successfully completed
   */
  public markNodeCompleted(task: ExecutionTask, output: unknown) {
    const key = this.getContextKey(task.nodeId, task.context);
    this.state.running.delete(key);
    this.state.executed.add(key);
    this.state.nodeOutputs.set(key, output);
    this.state.executionPath.push(task.nodeId);

    // Determine next nodes
    const { nextNodes, loopEdges } = determineNextNodes(
      task.nodeId,
      output,
      this.graph.nodes,
      this.graph.edges,
    );

    // 1. Handle regular downstream nodes
    for (const nextId of nextNodes) {
      // Check if we should queue this node
      // Note: We add to queue, nextBatch() will check dependencies
      // Pass the SAME context down
      this.addToQueue(nextId, task.context);
    }

    // 2. Handle loop edges (Backwards or recursive flow)
    for (const loopEdge of loopEdges) {
      // Ensure it's a flow connection with loop config
      if (loopEdge.type !== "flow" || !loopEdge.loopConfig) continue;

      const shouldContinue = this.updateLoopState(
        loopEdge,
        output,
        task.context,
      );

      if (shouldContinue) {
        // Create NEW context for the next iteration
        const newContext = this.createNewLoopContext(loopEdge, task.context);

        // Re-queue the target node with NEW context
        this.addToQueue(loopEdge.targetNodeId, newContext);
      }
    }
  }

  /**
   * Mark a node as failed
   */
  public markNodeFailed(task: ExecutionTask, _error: any) {
    const key = this.getContextKey(task.nodeId, task.context);
    this.state.running.delete(key);
    // Logic to handle failure (retry, ignore, stop) is handled by workflow
  }

  /**
   * Check if execution is completely finished
   */
  public isDone(): boolean {
    return this.state.queue.length === 0 && this.state.running.size === 0;
  }

  public hasRunningNodes(): boolean {
    return this.state.running.size > 0;
  }

  /**
   * Helper: Check if a task is ready (all dependencies met)
   */
  private isReady(task: ExecutionTask): boolean {
    // Find incoming FLOW edges to this node (dependencies)
    const incomingFlowEdges = this.graph.edges.filter(
      (e): e is FlowConnection =>
        e.targetNodeId === task.nodeId && e.type === "flow",
    );

    // Check if source of each edge has executed IN THIS CONTEXT
    for (const edge of incomingFlowEdges) {
      // Skip loop back-edges for readiness (they are handled by loop logic)
      if (edge.loopConfig) continue;

      const sourceKey = this.getContextKey(edge.sourceNodeId, task.context);
      if (!this.state.executed.has(sourceKey)) {
        // DEBUG: console.log(`Node ${task.nodeId} waiting for ${sourceKey}. Executed: ${Array.from(this.state.executed)}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Helper: Add to queue if not already present or executed
   */
  private addToQueue(nodeId: string, context: ExecutionContext) {
    const key = this.getContextKey(nodeId, context);

    // If already executed in this context, don't re-run (unless explicitly reset)
    if (this.state.executed.has(key)) return;

    // If already in queue, don't add duplicate
    if (
      this.state.queue.some(
        (t) => this.getContextKey(t.nodeId, t.context) === key,
      )
    )
      return;

    // If currently running, don't add
    if (this.state.running.has(key)) return;

    this.state.queue.push({ nodeId, context });
  }

  /**
   * Generate unique key for node+context
   */
  private getContextKey(nodeId: string, context: ExecutionContext): string {
    if (context.loopStack.length === 0) return nodeId;
    const contextHash = context.loopStack
      .map((l) => `${l.edgeId}:${l.iteration}`)
      .join("|");
    return `${nodeId}|${contextHash}`;
  }

  /**
   * Update global loop state
   */
  private updateLoopState(
    edge: FlowConnection,
    _output: unknown,
    currentContext: ExecutionContext,
  ): boolean {
    let loopState = this.state.loopStates.get(edge.id);
    const maxIterations = edge.loopConfig?.maxIterations || MAX_LOOP_ITERATIONS;

    // Initialize if missing (global tracking)
    if (!loopState) {
      loopState = {
        iteration: 0,
        maxIterations,
        accumulator: {},
        startedAt: Date.now(),
      };
      this.state.loopStates.set(edge.id, loopState);
    }

    // Find if we are already in this loop (recursive?) or if it's a new entry?
    const currentLoop = currentContext.loopStack.find(
      (l) => l.edgeId === edge.id,
    );
    const currentIteration = currentLoop ? currentLoop.iteration : 0;

    // Check NEXT iteration
    return currentIteration + 1 < maxIterations;
  }

  private createNewLoopContext(
    edge: Connection,
    currentContext: ExecutionContext,
  ): ExecutionContext {
    // Clone stack
    const newStack = [...currentContext.loopStack];

    // Find if this loop is already in stack
    const loopIndex = newStack.findIndex((l) => l.edgeId === edge.id);

    if (loopIndex >= 0) {
      // Existing loop: Increment iteration
      const current = newStack[loopIndex];
      if (current) {
        newStack[loopIndex] = {
          ...current,
          iteration: current.iteration + 1,
          // TODO: Update accumulator from output if needed
        };
      }
    } else {
      // New loop entry
      newStack.push({
        edgeId: edge.id,
        iteration: 1,
        accumulator: {},
      });
    }

    return { loopStack: newStack };
  }

  /**
   * Get input values for a node from the correct context
   */
  public gatherInputs(task: ExecutionTask): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};

    // Only look for DATA connections for inputs
    const incomingDataEdges = this.graph.edges.filter(
      (e): e is DataConnection =>
        e.targetNodeId === task.nodeId && e.type === "data",
    );

    for (const edge of incomingDataEdges) {
      // Source must be in the same context (or compatible parent context)
      const sourceKey = this.getContextKey(edge.sourceNodeId, task.context);
      let sourceOutput = this.state.nodeOutputs.get(sourceKey);

      // If strict, error. But maybe source is outside the current inner loop? (Closure)
      if (sourceOutput === undefined) {
        let found = false;
        const stackCopy = [...task.context.loopStack];
        while (stackCopy.length > 0) {
          stackCopy.pop(); // Look in parent scope
          const parentKey = this.getContextKey(edge.sourceNodeId, {
            loopStack: stackCopy,
          });
          const parentOutput = this.state.nodeOutputs.get(parentKey);
          if (parentOutput !== undefined) {
            sourceOutput = parentOutput;
            found = true;
            break;
          }
        }
        if (!found) {
          // Maybe it's a global constant (root scope)?
          const rootKey = this.getContextKey(edge.sourceNodeId, {
            loopStack: [],
          });
          const rootOutput = this.state.nodeOutputs.get(rootKey);
          if (rootOutput !== undefined) {
            sourceOutput = rootOutput;
          }
          // else: missing input dependency. Should have been caught by isReady check.
        }
      }

      if (sourceOutput !== undefined) {
        this.mapInput(inputs, edge, sourceOutput);
      }
    }
    return inputs;
  }

  private mapInput(
    inputs: Record<string, unknown>,
    edge: DataConnection,
    sourceOutput: unknown,
  ) {
    let value: unknown = sourceOutput;

    // Standardized PluginResult output structure
    const potentialResult = sourceOutput as PluginResult;
    // Check if it's a PluginResult by looking for the 'data' property and that it's an object
    if (
      potentialResult &&
      typeof potentialResult === "object" &&
      "data" in potentialResult &&
      potentialResult.data !== null &&
      typeof potentialResult.data === "object"
    ) {
      sourceOutput = potentialResult.data;
    }

    // Now map specific fields
    const handle = edge.sourceHandle; // Strict usage of sourceHandle for Data connections
    if (handle && typeof sourceOutput === "object" && sourceOutput !== null) {
      const outputRecord = sourceOutput as Record<string, unknown>;
      value = outputRecord[handle];

      if (value === undefined) {
        // It's possible the source handle points to a non-existent field, or
        // the data structure is different than expected. For now, allow undefined.
        // throw new Error(`Source handle "${handle}" not found`);
      }
    }

    // Map to target input field using targetHandle
    if (edge.targetHandle) {
      inputs[edge.targetHandle] = value;
    } else {
      // Should not happen given DataConnection type implies targetHandle
      // But if we allow looser types in future, fallback to merge
      if (
        typeof value === "object" &&
        !Array.isArray(value) &&
        value !== null
      ) {
        const outputRecord = value as Record<string, unknown>;
        for (const [key, val] of Object.entries(outputRecord)) {
          inputs[key] = val;
        }
      } else {
        // Primitive value or array - use source node ID as key
        const key = `from_${edge.sourceNodeId}`;
        inputs[key] = value;
      }
    }
  }
}

export function buildExecutionGraph(routine: RoutineInput): ExecutionGraph {
  const nodesMap = new Map(routine.nodes.map((n) => [n.id, n]));
  return {
    nodes: nodesMap,
    edges: routine.connections,
    routineId: routine.routineId,
    userId: routine.userId,
    triggerData: routine.triggerData,
  };
}

export function findEntryNodes(
  nodes: Map<string, Node>,
  edges: Connection[],
): string[] {
  const hasIncoming = new Set(
    edges
      // Filter for Flow connections that are NOT loop back-edges
      .filter((e): e is FlowConnection => e.type === "flow" && !e.loopConfig)
      .map((e) => e.targetNodeId),
  );
  return Array.from(nodes.keys()).filter((nodeId) => !hasIncoming.has(nodeId));
}

export function determineNextNodes(
  nodeId: string,
  nodeOutput: unknown,
  nodes: Map<string, Node>,
  edges: Connection[],
): { nextNodes: string[]; loopEdges: Connection[] } {
  const node = nodes.get(nodeId);
  if (!node) throw new Error(`Node not found: ${nodeId}`);

  // Filter to only outgoing edges from this node
  const outgoingEdges = edges.filter((e) => e.sourceNodeId === nodeId);

  // Determine the control signal
  let signal = "default";
  const potentialResult = nodeOutput as PluginResult;
  if (
    potentialResult &&
    typeof potentialResult === "object" &&
    "signal" in potentialResult
  ) {
    signal = potentialResult.signal || "default";
  }

  // Filter execution edges matching the signal
  const matchingFlowEdges = outgoingEdges.filter(
    (edge): edge is FlowConnection => {
      // Only consider flow edges for control flow
      if (edge.type !== "flow") return false;

      // If edge has loopConfig, it's a loop edge (handled separately by the executor)
      if (edge.loopConfig) return true;

      // Strict matching: Edge must explicitly specify which source handle it connects to.
      // If the edge has no sourceHandle, it cannot match any signal.
      return edge.sourceHandle === signal;
    },
  );

  const loopEdges = matchingFlowEdges.filter((e) => e.loopConfig);
  const regularEdges = matchingFlowEdges.filter((e) => !e.loopConfig);

  return {
    nextNodes: regularEdges.map((e) => e.targetNodeId),
    loopEdges,
  };
}

export function validateGraph(routine: RoutineInput): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const nodeIds = new Set(routine.nodes.map((n) => n.id));

  for (const conn of routine.connections) {
    if (!nodeIds.has(conn.sourceNodeId)) {
      errors.push(
        `Connection ${conn.id} references unknown source node: ${conn.sourceNodeId}`,
      );
    }
    if (!nodeIds.has(conn.targetNodeId)) {
      errors.push(
        `Connection ${conn.id} references unknown target node: ${conn.targetNodeId}`,
      );
    }
  }

  // Check for cycles using DFS (allow loop edges)
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const outgoing = routine.connections
      .filter((c) => c.sourceNodeId === nodeId)
      .filter((c): c is FlowConnection => c.type === "flow" && !c.loopConfig)
      .map((c) => c.targetNodeId);

    for (const nextNodeId of outgoing) {
      if (!visited.has(nextNodeId)) {
        if (hasCycle(nextNodeId)) return true;
      } else if (recursionStack.has(nextNodeId)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  // Check each connected component for cycles
  for (const node of routine.nodes) {
    if (!visited.has(node.id)) {
      if (hasCycle(node.id)) {
        errors.push("Graph contains a cycle - routines must be acyclic (DAG)");
        break;
      }
    }
  }

  // Validate loop edges have proper configuration
  for (const conn of routine.connections) {
    if (conn.type === "flow" && conn.loopConfig) {
      if (!conn.loopConfig.maxIterations) {
        errors.push(
          `Loop edge ${conn.id} must have loopConfig.maxIterations defined`,
        );
      }
      if (
        conn.loopConfig.maxIterations < MIN_LOOP_ITERATIONS ||
        conn.loopConfig.maxIterations > MAX_LOOP_ITERATIONS
      ) {
        errors.push(
          `Loop edge ${conn.id} maxIterations must be between ${MIN_LOOP_ITERATIONS} and ${MAX_LOOP_ITERATIONS}`,
        );
      }
    }
  }

  // Check for orphan nodes (no incoming or outgoing flow edges)
  const hasFlowConnection = new Set([
    ...routine.connections
      .filter((e): e is FlowConnection => e.type === "flow")
      .map((c) => c.sourceNodeId),
    ...routine.connections
      .filter((e): e is FlowConnection => e.type === "flow")
      .map((c) => c.targetNodeId),
  ]);

  for (const node of routine.nodes) {
    if (!hasFlowConnection.has(node.id) && routine.nodes.length > 1) {
      errors.push(
        `Node ${node.id} (${node.pluginId}) is disconnected (no flow connections)`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
