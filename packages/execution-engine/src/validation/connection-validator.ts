/**
 * Connection validation logic
 *
 * Validates that connections between nodes are valid:
 * - Port types match
 * - Ports exist on both nodes
 * - Schemas are compatible (basic check)
 */

import type { Edge } from "../types/graph.js";

/**
 * Validate a single connection
 *
 * This is a placeholder for now. Full validation will require plugin metadata.
 */
export function validateConnection(edge: Edge): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Basic validation
  if (!edge.sourceNodeId || !edge.targetNodeId) {
    errors.push("Connection must have both source and target nodes");
  }

  if (!edge.sourcePort || !edge.targetPort) {
    errors.push("Connection must have both source and target ports");
  }

  // More validation will be added when we have access to plugin metadata
  // to check:
  // - Port exists on source node
  // - Port exists on target node
  // - Port types match
  // - Schemas are compatible

  return {
    valid: errors.length === 0,
    errors,
  };
}
