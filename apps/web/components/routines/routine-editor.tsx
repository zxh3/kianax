"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
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
import PluginNode, { type PluginNodeData } from "./plugin-node";
import { NodeConfigDrawer } from "./node-config-drawer";
import { TestRunPanel } from "./test-run-panel";
import { Button } from "@kianax/ui/components/button";
import { Tabs, TabsList, TabsTrigger } from "@kianax/ui/components/tabs";
import { Textarea } from "@kianax/ui/components/textarea";
import {
  IconPlus,
  IconTrash,
  IconDeviceFloppy,
  IconPlayerPlay,
  IconCode,
  IconEye,
} from "@tabler/icons-react";
import { toast } from "sonner";
import type { Id } from "@kianax/server/convex/_generated/dataModel";
import { getAllPlugins, categorizePlugin } from "@/lib/plugins";

// Convert our routine node format to React Flow node format
interface RoutineNode {
  id: string;
  pluginId: string;
  label: string;
  position: { x: number; y: number };
  config?: Record<string, unknown>;
  enabled: boolean;
}

interface RoutineConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
  condition?: {
    type: "branch" | "default" | "loop";
    value?: string;
    loopConfig?: {
      maxIterations: number;
      accumulatorFields?: string[];
    };
  };
}

interface RoutineEditorProps {
  routineId: Id<"routines">;
  initialNodes: RoutineNode[];
  initialConnections: RoutineConnection[];
  onSave: (
    nodes: RoutineNode[],
    connections: RoutineConnection[],
  ) => Promise<void>;
  onTest?: () => void;
}

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
  // State definitions
  const [isSaving, setIsSaving] = useState(false);
  const [showPluginSelector, setShowPluginSelector] = useState(false);
  const [editorMode, setEditorMode] = useState<"visual" | "json">("visual");
  const [jsonValue, setJsonValue] = useState("");
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
  const [configuringNodeId, setConfiguringNodeId] = useState<string | null>(
    null,
  );

  // Test Execution State
  const [testWorkflowId, setTestWorkflowId] = useState<string | null>(null);
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [isStartingTest, setIsStartingTest] = useState(false);

  // Fetch execution status if a test is running/open
  const testExecution = useQuery(
    api.executions.getByWorkflowId,
    testWorkflowId ? { workflowId: testWorkflowId } : "skip",
  );

  // Nodes and Edges state (initialized empty, populated via useEffect to allow for callbacks)
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

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

  // Handler for node click - opens the configuration drawer
  const onNodeClick = useCallback((_: unknown, node: Node) => {
    setConfiguringNodeId(node.id);
    setConfigDrawerOpen(true);
  }, []);

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
          enabled: node.enabled,
          onConfigure: handleConfigureNode,
          config: node.config,
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
            conn.condition?.value === "true" || conn.sourceHandle === "true"
              ? "#10b981"
              : conn.condition?.value === "false" ||
                  conn.sourceHandle === "false"
                ? "#ef4444"
                : conn.sourceHandle === "success"
                  ? "#10b981"
                  : conn.sourceHandle === "error"
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
          enabled: data.enabled,
        };
      });
    },
    [],
  );

  // Convert React Flow edges back to routine connections
  const convertFromReactFlowEdges = useCallback(
    (reactFlowEdges: Edge[]): RoutineConnection[] => {
      return reactFlowEdges.map((edge) => {
        const conn: RoutineConnection = {
          id: edge.id,
          sourceNodeId: edge.source,
          targetNodeId: edge.target,
          sourceHandle: edge.sourceHandle || undefined,
          targetHandle: edge.targetHandle || undefined,
        };

        // Add condition if it's a conditional edge (from logic nodes)
        if (edge.sourceHandle === "true" || edge.sourceHandle === "false") {
          conn.condition = {
            type: "branch",
            value: edge.sourceHandle,
          };
        }

        return conn;
      });
    },
    [],
  );

  // Initialize nodes and edges
  useEffect(() => {
    setNodes(convertToReactFlowNodes(initialNodes));
    setEdges(convertToReactFlowEdges(initialConnections));
  }, [
    initialNodes,
    initialConnections,
    convertToReactFlowNodes,
    convertToReactFlowEdges,
  ]);

  // Get all available plugins
  const availablePlugins = useMemo(() => getAllPlugins(), []);

  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  const onConnect: OnConnect = useCallback((connection: Connection) => {
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
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const routineNodes = convertFromReactFlowNodes(nodes);
      const routineConnections = convertFromReactFlowEdges(edges);
      await onSave(routineNodes, routineConnections);
      toast.success("Workflow saved successfully");
    } catch (error) {
      toast.error("Failed to save workflow");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSelected = useCallback(() => {
    setNodes((nds) => nds.filter((node) => !node.selected));
    setEdges((eds) => eds.filter((edge) => !edge.selected));
  }, []);

  const handleSaveNodeConfig = useCallback(
    (nodeId: string, config: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, config } }
            : node,
        ),
      );
    },
    [],
  );

  const handleAddNode = (pluginId: string, pluginName: string) => {
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
        enabled: true,
        onConfigure: handleConfigureNode,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setShowPluginSelector(false);
  };

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

  // Group plugins by category
  const pluginsByCategory = useMemo(() => {
    const grouped = {
      input: [] as typeof availablePlugins,
      processor: [] as typeof availablePlugins,
      logic: [] as typeof availablePlugins,
      action: [] as typeof availablePlugins,
    };

    availablePlugins.forEach((plugin) => {
      const category = categorizePlugin(plugin);
      grouped[category].push(plugin);
    });

    return grouped;
  }, [availablePlugins]);

  return (
    <div className="flex h-full w-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b bg-background p-3">
        <Tabs
          value={editorMode}
          onValueChange={(v) => setEditorMode(v as "visual" | "json")}
          className="flex-1"
        >
          <TabsList>
            <TabsTrigger value="visual">
              <IconEye className="mr-2 size-4" />
              Visual Editor
            </TabsTrigger>
            <TabsTrigger value="json">
              <IconCode className="mr-2 size-4" />
              JSON Editor
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-2">
          {editorMode === "visual" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowPluginSelector(!showPluginSelector)}
              >
                <IconPlus className="mr-2 size-4" />
                Add Node
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDeleteSelected}
                title="Delete selected nodes/edges (or press Delete key)"
              >
                <IconTrash className="mr-2 size-4" />
                Delete
              </Button>
            </>
          )}
          {editorMode === "json" && (
            <Button size="sm" variant="outline" onClick={handleApplyJson}>
              <IconEye className="mr-2 size-4" />
              Apply & View
            </Button>
          )}
          <div className="w-px bg-border" />
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <IconDeviceFloppy className="mr-2 size-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRunTest}
            disabled={isStartingTest}
          >
            <IconPlayerPlay className="mr-2 size-4" />
            {isStartingTest ? "Starting..." : "Test"}
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="relative flex-1">
        {editorMode === "visual" ? (
          <>
            {/* Plugin Selector */}
            {showPluginSelector && (
              <div className="absolute left-4 top-4 z-10 w-80 rounded-lg border bg-background p-4 shadow-xl max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Add Plugin Node</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPluginSelector(false)}
                  >
                    ✕
                  </Button>
                </div>

                {/* Inputs */}
                {pluginsByCategory.input.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs font-semibold text-blue-600 mb-2">
                      DATA SOURCES
                    </div>
                    <div className="space-y-1.5">
                      {pluginsByCategory.input.map((plugin) => (
                        <Button
                          key={plugin.id}
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => handleAddNode(plugin.id, plugin.name)}
                        >
                          <span className="mr-2">{plugin.icon}</span>
                          {plugin.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Processors */}
                {pluginsByCategory.processor.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs font-semibold text-purple-600 mb-2">
                      PROCESSORS
                    </div>
                    <div className="space-y-1.5">
                      {pluginsByCategory.processor.map((plugin) => (
                        <Button
                          key={plugin.id}
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => handleAddNode(plugin.id, plugin.name)}
                        >
                          <span className="mr-2">{plugin.icon}</span>
                          {plugin.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Logic */}
                {pluginsByCategory.logic.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs font-semibold text-yellow-600 mb-2">
                      LOGIC
                    </div>
                    <div className="space-y-1.5">
                      {pluginsByCategory.logic.map((plugin) => (
                        <Button
                          key={plugin.id}
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => handleAddNode(plugin.id, plugin.name)}
                        >
                          <span className="mr-2">{plugin.icon}</span>
                          {plugin.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {pluginsByCategory.action.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs font-semibold text-green-600 mb-2">
                      ACTIONS
                    </div>
                    <div className="space-y-1.5">
                      {pluginsByCategory.action.map((plugin) => (
                        <Button
                          key={plugin.id}
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => handleAddNode(plugin.id, plugin.name)}
                        >
                          <span className="mr-2">{plugin.icon}</span>
                          {plugin.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* React Flow Canvas */}
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              className="bg-gray-50/50"
              deleteKeyCode={["Delete", "Backspace"]}
              connectionLineStyle={{
                stroke: "#6366f1",
                strokeWidth: 2,
                strokeDasharray: "5 5",
              }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1}
                color="#cbd5e1"
              />
              <Controls className="!bg-white !border !border-gray-100 !shadow-md !rounded-lg !m-4" />
              <MiniMap
                nodeColor="#94a3b8"
                className="!bg-white !border !border-gray-100 !shadow-lg !rounded-lg !m-4"
                maskColor="rgba(248, 250, 252, 0.6)"
              />
            </ReactFlow>

            {/* Node Configuration Drawer */}
            {configuringNode && (
              <NodeConfigDrawer
                isOpen={configDrawerOpen}
                onClose={() => {
                  setConfigDrawerOpen(false);
                  setConfiguringNodeId(null);
                }}
                nodeId={configuringNode.id}
                pluginId={(configuringNode.data as PluginNodeData).pluginId}
                pluginName={(configuringNode.data as PluginNodeData).label}
                config={
                  (
                    configuringNode.data as PluginNodeData & {
                      config?: Record<string, unknown>;
                    }
                  ).config
                }
                onSave={handleSaveNodeConfig}
              />
            )}

            {/* Test Run Panel */}
            <TestRunPanel
              workflowId={testWorkflowId}
              isOpen={testPanelOpen}
              onClose={() => setTestPanelOpen(false)}
            />
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
