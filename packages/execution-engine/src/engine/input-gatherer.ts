/**
 * Input gathering logic
 *
 * Flow-based connection model:
 * - For handle-based connections (sourceHandle specified): gather from that specific handle
 * - For flow-based connections (no sourceHandle): gather ALL outputs from source node
 *
 * Data is mapped to target ports:
 * - If targetHandle/targetPort specified: use that as the port name
 * - If not specified: use "input" as the default port name
 */

import type { ExecutionItem, PortData } from "../types/execution.js";
import type { ExecutionGraph } from "../types/graph.js";
import type { ExecutionState } from "./execution-state.js";

/**
 * Gather inputs for a node from upstream nodes
 *
 * This function:
 * 1. Finds all incoming edges to the node
 * 2. For each edge, gets outputs from source node:
 *    - Handle-based: only from specified handle
 *    - Flow-based: all outputs merged
 * 3. Maps data to target port
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

    // Get the handle (prefer sourceHandle, fallback to sourcePort for backwards compat)
    const handle = edge.sourceHandle ?? edge.sourcePort;

    // Determine target port name (prefer targetHandle, fallback to targetPort, then "input")
    const targetPortName = edge.targetHandle ?? edge.targetPort ?? "input";

    // Get or create target port entry
    const existingItems = portDataMap.get(targetPortName) || [];

    if (handle) {
      // Handle-based: get specific output port
      const sourcePort = sourceResult.outputs.find(
        (p) => p.portName === handle,
      );

      if (!sourcePort) {
        // In flow-based system, missing handle just means no data (not an error)
        // This can happen when edge expects a specific handle but node didn't produce it
        continue;
      }

      // Add lineage metadata to each item
      const itemsWithLineage = sourcePort.items.map(
        (item, idx): ExecutionItem => ({
          ...item,
          metadata: {
            ...item.metadata,
            sourceNode: edge.sourceNodeId,
            sourcePort: handle,
            sourceItemIndex: idx,
          },
        }),
      );

      existingItems.push(...itemsWithLineage);
    } else {
      // Flow-based: collect ALL outputs from source node
      for (const sourcePort of sourceResult.outputs) {
        const itemsWithLineage = sourcePort.items.map(
          (item, idx): ExecutionItem => ({
            ...item,
            metadata: {
              ...item.metadata,
              sourceNode: edge.sourceNodeId,
              sourcePort: sourcePort.portName,
              sourceItemIndex: idx,
            },
          }),
        );

        existingItems.push(...itemsWithLineage);
      }
    }

    portDataMap.set(targetPortName, existingItems);
  }

  // Convert map to array of PortData
  return Array.from(portDataMap.entries()).map(([portName, items]) => ({
    portName,
    items,
  }));
}
