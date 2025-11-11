/**
 * Dynamic DAG Executor for Routines
 *
 * Executes user-defined routine graphs with support for:
 * - Conditional branching (if-else, switch)
 * - Parallel execution (independent nodes)
 * - Data flow (output → input mapping)
 * - Deterministic replay (for Temporal)
 */

import type {
  RoutineInput,
  Node,
  Connection,
  LoopState,
} from "@kianax/shared/temporal";

/**
 * Constants for loop validation
 */
export const MIN_LOOP_ITERATIONS = 1;
export const MAX_LOOP_ITERATIONS = 1000;

/**
 * Execution state tracking
 */
export class ExecutionState {
  nodeOutputs = new Map<string, unknown>();
  executed = new Set<string>();
  executionPath: string[] = [];

  // Loop state tracking
  loopStates = new Map<string, LoopState>(); // Key: loop edge ID
  nodeIterations = new Map<string, number>(); // Key: nodeId, value: current iteration
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
 * Build execution graph from routine definition
 */
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

/**
 * Find entry nodes (nodes with no incoming edges)
 */
export function findEntryNodes(
  nodes: Map<string, Node>,
  edges: Connection[],
): string[] {
  const hasIncoming = new Set(edges.map((e) => e.targetNodeId));

  return Array.from(nodes.keys()).filter((nodeId) => !hasIncoming.has(nodeId));
}

/**
 * Find nodes that are ready to execute
 * (all dependencies satisfied and not yet executed)
 */
export function findReadyNodes(
  candidates: string[],
  edges: Connection[],
  state: ExecutionState,
): string[] {
  return candidates.filter((nodeId) => {
    // Already executed?
    if (state.executed.has(nodeId)) return false;

    // Find all dependencies (incoming edges)
    const dependencies = edges
      .filter((e) => e.targetNodeId === nodeId)
      .map((e) => e.sourceNodeId);

    // All dependencies satisfied?
    return dependencies.every((depId) => state.executed.has(depId));
  });
}

/**
 * Plugin output structure for logic nodes
 */
export interface LogicNodeOutput {
  branch: string;
  result: boolean;
  [key: string]: unknown;
}

/**
 * Determine next nodes based on current node's output
 *
 * For logic nodes: Filter edges by branch condition
 * For loop control nodes: Handle continue/break branches
 * For other nodes: Follow all outgoing edges
 *
 * Returns object with next nodes and any loop edges to follow
 */
export function determineNextNodes(
  nodeId: string,
  nodeOutput: unknown,
  nodes: Map<string, Node>,
  edges: Connection[],
): { nextNodes: string[]; loopEdges: Connection[] } {
  const node = nodes.get(nodeId);

  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  const outgoingEdges = edges.filter((e) => e.sourceNodeId === nodeId);

  // For nodes with conditional outputs (e.g., if-else), filter edges by branch condition
  // Type guard to check if nodeOutput is a LogicNodeOutput
  if (
    nodeOutput &&
    typeof nodeOutput === "object" &&
    "branch" in nodeOutput &&
    typeof (nodeOutput as LogicNodeOutput).branch === "string"
  ) {
    // This is a conditional node, filter edges by branch
    const branch = (nodeOutput as LogicNodeOutput).branch;

    const matchingEdges = outgoingEdges.filter((edge) => {
      // No condition = default edge (always follow)
      if (!edge.condition) return true;

      // Loop edges are always included (handled separately)
      if (edge.condition.type === "loop") return true;

      // Match branch condition
      if (edge.condition.type === "branch") {
        return edge.condition.value === branch;
      }

      // Default edge
      return edge.condition.type === "default";
    });

    // Separate loop edges from regular edges
    const loopEdges = matchingEdges.filter((e) => e.condition?.type === "loop");
    const regularEdges = matchingEdges.filter(
      (e) => e.condition?.type !== "loop",
    );

    // Validate that conditional nodes have at least one path forward
    if (regularEdges.length === 0 && loopEdges.length === 0) {
      const hasBranchEdges = outgoingEdges.some(
        (e) => e.condition?.type === "branch",
      );

      if (hasBranchEdges) {
        const availableBranches = outgoingEdges
          .filter((e) => e.condition?.type === "branch")
          .map((e) => e.condition?.value || "undefined")
          .join(", ");

        throw new Error(
          `Node ${nodeId} output branch "${branch}" but no matching edge found. ` +
            `Available branches: ${availableBranches}`,
        );
      }
    }

    return {
      nextNodes: regularEdges.map((e) => e.targetNodeId),
      loopEdges,
    };
  }

  // For non-conditional nodes, separate loop edges from regular edges
  const loopEdges = outgoingEdges.filter((e) => e.condition?.type === "loop");
  const regularEdges = outgoingEdges.filter(
    (e) => e.condition?.type !== "loop",
  );

  return {
    nextNodes: regularEdges.map((e) => e.targetNodeId),
    loopEdges,
  };
}

/**
 * Gather inputs for a node from upstream outputs
 *
 * Uses sourceHandle and targetHandle for precise data routing
 */
export function gatherNodeInputs(
  nodeId: string,
  edges: Connection[],
  state: ExecutionState,
): Record<string, unknown> {
  const incomingEdges = edges.filter((e) => e.targetNodeId === nodeId);

  // No incoming edges = no inputs (e.g., input nodes)
  if (incomingEdges.length === 0) {
    return {};
  }

  // Build input object by mapping outputs → inputs
  const inputs: Record<string, unknown> = {};

  for (const edge of incomingEdges) {
    const sourceOutput = state.nodeOutputs.get(edge.sourceNodeId);

    if (sourceOutput === undefined) {
      throw new Error(
        `Missing output from node ${edge.sourceNodeId} (required by ${nodeId})`,
      );
    }

    // Extract specific field from source using sourceHandle
    let value: unknown = sourceOutput;
    if (
      edge.sourceHandle &&
      typeof sourceOutput === "object" &&
      sourceOutput !== null
    ) {
      const outputRecord = sourceOutput as Record<string, unknown>;
      value = outputRecord[edge.sourceHandle];

      if (value === undefined) {
        throw new Error(
          `Source handle "${edge.sourceHandle}" not found in output of node ${edge.sourceNodeId}`,
        );
      }
    }

    // Map to target input field using targetHandle
    if (edge.targetHandle) {
      if (edge.targetHandle in inputs) {
        throw new Error(
          `Input key conflict: "${edge.targetHandle}" from node ${edge.sourceNodeId} ` +
            `would overwrite existing input to node ${nodeId}`,
        );
      }
      inputs[edge.targetHandle] = value;
    } else {
      // No target handle - merge entire value
      if (typeof value === "object" && !Array.isArray(value)) {
        const outputRecord = value as Record<string, unknown>;
        for (const [key, val] of Object.entries(outputRecord)) {
          if (key in inputs) {
            throw new Error(
              `Input key conflict: "${key}" from node ${edge.sourceNodeId} ` +
                `would overwrite existing input to node ${nodeId}. ` +
                `Use targetHandle to specify unique input names.`,
            );
          }
          inputs[key] = val;
        }
      } else {
        // Primitive value or array - use source node ID as key
        const key = `from_${edge.sourceNodeId}`;
        inputs[key] = value;
      }
    }
  }

  return inputs;
}

/**
 * Validate routine graph
 *
 * Checks for:
 * - Cycles (must be DAG)
 * - Orphan nodes (disconnected)
 * - Invalid node references
 */
export function validateGraph(routine: RoutineInput): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const nodeIds = new Set(routine.nodes.map((n) => n.id));

  // Check for invalid node references in connections
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

  // Check for cycles using DFS (allow loop edges which are marked with condition.type === "loop")
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const outgoing = routine.connections
      .filter((c) => c.sourceNodeId === nodeId)
      // Exclude loop edges from cycle detection
      .filter((c) => c.condition?.type !== "loop")
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
    if (conn.condition?.type === "loop") {
      if (!conn.condition.loopConfig?.maxIterations) {
        errors.push(
          `Loop edge ${conn.id} must have loopConfig.maxIterations defined`,
        );
      }
      if (
        conn.condition.loopConfig &&
        (conn.condition.loopConfig.maxIterations < MIN_LOOP_ITERATIONS ||
          conn.condition.loopConfig.maxIterations > MAX_LOOP_ITERATIONS)
      ) {
        errors.push(
          `Loop edge ${conn.id} maxIterations must be between ${MIN_LOOP_ITERATIONS} and ${MAX_LOOP_ITERATIONS}`,
        );
      }
    }
  }

  // Check for orphan nodes (no incoming or outgoing edges)
  const hasConnection = new Set([
    ...routine.connections.map((c) => c.sourceNodeId),
    ...routine.connections.map((c) => c.targetNodeId),
  ]);

  for (const node of routine.nodes) {
    if (!hasConnection.has(node.id) && routine.nodes.length > 1) {
      errors.push(`Node ${node.id} (${node.pluginId}) is disconnected`);
    }
  }

  // Note: Additional validation for conditional branching could be added here
  // by checking if nodes with conditional connections have appropriate branch outputs

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Initialize or update loop state for a loop edge
 */
export function updateLoopState(
  edgeId: string,
  targetNodeId: string,
  maxIterations: number,
  accumulatorFields: string[] | undefined,
  nodeOutput: unknown,
  state: ExecutionState,
): boolean {
  let loopState = state.loopStates.get(edgeId);

  if (!loopState) {
    // Initialize new loop
    loopState = {
      iteration: 0,
      maxIterations,
      accumulator: {},
      startedAt: Date.now(),
    };
    state.loopStates.set(edgeId, loopState);
  }

  // Increment iteration
  loopState.iteration++;

  // Update accumulator with specified fields from node output
  if (
    accumulatorFields &&
    typeof nodeOutput === "object" &&
    nodeOutput !== null
  ) {
    const outputRecord = nodeOutput as Record<string, unknown>;
    for (const field of accumulatorFields) {
      if (field in outputRecord) {
        loopState.accumulator[field] = outputRecord[field];
      }
    }
  }

  // Update node iteration counter
  state.nodeIterations.set(targetNodeId, loopState.iteration);

  // Check if loop should continue
  return loopState.iteration < loopState.maxIterations;
}

/**
 * Get loop context for a node (iteration number and accumulator)
 *
 * Current implementation: Single loop support
 * - Returns context for the first incoming loop edge found
 * - Works correctly for nodes inside a single loop
 *
 * TODO: Nested loop support
 * For nested loops, we should:
 * 1. Find ALL incoming loop edges
 * 2. Return the most recently activated loop (highest iteration)
 * 3. Optionally return full loop stack for plugins that need parent loop context
 *
 * Example future API:
 * {
 *   iteration: 2,           // Current (innermost) loop iteration
 *   accumulator: {...},     // Current loop accumulator
 *   loopStack: [            // Full hierarchy (outer → inner)
 *     { edgeId: "outer", iteration: 1, accumulator: {...} },
 *     { edgeId: "inner", iteration: 2, accumulator: {...} }
 *   ]
 * }
 */
export function getLoopContext(
  nodeId: string,
  edges: Connection[],
  state: ExecutionState,
): { iteration?: number; accumulator?: Record<string, unknown> } {
  // Find incoming loop edge
  const incomingLoopEdge = edges.find(
    (e) => e.targetNodeId === nodeId && e.condition?.type === "loop",
  );

  if (!incomingLoopEdge) {
    return {}; // Not in a loop
  }

  const loopState = state.loopStates.get(incomingLoopEdge.id);
  if (!loopState) {
    return {}; // Loop not started yet
  }

  return {
    iteration: loopState.iteration,
    accumulator: loopState.accumulator,
  };
}
