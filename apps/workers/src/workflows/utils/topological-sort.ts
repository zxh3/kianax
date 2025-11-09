/**
 * Topological Sort
 *
 * Sorts nodes in a DAG to determine execution order.
 * Uses Kahn's algorithm with deterministic ordering.
 */

import type { Node, Connection } from '@kianax/shared/temporal';

export function topologicalSort(
  nodes: Node[],
  connections: Connection[]
): Node[] {
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
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  // Sort queue for determinism (critical for Temporal workflow determinism)
  queue.sort();

  // Kahn's algorithm
  const sorted: Node[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    sorted.push(nodeMap.get(nodeId)!);

    const neighbors = adjacency.get(nodeId)! || [];
    for (const neighborId of neighbors) {
      const newDegree = inDegree.get(neighborId)! - 1;
      inDegree.set(neighborId, newDegree);

      if (newDegree === 0) {
        queue.push(neighborId);
      }
    }

    // Sort queue again for determinism
    queue.sort();
  }

  // Check for cycles
  if (sorted.length !== nodes.length) {
    throw new Error('Cycle detected in routine DAG');
  }

  return sorted;
}
