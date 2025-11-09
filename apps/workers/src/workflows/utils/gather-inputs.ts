/**
 * Gather Node Inputs
 *
 * Collects inputs for a node from connected upstream nodes.
 * Handles single input, multiple inputs, and entry nodes.
 */

import type { Connection } from '@kianax/shared/temporal';

export function gatherNodeInputs(
  nodeId: string,
  connections: Connection[],
  results: Map<string, any>,
  triggerData?: any
): any {
  // Find all incoming connections to this node
  const incomingConnections = connections.filter(
    (c) => c.targetNodeId === nodeId
  );

  if (incomingConnections.length === 0) {
    // Entry node - use trigger data if available
    return triggerData || {};
  }

  if (incomingConnections.length === 1) {
    // Single input - return output from source node
    const sourceId = incomingConnections[0]!.sourceNodeId;
    return results.get(sourceId);
  }

  // Multiple inputs - merge into object with handles as keys
  // This is useful for logic nodes that have multiple branches (if/else)
  const inputs: any = {};
  for (const conn of incomingConnections) {
    const handle = conn.targetHandle || 'default';
    inputs[handle] = results.get(conn.sourceNodeId);
  }
  return inputs;
}
