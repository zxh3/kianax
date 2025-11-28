"use client";

import { Button } from "@kianax/ui/components/button";
import {
  IconPlayerPlay,
  IconCode,
  IconEye,
  IconCheck,
  IconHistory,
  IconLoader2,
  IconDeviceFloppy,
} from "@tabler/icons-react";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@kianax/ui/components/toggle-group";
import { cn } from "@kianax/ui/lib/utils";
import type { EditorMode } from "./types";

interface CanvasControlsProps {
  editorMode: EditorMode;
  onEditorModeChange: (mode: EditorMode) => void;
  hasUnsavedChanges: boolean;
  isStartingTest: boolean;
  onRunTest: () => void;
  onApplyJson?: () => void;
  onToggleHistory: () => void;
  viewingExecutionId: string | null;
  onExitViewingMode: () => void;
}

export function CanvasControls({
  editorMode,
  onEditorModeChange,
  hasUnsavedChanges,
  isStartingTest,
  onRunTest,
  onApplyJson,
  onToggleHistory,
  viewingExecutionId,
  onExitViewingMode,
}: CanvasControlsProps) {
  return (
    <>
      {/* Top Center - Mode Switcher */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-background/80 backdrop-blur-sm shadow-sm">
          <ToggleGroup
            type="single"
            value={editorMode}
            onValueChange={(v) => v && onEditorModeChange(v as EditorMode)}
            className="gap-0"
          >
            <ToggleGroupItem
              value="visual"
              size="sm"
              className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              <IconEye className="mr-1.5 size-3.5" />
              Visual
            </ToggleGroupItem>
            <ToggleGroupItem
              value="json"
              size="sm"
              className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              JSON
              <IconCode className="ml-1.5 size-3.5" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Top Right - Actions */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {/* Viewing Mode Indicator */}
        {viewingExecutionId && (
          <div className="flex items-center gap-2 bg-amber-500/10 backdrop-blur-sm border border-amber-500/20 rounded-full pl-3 pr-1 py-1 shadow-sm">
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400 mr-2">
              Viewing Past Run
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 rounded-full px-3 text-amber-600 hover:text-amber-700 hover:bg-amber-500/20 dark:text-amber-400 dark:hover:bg-amber-500/20"
              onClick={onExitViewingMode}
            >
              Exit
            </Button>
          </div>
        )}

        {/* Main Control Panel */}
        <div className="flex items-center gap-1 bg-background/80 backdrop-blur-sm border rounded-full p-1 shadow-sm">
          {editorMode === "json" && onApplyJson ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={onApplyJson}
              className="rounded-full h-8 px-3"
            >
              <IconDeviceFloppy className="mr-1.5 size-3.5" />
              Apply Changes
            </Button>
          ) : (
            <>
              {/* Save Status */}
              <div className="flex items-center px-3 text-xs text-muted-foreground border-r mr-1">
                {hasUnsavedChanges ? (
                  <span className="flex items-center gap-1.5">
                    <div className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Unsaved
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-green-600 dark:text-green-500">
                    <IconCheck className="size-3.5" />
                    Saved
                  </span>
                )}
              </div>

              {/* History Button */}
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-full"
                onClick={onToggleHistory}
                title="History"
              >
                <IconHistory className="size-4" />
              </Button>

              {/* Run Test Button */}
              <Button
                size="sm"
                className={cn(
                  "rounded-full h-8 px-3 ml-1",
                  isStartingTest && "opacity-80",
                )}
                onClick={onRunTest}
                disabled={isStartingTest}
              >
                {isStartingTest ? (
                  <IconLoader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <IconPlayerPlay className="mr-1.5 size-3.5 fill-current" />
                )}
                Run
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
