"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@kianax/server/convex/_generated/api";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
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
import "@xyflow/react/dist/style.css";
import PluginNode, { type PluginNodeData } from "../plugin-node";
import { NodeConfigDrawer } from "../node-config-drawer";
import { TestResultDrawer } from "../test-result-drawer";
import { Textarea } from "@kianax/ui/components/textarea";
import { toast } from "sonner";
import { Toolbar } from "./toolbar";
import { NodeSelector } from "./sidebar";
import { TopBar } from "./topbar";
import { useTheme } from "next-themes";
import { getPluginMetadata } from "@/lib/plugins";
import type {
  RoutineEditorProps,
  RoutineNode,
  RoutineConnection,
  EditorMode,
} from "./types";

const nodeTypes = {
  pluginNode: PluginNode,
} as const;

export function RoutineEditor({
  routineId,
  initialNodes,
  initialConnections,
  onSave,
  onTest,
}: RoutineEditorProps) {
  const { theme } = useTheme();
  // State definitions
  const [nodeSelectorOpen, setNodeSelectorOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<"select" | "hand" | null>(
    "hand",
  );
  const [editorMode, setEditorMode] = useState<EditorMode>("visual");
  const [jsonValue, setJsonValue] = useState("");
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
  const [configuringNodeId, setConfiguringNodeId] = useState<string | null>(
    null,
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Test Execution State
  const [testWorkflowId, setTestWorkflowId] = useState<string | null>(null);
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [isStartingTest, setIsStartingTest] = useState(false);
  const [resultDrawerOpen, setResultDrawerOpen] = useState(false);
  const [selectedResultNodeId, setSelectedResultNodeId] = useState<
    string | null
  >(null);

  // Auto-save timer ref
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track if we've initialized to prevent re-initialization on prop changes
  const isInitializedRef = useRef(false);

  // Fetch execution status if a test is running/open
  const testExecution = useQuery(
    api.executions.getByWorkflowId,
    testWorkflowId ? { workflowId: testWorkflowId } : "skip",
  );

  // Nodes and Edges state (initialized empty, populated via useEffect to allow for callbacks)
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  // Refs to track latest nodes and edges for auto-save
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);

  // Update refs whenever nodes or edges change
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // Update nodes with execution status
  useEffect(() => {
    if (!testExecution || !testExecution.nodeStates) return;

    // Create a map of node status
    // If multiple executions for a node (loop), take the latest or "running" one
    const nodeStatusMap = new Map<
      string,
      "running" | "completed" | "failed" | "pending"
    >();

    testExecution.nodeStates.forEach((state: any) => {
      nodeStatusMap.set(state.nodeId, state.status);
    });

    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const status = nodeStatusMap.get(node.id);
        // Only update if status changed to avoid unnecessary renders?
        // React state updates should be referentially stable if possible.
        // Here we create new object only if executionStatus is different.
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
  }, [testExecution]);

  const handleRunTest = async () => {
    setIsStartingTest(true);
    try {
      // 1. Save first (optional but recommended to sync backend)
      // Assuming handleSave logic is reused or we trust current state is saved?
      // Let's auto-save for safety.
      const routineNodes = convertFromReactFlowNodes(nodes);
      const routineConnections = convertFromReactFlowEdges(edges);
      await onSave(routineNodes, routineConnections);

      // 2. Trigger execution via API
      const response = await fetch(`/api/workflows/${routineId}/execute`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start workflow");
      }

      const data = await response.json();
      setTestWorkflowId(data.workflowId);
      setTestPanelOpen(true);
      toast.success("Test run started");

      // Call prop onTest if provided (for parent callbacks)
      if (onTest) onTest();
    } catch (error: any) {
      toast.error(error.message || "Failed to start test run");
      console.error(error);
    } finally {
      setIsStartingTest(false);
    }
  };
  // Handler for opening node configuration
  const handleConfigureNode = useCallback((nodeId: string) => {
    setConfiguringNodeId(nodeId);
    setConfigDrawerOpen(true);
  }, []);

  // Handler for node click - opens the result drawer if in test mode
  // Otherwise, clicking the node body just selects it (default React Flow behavior)
  // Configuration is now opened exclusively via the gear icon on the node
  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      if (testPanelOpen) {
        setSelectedResultNodeId(node.id);
        setResultDrawerOpen(true);
        setConfigDrawerOpen(false);
      }
    },
    [testPanelOpen],
  );

  // Convert routine nodes to React Flow nodes
  const convertToReactFlowNodes = useCallback(
    (routineNodes: RoutineNode[]): Node[] => {
      return routineNodes.map((node) => ({
        id: node.id,
        type: "pluginNode",
        position: node.position,
        data: {
          label: node.label,
          pluginId: node.pluginId,
          onConfigure: handleConfigureNode,
          config: node.config,
          credentialMappings: node.credentialMappings,
        },
      }));
    },
    [handleConfigureNode],
  );

  // Convert routine connections to React Flow edges
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

  // Convert React Flow nodes back to routine nodes
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

  // Convert React Flow edges back to routine connections
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

  // Initialize nodes and edges only once on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: We intentionally want this to run only once on mount to prevent position flipping
  useEffect(() => {
    if (!isInitializedRef.current) {
      setNodes(convertToReactFlowNodes(initialNodes));
      setEdges(convertToReactFlowEdges(initialConnections));
      isInitializedRef.current = true;
    }
  }, []);

  // Auto-save function with debounce
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    setHasUnsavedChanges(true);

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        // Use refs to get the latest values
        const routineNodes = convertFromReactFlowNodes(nodesRef.current);
        const routineConnections = convertFromReactFlowEdges(edgesRef.current);
        await onSave(routineNodes, routineConnections);
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error("Auto-save failed:", error);
        setHasUnsavedChanges(false);
      }
    }, 1000); // 1 second debounce
  }, [convertFromReactFlowNodes, convertFromReactFlowEdges, onSave]);

  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));

      // Only trigger auto-save for meaningful changes (not just selection or dimension changes)
      const shouldSave = changes.some((change) => {
        if (change.type === "remove") {
          return true;
        }
        // Only save position changes when dragging is done
        if (change.type === "position" && change.dragging === false) {
          return true;
        }
        return false;
      });

      if (shouldSave) {
        triggerAutoSave();
      }
    },
    [triggerAutoSave],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));

      // Only trigger auto-save for meaningful changes
      const shouldSave = changes.some((change) => change.type === "remove");

      if (shouldSave) {
        triggerAutoSave();
      }
    },
    [triggerAutoSave],
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      // Customize edge based on connection
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
      triggerAutoSave();
    },
    [triggerAutoSave],
  );

  const handleSaveNodeConfig = useCallback(
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
      triggerAutoSave();
    },
    [triggerAutoSave],
  );

  const handleAddNode = useCallback(
    (pluginId: string, pluginName: string) => {
      // Calculate better position (spread nodes horizontally)
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
          onConfigure: handleConfigureNode,
        },
      };

      setNodes((nds) => [...nds, newNode]);
      triggerAutoSave();
    },
    [nodes, handleConfigureNode, triggerAutoSave],
  );

  // Sync JSON when switching to JSON mode
  useEffect(() => {
    if (editorMode === "json") {
      const routineNodes = convertFromReactFlowNodes(nodes);
      const routineConnections = convertFromReactFlowEdges(edges);
      setJsonValue(
        JSON.stringify(
          { nodes: routineNodes, connections: routineConnections },
          null,
          2,
        ),
      );
    }
  }, [
    editorMode,
    nodes,
    edges,
    convertFromReactFlowEdges,
    convertFromReactFlowNodes,
  ]);

  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(jsonValue);
      if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
        throw new Error("Invalid JSON: 'nodes' array is required");
      }
      if (!parsed.connections || !Array.isArray(parsed.connections)) {
        throw new Error("Invalid JSON: 'connections' array is required");
      }

      setNodes(convertToReactFlowNodes(parsed.nodes));
      setEdges(convertToReactFlowEdges(parsed.connections));
      setEditorMode("visual");
      toast.success("JSON applied successfully");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid JSON format";
      toast.error(message);
    }
  };

  const configuringNode = nodes.find((n) => n.id === configuringNodeId);

  const selectedResultNode = nodes.find((n) => n.id === selectedResultNodeId);
  let selectedNodeExecutionState = null;
  if (testExecution?.nodeStates && selectedResultNodeId) {
    const states = testExecution.nodeStates.filter(
      (s: any) => s.nodeId === selectedResultNodeId,
    );
    if (states.length > 0) {
      selectedNodeExecutionState = states[states.length - 1];
    }
  }

  const resultDrawerStyle =
    configDrawerOpen && configuringNode ? "right-[350px]" : "";

  return (
    <div className="flex h-full w-full flex-col">
      {/* Top Toolbar */}
      <TopBar
        editorMode={editorMode}
        onEditorModeChange={setEditorMode}
        hasUnsavedChanges={hasUnsavedChanges}
        isStartingTest={isStartingTest}
        onRunTest={handleRunTest}
        onApplyJson={editorMode === "json" ? handleApplyJson : undefined}
      />

      {/* Canvas / Editor Area */}
      <div className="relative flex-1">
        {editorMode === "visual" ? (
          <>
            {/* Floating Toolbar */}
            <Toolbar
              activeTool={activeTool}
              onToolChange={setActiveTool}
              onAddNode={() => setNodeSelectorOpen(true)}
            />

            {/* Node Selector */}
            <NodeSelector
              isOpen={nodeSelectorOpen}
              onClose={() => setNodeSelectorOpen(false)}
              onAddNode={handleAddNode}
            />

            <ReactFlow
              colorMode={theme === "dark" ? "dark" : "light"}
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView={false}
              className="bg-background"
              deleteKeyCode={["Delete", "Backspace"]}
              panOnDrag={activeTool === "hand" ? true : [1, 2]}
              selectionOnDrag={activeTool === "select"}
              panOnScroll={activeTool === "hand"}
              selectionKeyCode={null}
              multiSelectionKeyCode="Shift"
              connectionLineStyle={{
                stroke: "#6366f1",
                strokeWidth: 2,
                strokeDasharray: "5 5",
              }}
            >
              <Background variant={BackgroundVariant.Dots} gap={30} size={1} />
              <Controls
                position="bottom-left"
                showZoom={true}
                showFitView={true}
                showInteractive={false}
                style={{ left: 16, bottom: 16 }}
              />
              <MiniMap
                nodeColor="#64748b"
                nodeStrokeColor="#94a3b8"
                nodeBorderRadius={2}
                maskColor="rgba(100, 116, 139, 0.2)"
                position="bottom-right"
                style={{ right: 16, bottom: 16 }}
              />
            </ReactFlow>

            {/* Node Configuration Drawer (Always right-aligned) */}
            {configuringNode && (
              <NodeConfigDrawer
                key={configuringNode.id}
                isOpen={configDrawerOpen}
                onClose={() => {
                  setConfigDrawerOpen(false);
                  setConfiguringNodeId(null);
                }}
                nodeId={configuringNode.id}
                pluginId={(configuringNode.data as PluginNodeData).pluginId}
                pluginName={
                  getPluginMetadata(
                    (configuringNode.data as PluginNodeData).pluginId,
                  )?.name || "Plugin"
                }
                nodeLabel={(configuringNode.data as PluginNodeData).label}
                config={
                  (
                    configuringNode.data as PluginNodeData & {
                      config?: Record<string, unknown>;
                    }
                  ).config
                }
                credentialMappings={
                  (configuringNode.data as PluginNodeData).credentialMappings
                }
                onSave={handleSaveNodeConfig}
              />
            )}

            {/* Test Result Drawer (Shifts left if config is open) */}
            {selectedResultNode && (
              <TestResultDrawer
                isOpen={resultDrawerOpen}
                onClose={() => {
                  setResultDrawerOpen(false);
                  setSelectedResultNodeId(null);
                }}
                nodeId={selectedResultNode.id}
                nodeLabel={(selectedResultNode.data as PluginNodeData).label}
                executionState={selectedNodeExecutionState}
                className={resultDrawerStyle}
              />
            )}
          </>
        ) : (
          <div className="h-full p-4">
            <Textarea
              value={jsonValue}
              onChange={(e) => setJsonValue(e.target.value)}
              className="h-full font-mono text-sm"
              placeholder="Edit workflow JSON here..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
