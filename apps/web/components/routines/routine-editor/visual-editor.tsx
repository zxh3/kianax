"use client";

import { useState, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from "@xyflow/react";
import { useTheme } from "next-themes";
import PluginNode, { type PluginNodeData } from "../plugin-node";
import { NodeConfigDrawer } from "../node-config-drawer";
import { TestResultDrawer } from "../test-result-drawer";
import { Toolbar } from "./toolbar";
import { NodeSelector } from "./sidebar";
import { VariablesPanel, type RoutineVariable } from "./variables-panel";
import { ValidationPanel } from "./validation-panel";
import { ExecutionHistoryDrawer } from "../execution-history-drawer";
import { getPluginMetadata } from "@/lib/plugins";
import type { ExpressionValidationError } from "@kianax/execution-engine";
import type { Id } from "@kianax/server/convex/_generated/dataModel";

const nodeTypes = {
  pluginNode: PluginNode,
} as const;

interface VisualEditorProps {
  // Graph props
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;

  // Actions
  addNode: (pluginId: string, name: string) => void;
  updateNodeConfig: (
    nodeId: string,
    config: Record<string, unknown>,
    label: string,
    credentialMappings?: Record<string, string>,
  ) => void;
  triggerAutoSave: () => void;

  // Variables
  variables: RoutineVariable[];
  onVariablesChange: (variables: RoutineVariable[]) => void;

  // Validation
  validationErrors: ExpressionValidationError[];
  onValidationNodeClick: (nodeId: string) => void;

  // Execution & History
  routineId: Id<"routines">;
  activeExecution: any; // Type inferred from usage in drawers
  viewingExecutionId: string | null;
  setViewingExecutionId: (id: string | null) => void;
  historyDrawerOpen: boolean;
  setHistoryDrawerOpen: (open: boolean) => void;

  // Config Drawer State (Controlled by parent for useRoutineGraph integration)
  configuringNodeId: string | null;
  setConfiguringNodeId: (id: string | null) => void;
  configDrawerOpen: boolean;
  setConfigDrawerOpen: (open: boolean) => void;

  // Result Drawer State
  selectedResultNodeId: string | null;
  setSelectedResultNodeId: (id: string | null) => void;
  resultDrawerOpen: boolean;
  setResultDrawerOpen: (open: boolean) => void;
}

export function VisualEditor({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  addNode,
  updateNodeConfig,
  triggerAutoSave,
  variables,
  onVariablesChange,
  validationErrors,
  onValidationNodeClick,
  routineId,
  activeExecution,
  viewingExecutionId,
  setViewingExecutionId,
  historyDrawerOpen,
  setHistoryDrawerOpen,
  configuringNodeId,
  setConfiguringNodeId,
  configDrawerOpen,
  setConfigDrawerOpen,
  selectedResultNodeId,
  setSelectedResultNodeId,
  resultDrawerOpen,
  setResultDrawerOpen,
}: VisualEditorProps) {
  const { theme } = useTheme();

  // Local UI State
  const [nodeSelectorOpen, setNodeSelectorOpen] = useState(false);
  const [variablesPanelOpen, setVariablesPanelOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<"select" | "hand" | null>(
    "hand",
  );
  const [validationPanelDismissed, setValidationPanelDismissed] =
    useState(false);

  // Reset validation panel dismissed state when errors change
  // Note: This useEffect mimics the one in original index.tsx
  // We can rely on parent passing errors, but we manage dismissed state locally
  if (validationErrors.length > 0 && validationPanelDismissed) {
    setValidationPanelDismissed(false);
  }

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

  const configuringNode = useMemo(
    () => nodes.find((n) => n.id === configuringNodeId),
    [nodes, configuringNodeId],
  );
  const selectedResultNode = useMemo(
    () => nodes.find((n) => n.id === selectedResultNodeId),
    [nodes, selectedResultNodeId],
  );

  const selectedNodeExecutionState = useMemo(() => {
    if (activeExecution?.nodeStates && selectedResultNodeId) {
      const states = activeExecution.nodeStates.filter(
        (s: any) => s.nodeId === selectedResultNodeId,
      );
      if (states.length > 0) {
        return states[states.length - 1];
      }
    }
    return null;
  }, [activeExecution, selectedResultNodeId]);

  const resultDrawerStyle =
    configDrawerOpen && configuringNode ? "right-[350px]" : "";

  return (
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
        onVariablesChange={onVariablesChange}
      />

      {/* Validation Panel */}
      {!validationPanelDismissed && validationErrors.length > 0 && (
        <ValidationPanel
          errors={validationErrors}
          onClose={() => setValidationPanelDismissed(true)}
          onNodeClick={onValidationNodeClick}
        />
      )}

      <ReactFlow
        colorMode={theme === "dark" ? "dark" : "light"}
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => {
          onNodesChange(changes);
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
          const shouldSave = changes.some((change) => change.type === "remove");
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
            getPluginMetadata((configuringNode.data as PluginNodeData).pluginId)
              ?.name || "Plugin"
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
  );
}
