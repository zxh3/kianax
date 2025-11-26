import type { Id } from "@kianax/server/convex/_generated/dataModel";

export interface RoutineNode {
  id: string;
  pluginId: string;
  label: string;
  position: { x: number; y: number };
  config?: Record<string, unknown>;
}

export interface RoutineConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface RoutineEditorProps {
  routineId: Id<"routines">;
  initialNodes: RoutineNode[];
  initialConnections: RoutineConnection[];
  onSave: (
    nodes: RoutineNode[],
    connections: RoutineConnection[],
  ) => Promise<void>;
  onTest?: () => void;
}

export type EditorMode = "visual" | "json";

export type ToolbarSection = "nodes" | "tools" | "start";
