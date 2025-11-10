/**
 * Dynamic DAG Executor for Routines
 *
 * Executes user-defined routine graphs with support for:
 * - Conditional branching (if-else, switch)
 * - Parallel execution (independent nodes)
 * - Data flow (output → input mapping)
 * - Deterministic replay (for Temporal)
 */

import type { RoutineInput, Node, Connection } from "@kianax/shared/temporal";

/**
 * Execution state tracking
 */
export class ExecutionState {
  nodeOutputs = new Map<string, unknown>();
  executed = new Set<string>();
  executionPath: string[] = [];
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
 * For other nodes: Follow all outgoing edges
 */
export function determineNextNodes(
  nodeId: string,
  nodeOutput: unknown,
  nodes: Map<string, Node>,
  edges: Connection[],
): string[] {
  const node = nodes.get(nodeId);

  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  const outgoingEdges = edges.filter((e) => e.sourceNodeId === nodeId);

  // For logic nodes, filter edges by branch condition
  if (node.type === "logic") {
    // Type guard to check if nodeOutput is a LogicNodeOutput
    if (
      !nodeOutput ||
      typeof nodeOutput !== "object" ||
      !("branch" in nodeOutput) ||
      typeof (nodeOutput as LogicNodeOutput).branch !== "string"
    ) {
      throw new Error(
        `Logic node ${nodeId} did not return a valid branch value. Output: ${JSON.stringify(nodeOutput)}`,
      );
    }

    const branch = (nodeOutput as LogicNodeOutput).branch;

    return outgoingEdges
      .filter((edge) => {
        // No condition = default edge (always follow)
        if (!edge.condition) return true;

        // Match branch condition
        if (edge.condition.type === "branch") {
          return edge.condition.value === branch;
        }

        // Default edge
        return edge.condition.type === "default";
      })
      .map((edge) => edge.targetNodeId);
  }

  // For non-logic nodes, follow all outgoing edges
  return outgoingEdges.map((edge) => edge.targetNodeId);
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
      inputs[edge.targetHandle] = value;
    } else {
      // No target handle - merge entire value
      if (typeof value === "object" && !Array.isArray(value)) {
        Object.assign(inputs, value);
      } else {
        // Primitive value or array - wrap in 'data' field
        inputs.data = value;
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

  // Check for cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const outgoing = routine.connections
      .filter((c) => c.sourceNodeId === nodeId)
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

  // Check that logic nodes have conditional edges
  for (const node of routine.nodes) {
    if (node.type === "logic") {
      const outgoing = routine.connections.filter(
        (c) => c.sourceNodeId === node.id,
      );

      if (outgoing.length === 0) {
        errors.push(
          `Logic node ${node.id} has no outgoing connections - branches will not be executed`,
        );
      }

      const hasConditionalEdges = outgoing.some((e) => e.condition);
      if (!hasConditionalEdges) {
        errors.push(
          `Logic node ${node.id} has no conditional edges - all branches will execute`,
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
