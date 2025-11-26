"use client";

import { Button } from "@kianax/ui/components/button";
import { ScrollArea } from "@kianax/ui/components/scroll-area";
import { Badge } from "@kianax/ui/components/badge";
import {
  IconX,
  IconCheck,
  IconAlertTriangle,
  IconLoader2,
  IconClock,
} from "@tabler/icons-react";
import { format } from "date-fns";

interface TestResultDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  nodeLabel: string;
  executionState: any; // Using any to match existing loose typing, ideally should be typed
  onSwitchToConfig: (nodeId: string) => void;
  className?: string;
}

export function TestResultDrawer({
  isOpen,
  onClose,
  nodeId,
  nodeLabel,
  executionState,
  onSwitchToConfig,
  className,
}: TestResultDrawerProps) {
  if (!isOpen) return null;

  const formatDuration = (start?: number, end?: number) => {
    if (!start) return "-";
    const endTime = end || Date.now();
    const ms = endTime - start;
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div
      className={`absolute top-2 right-2 bottom-2 w-96 bg-background border border-border shadow-2xl rounded-xl flex flex-col z-50 overflow-hidden transition-all duration-300 ${
        className || ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="overflow-hidden">
          <h3 className="font-semibold text-sm text-foreground truncate pr-2">
            Result: {nodeLabel}
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{nodeId}</span>
            {executionState && (
              <Badge
                variant="outline"
                className={`h-5 px-1.5 text-[10px] capitalize ${
                  executionState.status === "running"
                    ? "border-blue-500/50 text-blue-600 bg-blue-500/10"
                    : executionState.status === "completed"
                      ? "border-emerald-500/50 text-emerald-600 bg-emerald-500/10"
                      : executionState.status === "failed"
                        ? "border-destructive/50 text-destructive bg-destructive/10"
                        : ""
                }`}
              >
                {executionState.status}
              </Badge>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          onClick={onClose}
        >
          <IconX className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-6">
          {!executionState ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No execution data available for this node.
            </div>
          ) : (
            <>
              {/* Status & Timing */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 p-3 rounded-lg border border-border">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <IconClock className="size-3" /> Duration
                  </div>
                  <div className="font-mono text-sm font-medium">
                    {formatDuration(
                      executionState.startedAt,
                      executionState.completedAt,
                    )}
                  </div>
                </div>
                <div className="bg-muted/30 p-3 rounded-lg border border-border">
                  <div className="text-xs text-muted-foreground mb-1">
                    Started
                  </div>
                  <div className="font-mono text-sm font-medium truncate">
                    {executionState.startedAt
                      ? format(
                          new Date(executionState.startedAt),
                          "HH:mm:ss.SSS",
                        )
                      : "-"}
                  </div>
                </div>
              </div>

              {/* Error Section */}
              {executionState.error && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-destructive uppercase tracking-wider flex items-center gap-2">
                    <IconAlertTriangle className="size-3" />
                    Error
                  </div>
                  <div className="bg-destructive/10 text-destructive rounded-lg border border-destructive/20 overflow-hidden text-xs">
                    <div className="p-3 font-semibold break-words">
                      {executionState.error.message}
                    </div>
                    {executionState.error.stack && (
                      <div className="border-t border-destructive/20 p-3 bg-destructive/5 font-mono whitespace-pre-wrap opacity-80 overflow-x-auto max-h-40 leading-relaxed">
                        {executionState.error.stack}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Output Section */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  {executionState.status === "running" ? (
                    <IconLoader2 className="size-3 animate-spin" />
                  ) : (
                    <IconCheck className="size-3" />
                  )}
                  Output
                </div>
                {executionState.output !== undefined ? (
                  <pre className="bg-muted text-foreground p-3 rounded-lg text-xs font-mono overflow-x-auto border border-border leading-relaxed">
                    {JSON.stringify(executionState.output, null, 2)}
                  </pre>
                ) : (
                  <div className="text-sm text-muted-foreground italic py-4 text-center border border-dashed border-border rounded-lg bg-muted/20">
                    No output generated
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-border bg-muted/30 flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSwitchToConfig(nodeId)}
        >
          Show Configuration
        </Button>
      </div>
    </div>
  );
}
