/**
 * Graph validation logic
 *
 * Validates routine graph structure including:
 * - Entry nodes exist
 * - No orphaned nodes
 * - No cycles (or valid cycles for loops)
 * - All connections are valid
 */

import type {
  Edge,
  GraphValidationError,
  GraphValidationResult,
  GraphValidationWarning,
  Node,
  RoutineDefinition,
} from "../types/graph.js";

/**
 * Validate a routine graph structure
 */
export function validateGraph(
  routine: RoutineDefinition,
): GraphValidationResult {
  const errors: GraphValidationError[] = [];
  const warnings: GraphValidationWarning[] = [];

  // 1. Check for entry nodes (nodes with no incoming edges)
  const entryNodes = findEntryNodes(routine.nodes, routine.connections);
  if (entryNodes.length === 0) {
    errors.push({
      type: "no_entry_nodes",
      message:
        "Routine has no entry nodes (nodes with no incoming connections)",
    });
  }

  // 2. Check for orphaned nodes (nodes not connected to anything)
  const orphanedNodes = findOrphanedNodes(routine.nodes, routine.connections);
  for (const node of orphanedNodes) {
    errors.push({
      type: "orphaned_node",
      nodeId: node.id,
      message: `Node "${node.label}" (${node.id}) is not connected to any other node`,
    });
  }

  // 3. Check all connections reference valid nodes
  for (const edge of routine.connections) {
    const sourceNode = routine.nodes.find((n) => n.id === edge.sourceNodeId);
    const targetNode = routine.nodes.find((n) => n.id === edge.targetNodeId);

    if (!sourceNode) {
      errors.push({
        type: "missing_node",
        edgeId: edge.id,
        message: `Connection references non-existent source node: ${edge.sourceNodeId}`,
      });
    }

    if (!targetNode) {
      errors.push({
        type: "missing_node",
        edgeId: edge.id,
        message: `Connection references non-existent target node: ${edge.targetNodeId}`,
      });
    }
  }

  // 4. Check for cycles (excluding valid loop edges)
  const cycles = detectCycles(routine.nodes, routine.connections);
  for (const cycle of cycles) {
    errors.push({
      type: "cycle_detected",
      message: `Cycle detected in graph: ${cycle.join(" → ")}`,
    });
  }

  // 5. Check for unreachable nodes
  if (entryNodes.length > 0) {
    const reachableNodes = findReachableNodes(entryNodes, routine.connections);
    for (const node of routine.nodes) {
      if (!reachableNodes.has(node.id)) {
        warnings.push({
          type: "unreachable_node",
          nodeId: node.id,
          message: `Node "${node.label}" (${node.id}) is unreachable from entry nodes`,
        });
      }
    }
  }

  // 6. Warn about multiple entry points (might be intentional)
  if (entryNodes.length > 1) {
    warnings.push({
      type: "multiple_entry_points",
      message: `Routine has ${entryNodes.length} entry points. This might be intentional but could indicate parallel execution paths.`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Find nodes with no incoming edges
 */
function findEntryNodes(nodes: Node[], edges: Edge[]): Node[] {
  const nodesWithIncoming = new Set(edges.map((e) => e.targetNodeId));
  return nodes.filter((node) => !nodesWithIncoming.has(node.id));
}

/**
 * Find orphaned nodes (no incoming or outgoing edges)
 */
function findOrphanedNodes(nodes: Node[], edges: Edge[]): Node[] {
  const connectedNodes = new Set<string>();
  for (const edge of edges) {
    connectedNodes.add(edge.sourceNodeId);
    connectedNodes.add(edge.targetNodeId);
  }
  return nodes.filter((node) => !connectedNodes.has(node.id));
}

/**
 * Detect cycles in the graph (DFS-based)
 */
function detectCycles(nodes: Node[], edges: Edge[]): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adjacency.has(edge.sourceNodeId)) {
      adjacency.set(edge.sourceNodeId, []);
    }
    adjacency.get(edge.sourceNodeId)!.push(edge.targetNodeId);
  }

  function dfs(nodeId: string, path: string[]): void {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path]);
      } else if (recursionStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        cycles.push([...path.slice(cycleStart), neighbor]);
      }
    }

    recursionStack.delete(nodeId);
  }

  // Check from each node
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id, []);
    }
  }

  return cycles;
}

/**
 * Find all nodes reachable from entry nodes (BFS)
 */
function findReachableNodes(entryNodes: Node[], edges: Edge[]): Set<string> {
  const reachable = new Set<string>();
  const queue = [...entryNodes.map((n) => n.id)];

  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!adjacency.has(edge.sourceNodeId)) {
      adjacency.set(edge.sourceNodeId, []);
    }
    adjacency.get(edge.sourceNodeId)!.push(edge.targetNodeId);
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (reachable.has(nodeId)) continue;

    reachable.add(nodeId);

    const neighbors = adjacency.get(nodeId) || [];
    queue.push(...neighbors);
  }

  return reachable;
}
