/**
 * Routine Adapter
 *
 * Converts between Temporal's RoutineInput format and
 * execution-engine's RoutineDefinition format.
 *
 * Uses flow-based connection model:
 * - sourceHandle: for control flow routing (optional)
 * - targetHandle: for UI positioning (optional)
 */

import type { RoutineInput } from "@kianax/shared/temporal";
import type { RoutineDefinition, Edge, Node } from "@kianax/execution-engine";

/**
 * Convert Temporal RoutineInput to execution-engine RoutineDefinition
 */
export function adaptRoutineInput(input: RoutineInput): RoutineDefinition {
  const { routineId, nodes, connections, variables, triggerData } = input;

  // Convert nodes
  const adaptedNodes: Node[] = nodes.map((node) => ({
    id: node.id,
    pluginId: node.pluginId,
    label: node.pluginId, // Use pluginId as label (could be enhanced later)
    parameters: node.config, // config -> parameters
    credentialMappings: node.credentialMappings,
  }));

  // Convert connections to edges (flow-based model)
  const adaptedEdges: Edge[] = connections.map((conn) => ({
    id: conn.id,
    sourceNodeId: conn.sourceNodeId,
    targetNodeId: conn.targetNodeId,
    // Flow-based: sourceHandle is optional, only used for control flow routing
    sourceHandle: conn.sourceHandle || undefined,
    targetHandle: conn.targetHandle || undefined,
  }));

  return {
    id: routineId,
    name: `Routine ${routineId}`, // Generate a name (could be enhanced with user-provided name)
    nodes: adaptedNodes,
    connections: adaptedEdges,
    variables,
    triggerData,
  };
}
