/**
 * Routine Adapter
 *
 * Converts between Temporal's RoutineInput format and
 * execution-engine's RoutineDefinition format.
 */

import type { RoutineInput } from "@kianax/shared/temporal";
import type {
  RoutineDefinition,
  Edge,
  Node,
  PortType,
} from "@kianax/execution-engine";

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

  // Convert connections to edges
  const adaptedEdges: Edge[] = connections.map((conn) => ({
    id: conn.id,
    sourceNodeId: conn.sourceNodeId,
    sourcePort: conn.sourceHandle || "output", // Default to "output" if not specified
    targetNodeId: conn.targetNodeId,
    targetPort: conn.targetHandle || "input", // Default to "input" if not specified
    type: "main" as PortType.Main, // All edges are main type (port-based routing)
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
