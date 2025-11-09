/**
 * Topological Sort with Parallel Execution Support
 *
 * Sorts nodes in a DAG to determine execution order.
 * Uses Kahn's algorithm with deterministic ordering.
 * Returns nodes grouped by execution levels - nodes in the same level can execute in parallel.
 */

import type { Node, Connection } from '@kianax/shared/temporal';

/**
 * Topologically sort nodes into execution levels
 *
 * @param nodes - All nodes in the routine DAG
 * @param connections - Edges between nodes
 * @returns Array of node levels, where each level contains nodes that can execute in parallel
 *
 * @example
 * Input DAG:
 *   A → C
 *   B → C → D
 *
 * Output: [[A, B], [C], [D]]
 * - Level 0: A and B can run in parallel (no dependencies)
 * - Level 1: C waits for both A and B
 * - Level 2: D waits for C
 */
export function topologicalSort(
  nodes: Node[],
  connections: Connection[]
): Node[][] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize graph structures
  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  // Build adjacency list and calculate in-degrees
  for (const conn of connections) {
    adjacency.get(conn.sourceNodeId)!.push(conn.targetNodeId);
    inDegree.set(conn.targetNodeId, inDegree.get(conn.targetNodeId)! + 1);
  }

  // Find entry points (nodes with no incoming edges)
  let currentLevel: string[] = [];
  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      currentLevel.push(nodeId);
    }
  }

  // Sort for determinism (critical for Temporal workflow determinism)
  currentLevel.sort();

  // Modified Kahn's algorithm - process level by level
  const levels: Node[][] = [];
  let processedCount = 0;

  while (currentLevel.length > 0) {
    // All nodes in currentLevel have no remaining dependencies
    // and can execute in parallel
    const levelNodes = currentLevel.map(id => nodeMap.get(id)!);
    levels.push(levelNodes);
    processedCount += currentLevel.length;

    // Process all nodes in current level to find next level
    const nextLevel: string[] = [];
    for (const nodeId of currentLevel) {
      const neighbors = adjacency.get(nodeId)! || [];
      for (const neighborId of neighbors) {
        const newDegree = inDegree.get(neighborId)! - 1;
        inDegree.set(neighborId, newDegree);

        // If neighbor has no more dependencies, it can run in next level
        if (newDegree === 0) {
          nextLevel.push(neighborId);
        }
      }
    }

    // Sort next level for determinism
    nextLevel.sort();
    currentLevel = nextLevel;
  }

  // Check for cycles
  if (processedCount !== nodes.length) {
    throw new Error('Cycle detected in routine DAG');
  }

  return levels;
}
