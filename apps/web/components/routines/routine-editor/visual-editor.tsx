"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
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
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@kianax/ui/components/resizable";
import { useTheme } from "next-themes";
import PluginNode, { type PluginNodeData } from "../plugin-node";
import { Toolbar } from "./toolbar";
import { NodeSelector } from "./sidebar";
import { VariablesPanel, type RoutineVariable } from "./variables-panel";
import { ValidationPanel } from "./validation-panel";
import { ExecutionHistoryDrawer } from "../execution-history-drawer";
import { getPluginMetadata } from "@/lib/plugins";
import type { ExpressionValidationError } from "@kianax/execution-engine";
import type { Id } from "@kianax/server/convex/_generated/dataModel";
import { NodeInspector } from "./node-inspector";

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
  activeExecution: any;
  viewingExecutionId: string | null;
  setViewingExecutionId: (id: string | null) => void;
  historyDrawerOpen: boolean;
  setHistoryDrawerOpen: (open: boolean) => void;

  // Config & Result State
  configuringNodeId: string | null;
  setConfiguringNodeId: (id: string | null) => void;
  configDrawerOpen: boolean;
  setConfigDrawerOpen: (open: boolean) => void;
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

  // Inspector logic
  // Determine which node is currently inspected and which mode (config vs result)
  const inspectedNodeId = configuringNodeId || selectedResultNodeId;
  const isInspectorOpen =
    (!!configuringNodeId && configDrawerOpen) ||
    (!!selectedResultNodeId && resultDrawerOpen);
  const inspectorTab = configuringNodeId ? "config" : "result";

  const inspectedNode = useMemo(
    () => nodes.find((n) => n.id === inspectedNodeId),
    [nodes, inspectedNodeId],
  );

  const handleCloseInspector = useCallback(() => {
    setConfigDrawerOpen(false);
    setConfiguringNodeId(null);
    setResultDrawerOpen(false);
    setSelectedResultNodeId(null);
  }, [
    setConfigDrawerOpen,
    setConfiguringNodeId,
    setResultDrawerOpen,
    setSelectedResultNodeId,
  ]);

  // Reset validation panel dismissed state when errors change
  useEffect(() => {
    if (validationErrors.length > 0) {
      setValidationPanelDismissed(false);
    }
  }, [validationErrors]);

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

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full">
      <ResizablePanel defaultSize={75} minSize={30}>
        <div className="relative w-full h-full">
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

          {/* Execution History Drawer (Still modal/overlay for now?) 
                User asked for redesign of node config/results. History might stay as drawer for now unless unified later.
                It's a drawer over the whole screen usually or side sheet.
            */}
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
        </div>
      </ResizablePanel>

      {/* Inspector Panel */}
      {isInspectorOpen && inspectedNode && (
        <>
          <ResizableHandle />
          <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
            <NodeInspector
              key={inspectedNode.id} // Force re-mount when switching nodes to reset internal state if needed
              nodeId={inspectedNode.id}
              pluginId={(inspectedNode.data as PluginNodeData).pluginId}
              pluginName={
                getPluginMetadata(
                  (inspectedNode.data as PluginNodeData).pluginId,
                )?.name || "Plugin"
              }
              nodeLabel={(inspectedNode.data as PluginNodeData).label}
              config={
                (
                  inspectedNode.data as PluginNodeData & {
                    config?: Record<string, unknown>;
                  }
                ).config
              }
              credentialMappings={
                (inspectedNode.data as PluginNodeData).credentialMappings
              }
              onSave={handleSaveNodeConfig}
              onClose={handleCloseInspector}
              testExecution={activeExecution}
              defaultTab={inspectorTab}
            />
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}
