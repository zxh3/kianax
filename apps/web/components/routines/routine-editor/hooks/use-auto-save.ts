import { useState, useEffect, useRef, useCallback } from "react";
import type { Node, Edge } from "@xyflow/react";
import type { RoutineVariable } from "../variables-panel";
import type { RoutineNode, RoutineConnection } from "../types";

interface UseAutoSaveProps {
  nodes: Node[];
  edges: Edge[];
  variables: RoutineVariable[];
  onSave: (
    nodes: RoutineNode[],
    connections: RoutineConnection[],
    variables: RoutineVariable[],
  ) => Promise<void>;
  convertFromReactFlowNodes: (nodes: Node[]) => RoutineNode[];
  convertFromReactFlowEdges: (edges: Edge[]) => RoutineConnection[];
  debounceMs?: number;
}

export function useAutoSave({
  nodes,
  edges,
  variables,
  onSave,
  convertFromReactFlowNodes,
  convertFromReactFlowEdges,
  debounceMs = 1000,
}: UseAutoSaveProps) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Refs to track latest nodes, edges, and variables for auto-save
  // This avoids stale closures in the setTimeout callback
  const nodesRef = useRef<Node[]>(nodes);
  const edgesRef = useRef<Edge[]>(edges);
  const variablesRef = useRef<RoutineVariable[]>(variables);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    variablesRef.current = variables;
  }, [variables]);

  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    setHasUnsavedChanges(true);

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const routineNodes = convertFromReactFlowNodes(nodesRef.current);
        const routineConnections = convertFromReactFlowEdges(edgesRef.current);
        await onSave(routineNodes, routineConnections, variablesRef.current);
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error("Auto-save failed:", error);
        setHasUnsavedChanges(false);
      }
    }, debounceMs);
  }, [
    convertFromReactFlowNodes,
    convertFromReactFlowEdges,
    onSave,
    debounceMs,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  return {
    hasUnsavedChanges,
    triggerAutoSave,
  };
}
