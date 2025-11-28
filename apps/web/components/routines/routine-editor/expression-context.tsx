"use client";

/**
 * ExpressionContext Provider
 *
 * Provides expression context (variables, upstream nodes) to all descendant
 * components within the routine editor. This eliminates prop drilling and
 * allows any component to access expression metadata for autocomplete.
 */

import {
  createContext,
  useContext,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import type { Node, Edge } from "@xyflow/react";
import type { RoutineVariable } from "./variables-panel";
import { getPluginOutputs } from "@kianax/plugins";

/**
 * Node information for expression context.
 */
interface ContextNode {
  id: string;
  label: string;
  pluginId: string;
  /** Output port names from plugin metadata */
  outputs: string[];
}

/**
 * Expression context value provided to consumers.
 */
interface ExpressionContextValue {
  /** All routine variables */
  variables: RoutineVariable[];

  /** All nodes in the routine */
  allNodes: ContextNode[];

  /**
   * Get upstream nodes for a specific node.
   * Uses BFS to find all nodes that can flow data to the given node.
   */
  getUpstreamNodes: (nodeId: string) => ContextNode[];

  /**
   * Check if a node is upstream of another node.
   */
  isUpstream: (sourceNodeId: string, targetNodeId: string) => boolean;
}

const ExpressionContext = createContext<ExpressionContextValue | null>(null);

interface ExpressionContextProviderProps {
  /** React Flow nodes */
  nodes: Node[];
  /** React Flow edges */
  edges: Edge[];
  /** Routine variables */
  variables: RoutineVariable[];
  children: ReactNode;
}

/**
 * Provides expression context to all descendant components.
 *
 * Wrap the routine editor content with this provider to enable
 * expression autocomplete in NodeConfigDrawer and plugin config UIs.
 */
export function ExpressionContextProvider({
  nodes,
  edges,
  variables,
  children,
}: ExpressionContextProviderProps) {
  // Convert React Flow nodes to context nodes with output information
  const allNodes = useMemo<ContextNode[]>(() => {
    return nodes.map((node) => {
      const pluginId = (node.data as { pluginId: string }).pluginId;
      const label = (node.data as { label: string }).label;

      // Get output port names from plugin registry
      const outputs = getPluginOutputs(pluginId);

      return {
        id: node.id,
        label,
        pluginId,
        outputs,
      };
    });
  }, [nodes]);

  // Build adjacency list for upstream traversal (target -> sources)
  const incomingEdges = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const edge of edges) {
      const sources = map.get(edge.target) || [];
      if (!sources.includes(edge.source)) {
        sources.push(edge.source);
      }
      map.set(edge.target, sources);
    }
    return map;
  }, [edges]);

  // BFS to find all upstream nodes
  const getUpstreamNodes = useCallback(
    (nodeId: string): ContextNode[] => {
      const visited = new Set<string>();
      const queue: string[] = [];
      const upstreamIds: string[] = [];

      // Start with direct upstream nodes
      const directUpstream = incomingEdges.get(nodeId) || [];
      queue.push(...directUpstream);

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (visited.has(currentId)) continue;
        visited.add(currentId);
        upstreamIds.push(currentId);

        // Add this node's upstream nodes to the queue
        const nextUpstream = incomingEdges.get(currentId) || [];
        queue.push(...nextUpstream);
      }

      // Return context nodes for upstream IDs
      return allNodes.filter((n) => upstreamIds.includes(n.id));
    },
    [allNodes, incomingEdges],
  );

  // Check if source is upstream of target
  const isUpstream = useCallback(
    (sourceNodeId: string, targetNodeId: string): boolean => {
      const upstreamNodes = getUpstreamNodes(targetNodeId);
      return upstreamNodes.some((n) => n.id === sourceNodeId);
    },
    [getUpstreamNodes],
  );

  const value = useMemo<ExpressionContextValue>(
    () => ({
      variables,
      allNodes,
      getUpstreamNodes,
      isUpstream,
    }),
    [variables, allNodes, getUpstreamNodes, isUpstream],
  );

  return (
    <ExpressionContext.Provider value={value}>
      {children}
    </ExpressionContext.Provider>
  );
}

/**
 * Hook to access expression context.
 *
 * Must be used within an ExpressionContextProvider.
 */
export function useExpressionContext(): ExpressionContextValue {
  const context = useContext(ExpressionContext);
  if (!context) {
    throw new Error(
      "useExpressionContext must be used within an ExpressionContextProvider",
    );
  }
  return context;
}

/**
 * Hook to optionally access expression context.
 *
 * Returns null if not within an ExpressionContextProvider.
 * Use this when the component might be rendered outside the provider.
 */
export function useOptionalExpressionContext(): ExpressionContextValue | null {
  return useContext(ExpressionContext);
}

/**
 * Expression context in the domain format expected by plugin config components.
 *
 * This format matches the ExpressionContext type in @kianax/plugins/config-registry.
 * Plugin config UIs (like ExpressionField) internally convert this to the UI
 * component's generic tree format using buildExpressionContext().
 */
export interface NodeExpressionContext {
  variables: Array<{
    name: string;
    type: "string" | "number" | "boolean" | "json";
    value?: unknown;
    description?: string;
  }>;
  upstreamNodes: Array<{
    id: string;
    label: string;
    pluginId: string;
    outputs: string[];
  }>;
  hasTrigger: boolean;
}

/**
 * Hook to get expression context for a specific node.
 *
 * Returns the context in the domain format expected by plugin config components.
 */
export function useNodeExpressionContext(
  nodeId: string,
): NodeExpressionContext {
  const { variables, getUpstreamNodes } = useExpressionContext();

  return useMemo(() => {
    const upstreamNodes = getUpstreamNodes(nodeId);

    return {
      variables: variables.map((v) => ({
        name: v.name,
        type: v.type,
        value: v.value,
        description: v.description,
      })),
      upstreamNodes: upstreamNodes.map((n) => ({
        id: n.id,
        label: n.label,
        pluginId: n.pluginId,
        outputs: n.outputs,
      })),
      hasTrigger: true, // Assume trigger is always available
    };
  }, [nodeId, variables, getUpstreamNodes]);
}

/**
 * Safe hook to get expression context for a specific node.
 *
 * Returns undefined if not within an ExpressionContextProvider.
 * Use this when the component might be rendered outside the provider.
 */
export function useOptionalNodeExpressionContext(
  nodeId: string,
): NodeExpressionContext | undefined {
  const context = useOptionalExpressionContext();

  return useMemo(() => {
    if (!context) return undefined;

    const upstreamNodes = context.getUpstreamNodes(nodeId);

    return {
      variables: context.variables.map((v) => ({
        name: v.name,
        type: v.type,
        value: v.value,
        description: v.description,
      })),
      upstreamNodes: upstreamNodes.map((n) => ({
        id: n.id,
        label: n.label,
        pluginId: n.pluginId,
        outputs: n.outputs,
      })),
      hasTrigger: true,
    };
  }, [nodeId, context]);
}
