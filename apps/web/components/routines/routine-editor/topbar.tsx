"use client";

import { Button } from "@kianax/ui/components/button";
import { Tabs, TabsList, TabsTrigger } from "@kianax/ui/components/tabs";
import {
  IconPlayerPlay,
  IconCode,
  IconEye,
  IconCheck,
} from "@tabler/icons-react";
import type { EditorMode } from "./types";

interface TopBarProps {
  editorMode: EditorMode;
  onEditorModeChange: (mode: EditorMode) => void;
  hasUnsavedChanges: boolean;
  isStartingTest: boolean;
  onRunTest: () => void;
  onApplyJson?: () => void;
}

export function TopBar({
  editorMode,
  onEditorModeChange,
  hasUnsavedChanges,
  isStartingTest,
  onRunTest,
  onApplyJson,
}: TopBarProps) {
  return (
    <div className="flex items-center justify-between gap-2 border-b bg-background px-4 py-2">
      <div className="flex items-center gap-2">
        <Tabs
          value={editorMode}
          onValueChange={(v) => onEditorModeChange(v as EditorMode)}
        >
          <TabsList className="h-8">
            <TabsTrigger value="visual" className="text-xs">
              <IconEye className="mr-1.5 size-3.5" />
              Visual
            </TabsTrigger>
            <TabsTrigger value="json" className="text-xs">
              <IconCode className="mr-1.5 size-3.5" />
              JSON
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {editorMode === "json" && onApplyJson && (
          <Button size="sm" variant="outline" onClick={onApplyJson}>
            Apply Changes
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Auto-save indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {hasUnsavedChanges ? (
            <span>Saving...</span>
          ) : (
            <>
              <IconCheck className="size-3.5 text-green-600" />
              <span>Saved</span>
            </>
          )}
        </div>

        <div className="w-px h-4 bg-border" />

        <Button size="sm" onClick={onRunTest} disabled={isStartingTest}>
          <IconPlayerPlay className="mr-1.5 size-3.5" />
          {isStartingTest ? "Starting..." : "Test Run"}
        </Button>
      </div>
    </div>
  );
}
