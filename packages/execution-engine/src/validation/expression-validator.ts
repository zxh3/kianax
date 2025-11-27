/**
 * Expression Validator
 *
 * Validates expressions in node configurations:
 * - {{ vars.name }} references must point to existing routine variables
 * - {{ nodes.nodeId.port }} references must point to upstream nodes
 * - {{ trigger.* }} and {{ execution.* }} are always valid (runtime data)
 */

import {
  ExpressionResolver,
  createEmptyContext,
  type VariableReference,
} from "../engine/expression-resolver.js";
import type { Node, Edge, RoutineDefinition } from "../types/graph.js";

/**
 * Expression validation error
 */
export interface ExpressionValidationError {
  /** The node containing the invalid expression */
  nodeId: string;
  /** Node label for display */
  nodeLabel?: string;
  /** The invalid expression string */
  expression: string;
  /** Error message */
  message: string;
  /** Error type for categorization */
  type:
    | "UNDEFINED_VARIABLE"
    | "INVALID_NODE_REF"
    | "NOT_UPSTREAM"
    | "SELF_REFERENCE";
}

/**
 * Expression validation warning (non-blocking)
 */
export interface ExpressionValidationWarning {
  nodeId: string;
  nodeLabel?: string;
  expression: string;
  message: string;
  type: "UNKNOWN_SOURCE" | "EMPTY_EXPRESSION";
}

/**
 * Result of expression validation
 */
export interface ExpressionValidationResult {
  /** Whether all expressions are valid */
  valid: boolean;
  /** Validation errors (blocking) */
  errors: ExpressionValidationError[];
  /** Validation warnings (non-blocking) */
  warnings: ExpressionValidationWarning[];
}

/**
 * Validate all expressions in a routine
 *
 * @param routine - The routine definition to validate
 * @returns Validation result with errors and warnings
 */
export function validateExpressions(
  routine: RoutineDefinition,
): ExpressionValidationResult {
  const errors: ExpressionValidationError[] = [];
  const warnings: ExpressionValidationWarning[] = [];

  // Build set of valid variable names
  const validVariables = new Set((routine.variables || []).map((v) => v.name));

  // Build set of all node IDs
  const allNodeIds = new Set(routine.nodes.map((n) => n.id));

  // Build upstream map for each node
  const upstreamMap = buildUpstreamMap(routine.nodes, routine.connections);

  // Create a resolver just for extracting references (context doesn't matter)
  const resolver = new ExpressionResolver(createEmptyContext());

  // Validate each node's parameters
  for (const node of routine.nodes) {
    const references = resolver.extractReferences(node.parameters);
    const upstreamNodes = upstreamMap.get(node.id) || new Set<string>();

    for (const ref of references) {
      validateReference(
        ref,
        node,
        validVariables,
        allNodeIds,
        upstreamNodes,
        errors,
        warnings,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a single variable reference
 */
function validateReference(
  ref: VariableReference,
  node: Node,
  validVariables: Set<string>,
  allNodeIds: Set<string>,
  upstreamNodes: Set<string>,
  errors: ExpressionValidationError[],
  warnings: ExpressionValidationWarning[],
): void {
  switch (ref.source) {
    case "vars":
      validateVarsReference(ref, node, validVariables, errors);
      break;

    case "nodes":
      validateNodesReference(ref, node, allNodeIds, upstreamNodes, errors);
      break;

    case "trigger":
    case "execution":
      // These are always valid - they reference runtime data
      break;

    default:
      // Unknown source type
      warnings.push({
        nodeId: node.id,
        nodeLabel: node.label,
        expression: ref.expression,
        message: `Unknown expression source: ${ref.source}`,
        type: "UNKNOWN_SOURCE",
      });
  }
}

/**
 * Validate a vars reference
 */
function validateVarsReference(
  ref: VariableReference,
  node: Node,
  validVariables: Set<string>,
  errors: ExpressionValidationError[],
): void {
  // {{ vars }} without a name is valid (returns all vars)
  if (ref.path.length === 0) {
    return;
  }

  const varName = ref.path[0];
  if (varName && !validVariables.has(varName)) {
    errors.push({
      nodeId: node.id,
      nodeLabel: node.label,
      expression: ref.expression,
      message: `Variable "${varName}" is not defined. Add it in the Variables panel.`,
      type: "UNDEFINED_VARIABLE",
    });
  }
}

/**
 * Validate a nodes reference
 */
function validateNodesReference(
  ref: VariableReference,
  node: Node,
  allNodeIds: Set<string>,
  upstreamNodes: Set<string>,
  errors: ExpressionValidationError[],
): void {
  // {{ nodes }} without a nodeId is valid (returns all node outputs)
  if (!ref.nodeId) {
    return;
  }

  const referencedNodeId = ref.nodeId;

  // Check for self-reference
  if (referencedNodeId === node.id) {
    errors.push({
      nodeId: node.id,
      nodeLabel: node.label,
      expression: ref.expression,
      message: `Node cannot reference its own output`,
      type: "SELF_REFERENCE",
    });
    return;
  }

  // Check if referenced node exists
  if (!allNodeIds.has(referencedNodeId)) {
    errors.push({
      nodeId: node.id,
      nodeLabel: node.label,
      expression: ref.expression,
      message: `Referenced node "${referencedNodeId}" does not exist`,
      type: "INVALID_NODE_REF",
    });
    return;
  }

  // Check if referenced node is upstream
  if (!upstreamNodes.has(referencedNodeId)) {
    errors.push({
      nodeId: node.id,
      nodeLabel: node.label,
      expression: ref.expression,
      message: `Node "${referencedNodeId}" is not upstream. You can only reference nodes that execute before this one.`,
      type: "NOT_UPSTREAM",
    });
  }
}

/**
 * Build a map of upstream nodes for each node in the graph
 *
 * A node X is "upstream" of node Y if there exists a directed path from X to Y.
 * This is computed by traversing backwards from each node.
 *
 * @returns Map of nodeId -> Set of upstream nodeIds
 */
function buildUpstreamMap(
  nodes: Node[],
  edges: Edge[],
): Map<string, Set<string>> {
  const upstreamMap = new Map<string, Set<string>>();

  // Build reverse adjacency list (target -> sources)
  const reverseAdjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!reverseAdjacency.has(edge.targetNodeId)) {
      reverseAdjacency.set(edge.targetNodeId, []);
    }
    reverseAdjacency.get(edge.targetNodeId)!.push(edge.sourceNodeId);
  }

  // For each node, find all upstream nodes using BFS
  for (const node of nodes) {
    const upstream = new Set<string>();
    const queue = [...(reverseAdjacency.get(node.id) || [])];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      upstream.add(currentId);

      // Add this node's upstream nodes to the queue
      const parents = reverseAdjacency.get(currentId) || [];
      queue.push(...parents);
    }

    upstreamMap.set(node.id, upstream);
  }

  return upstreamMap;
}

/**
 * Convenience function to validate expressions and return just errors
 */
export function getExpressionErrors(
  routine: RoutineDefinition,
): ExpressionValidationError[] {
  return validateExpressions(routine).errors;
}

/**
 * Check if a routine has valid expressions
 */
export function hasValidExpressions(routine: RoutineDefinition): boolean {
  return validateExpressions(routine).valid;
}
