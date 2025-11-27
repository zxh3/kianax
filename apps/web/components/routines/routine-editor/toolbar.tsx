"use client";

import {
  IconPlus,
  IconPointer,
  IconHandGrab,
  IconVariable,
} from "@tabler/icons-react";
import { Button } from "@kianax/ui/components/button";
import { cn } from "@kianax/ui/lib/utils";

type ToolType = "select" | "hand" | null;

interface ToolbarProps {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  onAddNode: () => void;
  onToggleVariables: () => void;
  variablesPanelOpen: boolean;
}

export function Toolbar({
  activeTool,
  onToolChange,
  onAddNode,
  onToggleVariables,
  variablesPanelOpen,
}: ToolbarProps) {
  return (
    <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-0.5 rounded-md border bg-background p-1 shadow-lg">
      {/* Add Node */}
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={onAddNode}
        title="Add node"
      >
        <IconPlus className="size-4" />
      </Button>

      {/* Variables */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "size-8",
          variablesPanelOpen && "bg-accent text-accent-foreground",
        )}
        onClick={onToggleVariables}
        title="Variables"
      >
        <IconVariable className="size-4" />
      </Button>

      <div className="h-px bg-border my-0.5" />

      {/* Pointer Tool */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "size-8",
          activeTool === "select" && "bg-accent text-accent-foreground",
        )}
        onClick={() => onToolChange("select")}
        title="Pointer"
      >
        <IconPointer className="size-4" />
      </Button>

      {/* Hand Tool */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "size-8",
          activeTool === "hand" && "bg-accent text-accent-foreground",
        )}
        onClick={() => onToolChange("hand")}
        title="Hand"
      >
        <IconHandGrab className="size-4" />
      </Button>
    </div>
  );
}
