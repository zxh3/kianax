"use client";

import { useQuery } from "convex/react";
import { api } from "@kianax/server/convex/_generated/api";
import { Button } from "@kianax/ui/components/button";
import { ScrollArea } from "@kianax/ui/components/scroll-area";
import { Badge } from "@kianax/ui/components/badge";
import {
  IconCheck,
  IconClock,
  IconLoader2,
  IconX,
  IconChevronRight,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { format } from "date-fns";

interface TestRunPanelProps {
  workflowId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectNode?: (nodeId: string) => void;
  selectedNodeId?: string | null;
}

export function TestRunPanel({
  workflowId,
  isOpen,
  onClose,
  onSelectNode,
  selectedNodeId,
}: TestRunPanelProps) {
  // Fetch the specific execution
  // We skip the query if workflowId is null, but we need to handle that logic
  const execution = useQuery(
    api.executions.getByWorkflowId,
    workflowId ? { workflowId } : "skip",
  );

  if (!isOpen) return null;

  if (!workflowId) {
    return null; // Should not happen if isOpen is true generally
  }

  const formatDuration = (start: number, end?: number) => {
    const endTime = end || Date.now();
    const ms = endTime - start;
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 h-64 bg-background border-t border-border shadow-2xl z-40 flex flex-col transition-transform duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="font-semibold text-sm flex items-center gap-2 text-foreground">
            Test Run
            {execution && (
              <Badge
                variant="outline"
                className={`${
                  execution.status === "running"
                    ? "animate-pulse border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    : execution.status === "completed"
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : execution.status === "failed"
                        ? "border-destructive/50 bg-destructive/10 text-destructive"
                        : ""
                }`}
              >
                {execution.status === "running" && (
                  <IconLoader2 className="mr-1 size-3 animate-spin" />
                )}
                {execution.status === "completed" && (
                  <IconCheck className="mr-1 size-3" />
                )}
                {execution.status === "failed" && (
                  <IconAlertTriangle className="mr-1 size-3" />
                )}
                {execution.status.toUpperCase()}
              </Badge>
            )}
          </div>
          {execution && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <IconClock className="size-3" />
              {formatDuration(execution.startedAt, execution.completedAt)}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onClose}
        >
          <IconX className="size-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Logs List */}
        <ScrollArea className="flex-1 p-4">
          {!execution ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              <IconLoader2 className="mr-2 size-4 animate-spin" />
              Initializing execution...
            </div>
          ) : execution.nodeStates.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              Waiting for first node...
            </div>
          ) : (
            <div className="space-y-2">
              {execution.nodeStates.map((nodeState: any, idx: number) => (
                <div
                  key={`${nodeState.nodeId}-${idx}`}
                  className={`rounded-lg border text-sm transition-colors ${
                    selectedNodeId === nodeState.nodeId
                      ? "bg-primary/10 border-primary/20"
                      : "border-transparent hover:bg-muted/20"
                  }`}
                >
                  <button
                    type="button"
                    className="flex items-center gap-3 p-2 w-full text-left select-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary rounded-lg"
                    onClick={() => onSelectNode?.(nodeState.nodeId)}
                  >
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        nodeState.status === "completed"
                          ? "bg-emerald-500"
                          : nodeState.status === "failed"
                            ? "bg-destructive"
                            : nodeState.status === "running"
                              ? "bg-blue-500 animate-pulse"
                              : "bg-muted-foreground"
                      }`}
                    />
                    <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">
                      {nodeState.completedAt
                        ? format(new Date(nodeState.completedAt), "HH:mm:ss")
                        : nodeState.startedAt
                          ? format(new Date(nodeState.startedAt), "HH:mm:ss")
                          : "—"}
                    </span>
                    <span className="font-medium flex-1 text-foreground truncate">
                      {nodeState.nodeId}
                    </span>
                    {nodeState.iteration !== undefined && (
                      <Badge variant="secondary" className="text-[10px] h-5">
                        Iter {nodeState.iteration}
                      </Badge>
                    )}
                    <Badge
                      variant={
                        nodeState.status === "failed"
                          ? "destructive"
                          : "outline"
                      }
                      className="text-[10px] h-5 capitalize"
                    >
                      {nodeState.status}
                    </Badge>
                    <IconChevronRight className="size-4 text-muted-foreground opacity-50" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
