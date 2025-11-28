import { useState, useCallback, useEffect, useRef } from "react";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import type { RoutineNode, RoutineConnection } from "../types";
import type { PluginNodeData } from "../../plugin-node";

interface UseRoutineGraphProps {
  initialNodes: RoutineNode[];
  initialConnections: RoutineConnection[];
  onConfigureNode?: (nodeId: string) => void;
}

export function useRoutineGraph({
  initialNodes,
  initialConnections,
  onConfigureNode,
}: UseRoutineGraphProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const isInitializedRef = useRef(false);

  // --- Conversion Helpers ---

  const convertToReactFlowNodes = useCallback(
    (routineNodes: RoutineNode[]): Node[] => {
      return routineNodes.map((node) => ({
        id: node.id,
        type: "pluginNode",
        position: node.position,
        data: {
          label: node.label,
          pluginId: node.pluginId,
          onConfigure: onConfigureNode,
          config: node.config,
          credentialMappings: node.credentialMappings,
        },
      }));
    },
    [onConfigureNode],
  );

  const convertToReactFlowEdges = useCallback(
    (routineConnections: RoutineConnection[]): Edge[] => {
      return routineConnections.map((conn) => ({
        id: conn.id,
        source: conn.sourceNodeId,
        target: conn.targetNodeId,
        sourceHandle: conn.sourceHandle,
        targetHandle: conn.targetHandle,
        animated: true,
        style: {
          strokeWidth: 2,
          strokeDasharray: "5 5",
          stroke:
            conn.sourceHandle === "true" || conn.sourceHandle === "success"
              ? "#10b981"
              : conn.sourceHandle === "false" || conn.sourceHandle === "error"
                ? "#ef4444"
                : "#94a3b8",
        },
      }));
    },
    [],
  );

  const convertFromReactFlowNodes = useCallback(
    (reactFlowNodes: Node[]): RoutineNode[] => {
      return reactFlowNodes.map((node) => {
        const data = node.data as PluginNodeData & {
          config?: Record<string, unknown>;
        };
        return {
          id: node.id,
          pluginId: data.pluginId,
          label: data.label,
          position: node.position,
          config: data.config,
          credentialMappings: data.credentialMappings,
        };
      });
    },
    [],
  );

  const convertFromReactFlowEdges = useCallback(
    (reactFlowEdges: Edge[]): RoutineConnection[] => {
      return reactFlowEdges.map((edge) => ({
        id: edge.id,
        sourceNodeId: edge.source,
        targetNodeId: edge.target,
        sourceHandle: edge.sourceHandle || undefined,
        targetHandle: edge.targetHandle || undefined,
      }));
    },
    [],
  );

  // --- Initialization ---

  useEffect(() => {
    if (!isInitializedRef.current) {
      setNodes(convertToReactFlowNodes(initialNodes));
      setEdges(convertToReactFlowEdges(initialConnections));
      isInitializedRef.current = true;
    }
  }, [
    initialNodes,
    initialConnections,
    convertToReactFlowNodes,
    convertToReactFlowEdges,
  ]);

  // --- Event Handlers ---

  const onNodesChange: OnNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange: OnEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect: OnConnect = useCallback((connection: Connection) => {
    const newEdge: Edge = {
      ...connection,
      id: `${connection.source}-${connection.target}-${Date.now()}`,
      animated: true,
      style: {
        strokeWidth: 2,
        strokeDasharray: "5 5",
        stroke:
          connection.sourceHandle === "true" ||
          connection.sourceHandle === "success"
            ? "#10b981"
            : connection.sourceHandle === "false" ||
                connection.sourceHandle === "error"
              ? "#ef4444"
              : "#94a3b8",
      },
      label: connection.sourceHandle || undefined,
      labelStyle: {
        fill: "#64748b",
        fontWeight: 600,
        fontSize: 11,
      },
      labelBgStyle: {
        fill: "#ffffff",
        fillOpacity: 0.9,
        stroke: "#e2e8f0",
        strokeWidth: 1,
      },
      labelBgPadding: [8, 4] as [number, number],
      labelBgBorderRadius: 8,
    };

    setEdges((eds) => addEdge(newEdge, eds));
  }, []);

  // --- Actions ---

  const addNode = useCallback(
    (pluginId: string, pluginName: string) => {
      const existingNodes = nodes;
      const columnWidth = 300;
      const rowHeight = 150;
      const maxNodesPerRow = 3;

      const nodeIndex = existingNodes.length;
      const row = Math.floor(nodeIndex / maxNodesPerRow);
      const col = nodeIndex % maxNodesPerRow;

      const newNode: Node = {
        id: `node-${Date.now()}`,
        type: "pluginNode",
        position: {
          x: col * columnWidth + 100,
          y: row * rowHeight + 100,
        },
        data: {
          label: pluginName,
          pluginId,
          onConfigure: onConfigureNode,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [nodes, onConfigureNode],
  );

  const updateNodeConfig = useCallback(
    (
      nodeId: string,
      config: Record<string, unknown>,
      label: string,
      credentialMappings?: Record<string, string>,
    ) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? {
                ...node,
                data: { ...node.data, config, label, credentialMappings },
              }
            : node,
        ),
      );
    },
    [],
  );

  const setNodesSelection = useCallback((nodeId: string | null) => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        selected: node.id === nodeId,
      })),
    );
  }, []);

  const updateNodeExecutionStatus = useCallback(
    (
      nodeStatusMap: Map<
        string,
        "running" | "completed" | "failed" | "pending"
      >,
    ) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          const status = nodeStatusMap.get(node.id);
          const currentStatus = (node.data as any).executionStatus;
          if (status !== currentStatus) {
            return {
              ...node,
              data: {
                ...node.data,
                executionStatus: status,
              },
            };
          }
          return node;
        }),
      );
    },
    [],
  );

  const getRoutineData = useCallback(() => {
    return {
      nodes: convertFromReactFlowNodes(nodes),
      connections: convertFromReactFlowEdges(edges),
    };
  }, [nodes, edges, convertFromReactFlowNodes, convertFromReactFlowEdges]);

  const setRoutineData = useCallback(
    (routineNodes: RoutineNode[], routineConnections: RoutineConnection[]) => {
      setNodes(convertToReactFlowNodes(routineNodes));
      setEdges(convertToReactFlowEdges(routineConnections));
    },
    [convertToReactFlowNodes, convertToReactFlowEdges],
  );

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    updateNodeConfig,
    updateNodeExecutionStatus,
    setNodesSelection,
    getRoutineData,
    setRoutineData,
    convertFromReactFlowNodes,
    convertFromReactFlowEdges,
    convertToReactFlowNodes,
    convertToReactFlowEdges,
  };
}
