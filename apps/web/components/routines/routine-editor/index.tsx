"use client";

import { useCallback, useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import PluginNode, { type PluginNodeData } from "../plugin-node";
import { NodeConfigDrawer } from "../node-config-drawer";
import { TestResultDrawer } from "../test-result-drawer";
import { Textarea } from "@kianax/ui/components/textarea";
import { toast } from "sonner";
import { Toolbar } from "./toolbar";
import { NodeSelector } from "./sidebar";
import { VariablesPanel, type RoutineVariable } from "./variables-panel";
import { ValidationPanel } from "./validation-panel";
import { CanvasControls } from "./canvas-controls";
import { useTheme } from "next-themes";
import { getPluginMetadata } from "@/lib/plugins";
import type { RoutineEditorProps, EditorMode } from "./types";
import { ExpressionContextProvider } from "./expression-context";
import { useAutoSave } from "./hooks/use-auto-save";
import { useRoutineGraph } from "./hooks/use-routine-graph";
import { useRoutineExecution } from "./hooks/use-routine-execution";
import { ExecutionHistoryDrawer } from "../execution-history-drawer";

const nodeTypes = {
  pluginNode: PluginNode,
} as const;

export function RoutineEditor({
  routineId,
  initialNodes,
  initialConnections,
  initialVariables = [],
  validationErrors = [],
  onSave,
  onTest,
}: RoutineEditorProps) {
  const { theme } = useTheme();

  const [nodeSelectorOpen, setNodeSelectorOpen] = useState(false);
  const [variablesPanelOpen, setVariablesPanelOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<"select" | "hand" | null>(
    "hand",
  );
  const [editorMode, setEditorMode] = useState<EditorMode>("visual");
  const [jsonValue, setJsonValue] = useState("");
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
  const [configuringNodeId, setConfiguringNodeId] = useState<string | null>(
    null,
  );
  const [validationPanelDismissed, setValidationPanelDismissed] =
    useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);

  // Variables state
  const [variables, setVariables] =
    useState<RoutineVariable[]>(initialVariables);

  // --- Hooks ---

  const handleConfigureNode = useCallback((nodeId: string) => {
    setConfiguringNodeId(nodeId);
    setConfigDrawerOpen(true);
  }, []);

  const {
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
    convertFromReactFlowNodes,
    convertFromReactFlowEdges,
    convertToReactFlowNodes,
    convertToReactFlowEdges,
  } = useRoutineGraph({
    initialNodes,
    initialConnections,
    onConfigureNode: handleConfigureNode,
  });

  const {
    setTestPanelOpen,
    isStartingTest,
    resultDrawerOpen,
    setResultDrawerOpen,
    selectedResultNodeId,
    setSelectedResultNodeId,
    handleRunTest,
    activeExecution,
    nodeStatusMap,
    viewingExecutionId,
    setViewingExecutionId,
  } = useRoutineExecution({
    routineId,
    getRoutineData,
    variables,
    onSave,
    onTest,
  });

  const { hasUnsavedChanges, triggerAutoSave } = useAutoSave({
    nodes,
    edges,
    variables,
    onSave,
    convertFromReactFlowNodes,
    convertFromReactFlowEdges,
  });

  // --- Effects ---

  // Sync node status from execution
  useEffect(() => {
    updateNodeExecutionStatus(nodeStatusMap);
  }, [nodeStatusMap, updateNodeExecutionStatus]);

  // Reset validation panel dismissed state when errors change
  useEffect(() => {
    if (validationErrors.length > 0) {
      setValidationPanelDismissed(false);
    }
  }, [validationErrors]);

  // Sync JSON when switching to JSON mode
  useEffect(() => {
    if (editorMode === "json") {
      const { nodes: rNodes, connections: rConns } = getRoutineData();
      setJsonValue(
        JSON.stringify({ nodes: rNodes, connections: rConns }, null, 2),
      );
    }
  }, [editorMode, getRoutineData]);

  // --- Handlers ---

  const handleVariablesChange = useCallback(
    (newVariables: RoutineVariable[]) => {
      setVariables(newVariables);
      triggerAutoSave();
    },
    [triggerAutoSave],
  );

  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(jsonValue);
      if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
        throw new Error("Invalid JSON: 'nodes' array is required");
      }
      if (!parsed.connections || !Array.isArray(parsed.connections)) {
        throw new Error("Invalid JSON: 'connections' array is required");
      }

      // We manually update nodes/edges via setters from hook
      // Note: We need to convert them first using the converters from hook
      setNodes(convertToReactFlowNodes(parsed.nodes));
      setEdges(convertToReactFlowEdges(parsed.connections));
      setEditorMode("visual");
      toast.success("JSON applied successfully");
      triggerAutoSave();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Invalid JSON format";
      toast.error(message);
    }
  };

  const handleValidationNodeClick = useCallback(
    (nodeId: string) => {
      setNodesSelection(nodeId);
      setConfiguringNodeId(nodeId);
      setConfigDrawerOpen(true);
    },
    [setNodesSelection],
  );

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      // If we are viewing an execution (test ran or selected from history)
      if (viewingExecutionId) {
        setSelectedResultNodeId(node.id);
        setResultDrawerOpen(true);
        setConfigDrawerOpen(false);
      }
    },
    [viewingExecutionId, setSelectedResultNodeId, setResultDrawerOpen],
  );

  const handleSaveNodeConfig = useCallback(
    (
      nodeId: string,
      config: Record<string, unknown>,
      label: string,
      credentialMappings?: Record<string, string>,
    ) => {
      updateNodeConfig(nodeId, config, label, credentialMappings);
      triggerAutoSave();
    },
    [updateNodeConfig, triggerAutoSave],
  );

  const configuringNode = nodes.find((n) => n.id === configuringNodeId);
  const selectedResultNode = nodes.find((n) => n.id === selectedResultNodeId);

  let selectedNodeExecutionState = null;
  if (activeExecution?.nodeStates && selectedResultNodeId) {
    const states = activeExecution.nodeStates.filter(
      (s: any) => s.nodeId === selectedResultNodeId,
    );
    if (states.length > 0) {
      selectedNodeExecutionState = states[states.length - 1];
    }
  }

  const resultDrawerStyle =
    configDrawerOpen && configuringNode ? "right-[350px]" : "";

  return (
    <ExpressionContextProvider
      nodes={nodes}
      edges={edges}
      variables={variables}
    >
      <div className="relative h-full w-full">
        {/* Canvas Controls (Floating) */}
        <CanvasControls
          editorMode={editorMode}
          onEditorModeChange={setEditorMode}
          hasUnsavedChanges={hasUnsavedChanges}
          isStartingTest={isStartingTest}
          onRunTest={handleRunTest}
          onApplyJson={editorMode === "json" ? handleApplyJson : undefined}
          onToggleHistory={() => setHistoryDrawerOpen(true)}
          viewingExecutionId={viewingExecutionId}
          onExitViewingMode={() => {
            setViewingExecutionId(null);
            setTestPanelOpen(false);
            setResultDrawerOpen(false);
          }}
        />

        {editorMode === "visual" ? (
          <>
            {/* Floating Toolbar */}
            <Toolbar
              activeTool={activeTool}
              onToolChange={setActiveTool}
              onAddNode={() => setNodeSelectorOpen(true)}
              onToggleVariables={() => setVariablesPanelOpen((prev) => !prev)}
              variablesPanelOpen={variablesPanelOpen}
            />

            {/* Node Selector */}
            <NodeSelector
              isOpen={nodeSelectorOpen}
              onClose={() => setNodeSelectorOpen(false)}
              onAddNode={(pluginId, name) => {
                addNode(pluginId, name);
                triggerAutoSave();
              }}
            />

            {/* Variables Panel */}
            <VariablesPanel
              isOpen={variablesPanelOpen}
              onClose={() => setVariablesPanelOpen(false)}
              variables={variables}
              onVariablesChange={handleVariablesChange}
            />

            {/* Validation Panel */}
            {!validationPanelDismissed && (
              <ValidationPanel
                errors={validationErrors}
                onClose={() => setValidationPanelDismissed(true)}
                onNodeClick={handleValidationNodeClick}
              />
            )}

            <ReactFlow
              colorMode={theme === "dark" ? "dark" : "light"}
              nodes={nodes}
              edges={edges}
              onNodesChange={(changes) => {
                onNodesChange(changes);
                // Trigger auto-save for meaningful changes (remove, or position drag end)
                const shouldSave = changes.some((change) => {
                  if (change.type === "remove") return true;
                  if (change.type === "position" && change.dragging === false)
                    return true;
                  return false;
                });
                if (shouldSave) triggerAutoSave();
              }}
              onEdgesChange={(changes) => {
                onEdgesChange(changes);
                // Trigger auto-save for meaningful changes (remove)
                const shouldSave = changes.some(
                  (change) => change.type === "remove",
                );
                if (shouldSave) triggerAutoSave();
              }}
              onConnect={(conn) => {
                onConnect(conn);
                triggerAutoSave();
              }}
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

            {/* Node Configuration Drawer */}
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
                testExecution={activeExecution}
              />
            )}

            {/* Test Result Drawer */}
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

            {/* Execution History Drawer */}
            <ExecutionHistoryDrawer
              open={historyDrawerOpen}
              onOpenChange={setHistoryDrawerOpen}
              routineId={routineId}
              routineName="Routine History"
              onSelectExecution={(execId) => {
                setViewingExecutionId(execId);
              }}
              activeExecutionId={viewingExecutionId}
            />
          </>
        ) : (
          <div className="h-full p-4 pt-16">
            {" "}
            {/* Add padding top for controls */}
            <Textarea
              value={jsonValue}
              onChange={(e) => setJsonValue(e.target.value)}
              className="h-full font-mono text-sm"
              placeholder="Edit workflow JSON here..."
            />
          </div>
        )}
      </div>
    </ExpressionContextProvider>
  );
}
