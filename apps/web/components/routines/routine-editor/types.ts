import type { Id } from "@kianax/server/convex/_generated/dataModel";
import type { Connection } from "@kianax/shared/temporal";

export interface RoutineNode {
  id: string;
  pluginId: string;
  label: string;
  position: { x: number; y: number };
  config?: Record<string, unknown>;
  enabled: boolean;
}

export type RoutineConnection = Connection;

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
