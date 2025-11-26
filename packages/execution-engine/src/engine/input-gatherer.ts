/**
 * Input gathering logic
 *
 * Responsible for collecting inputs for a node from its upstream nodes
 * based on explicit port-to-port connections.
 */

import type { ExecutionItem, PortData } from "../types/execution.js";
import type { ExecutionGraph } from "../types/graph.js";
import type { ExecutionState } from "./execution-state.js";

/**
 * Gather inputs for a node from upstream nodes
 *
 * This function:
 * 1. Finds all incoming edges to the node
 * 2. For each edge, gets the output from the source node's specified port
 * 3. Maps it to the target port
 * 4. Adds lineage metadata to track data flow
 */
export function gatherNodeInputs(
  nodeId: string,
  graph: ExecutionGraph,
  state: ExecutionState,
): PortData[] {
  const incomingEdges = graph.edgesByTarget.get(nodeId) || [];
  const portDataMap = new Map<string, ExecutionItem[]>();

  for (const edge of incomingEdges) {
    // Get source node result
    const sourceResult = state.getNodeResult(edge.sourceNodeId);
    if (!sourceResult || sourceResult.status === "error") {
      continue;
    }

    // Find the specific output port from source
    const sourcePort = sourceResult.outputs.find(
      (p) => p.portName === edge.sourcePort,
    );

    if (!sourcePort) {
      throw new Error(
        `Source port "${edge.sourcePort}" not found in node "${edge.sourceNodeId}" output. ` +
          `Available ports: ${sourceResult.outputs.map((p) => p.portName).join(", ")}`,
      );
    }

    // Get or create target port entry
    const targetPortName = edge.targetPort;
    const existingItems = portDataMap.get(targetPortName) || [];

    // Add lineage metadata to each item
    const itemsWithLineage = sourcePort.items.map(
      (item, idx): ExecutionItem => ({
        ...item,
        metadata: {
          ...item.metadata,
          sourceNode: edge.sourceNodeId,
          sourcePort: edge.sourcePort,
          sourceItemIndex: idx,
        },
      }),
    );

    // Append items to target port
    existingItems.push(...itemsWithLineage);
    portDataMap.set(targetPortName, existingItems);
  }

  // Convert map to array of PortData
  return Array.from(portDataMap.entries()).map(([portName, items]) => ({
    portName,
    items,
  }));
}
