"use client";

import { useCallback, useState, useEffect } from "react";
import type { Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import { CanvasControls } from "./canvas-controls";
import type { RoutineEditorProps, EditorMode } from "./types";
import { ExpressionContextProvider } from "./expression-context";
import { useAutoSave } from "./hooks/use-auto-save";
import { useRoutineGraph } from "./hooks/use-routine-graph";
import { useRoutineExecution } from "./hooks/use-routine-execution";
import { JsonEditor } from "./json-editor";
import { VisualEditor } from "./visual-editor";
import type { RoutineVariable } from "./variables-panel";

export function RoutineEditor({
  routineId,
  initialNodes,
  initialConnections,
  initialVariables = [],
  validationErrors = [],
  onSave,
  onTest,
}: RoutineEditorProps) {
  const [editorMode, setEditorMode] = useState<EditorMode>("visual");
  const [jsonValue, setJsonValue] = useState("");

  // Drawer State controlled here because they are needed for orchestrating other logic
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
  const [configuringNodeId, setConfiguringNodeId] = useState<string | null>(
    null,
  );
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
    updateEdgeExecutionStatus,
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
    validationErrors,
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
    updateEdgeExecutionStatus(nodeStatusMap);
  }, [nodeStatusMap, updateNodeExecutionStatus, updateEdgeExecutionStatus]);

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
      if (viewingExecutionId) {
        setSelectedResultNodeId(node.id);
        setResultDrawerOpen(true);
        setConfigDrawerOpen(false);
      } else {
        setConfiguringNodeId(node.id);
        setConfigDrawerOpen(true);
        setResultDrawerOpen(false);
      }
    },
    [viewingExecutionId, setSelectedResultNodeId, setResultDrawerOpen],
  );

  return (
    <ExpressionContextProvider
      nodes={nodes}
      edges={edges}
      variables={variables}
    >
      <div className="relative h-full w-full">
        {editorMode === "visual" ? (
          <VisualEditor
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            addNode={addNode}
            updateNodeConfig={updateNodeConfig}
            triggerAutoSave={triggerAutoSave}
            variables={variables}
            onVariablesChange={handleVariablesChange}
            validationErrors={validationErrors}
            onValidationNodeClick={handleValidationNodeClick}
            routineId={routineId}
            activeExecution={activeExecution}
            viewingExecutionId={viewingExecutionId}
            setViewingExecutionId={setViewingExecutionId}
            historyDrawerOpen={historyDrawerOpen}
            setHistoryDrawerOpen={setHistoryDrawerOpen}
            configuringNodeId={configuringNodeId}
            setConfiguringNodeId={setConfiguringNodeId}
            configDrawerOpen={configDrawerOpen}
            setConfigDrawerOpen={setConfigDrawerOpen}
            selectedResultNodeId={selectedResultNodeId}
            setSelectedResultNodeId={setSelectedResultNodeId}
            resultDrawerOpen={resultDrawerOpen}
            setResultDrawerOpen={setResultDrawerOpen}
            editorMode={editorMode}
            onEditorModeChange={setEditorMode}
            hasUnsavedChanges={hasUnsavedChanges}
            isStartingTest={isStartingTest}
            onRunTest={handleRunTest}
            onApplyJson={undefined}
            onExitViewingMode={() => {
              setViewingExecutionId(null);
              setTestPanelOpen(false);
              setResultDrawerOpen(false);
            }}
          />
        ) : (
          <JsonEditor value={jsonValue} onChange={setJsonValue}>
            <CanvasControls
              editorMode={editorMode}
              onEditorModeChange={setEditorMode}
              hasUnsavedChanges={hasUnsavedChanges}
              isStartingTest={isStartingTest}
              onRunTest={handleRunTest}
              onApplyJson={handleApplyJson}
              onToggleHistory={() => setHistoryDrawerOpen(true)}
              viewingExecutionId={viewingExecutionId}
              onExitViewingMode={() => {
                setViewingExecutionId(null);
                setTestPanelOpen(false);
                setResultDrawerOpen(false);
              }}
            />
          </JsonEditor>
        )}
      </div>
    </ExpressionContextProvider>
  );
}
