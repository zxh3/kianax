"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@kianax/server/convex/_generated/api";
import type { Id } from "@kianax/server/convex/_generated/dataModel";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@kianax/ui/components/sheet";
import { Button } from "@kianax/ui/components/button";
import {
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconLoader2,
} from "@tabler/icons-react";
import { ExecutionStatusBadge } from "./execution-status-badge";
import { format } from "date-fns";
import { Badge } from "@kianax/ui/components/badge";

interface ExecutionHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routineId: Id<"routines"> | null;
  routineName: string;
}

export function ExecutionHistoryDrawer({
  open,
  onOpenChange,
  routineId,
  routineName,
}: ExecutionHistoryDrawerProps) {
  const [expandedExecution, setExpandedExecution] = useState<string | null>(
    null,
  );

  // Fetch executions for this routine
  const executions = useQuery(
    api.executions.getByRoutine,
    routineId ? { routineId, limit: 50 } : "skip",
  );

  const formatDuration = (ms?: number) => {
    if (!ms) return "N/A";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatTimestamp = (timestamp: number) => {
    return format(new Date(timestamp), "MMM d, yyyy HH:mm:ss");
  };

  const toggleExpand = (workflowId: string) => {
    setExpandedExecution(expandedExecution === workflowId ? null : workflowId);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Execution History</SheetTitle>
          <SheetDescription>{routineName}</SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {executions === undefined ? (
            <div className="flex items-center justify-center py-8">
              <IconLoader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : executions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
                <IconClock className="size-6 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">No executions yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                This routine hasn't been executed yet
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {executions.map((execution) => (
                <div
                  key={execution._id}
                  className="rounded-lg border p-4 space-y-3"
                >
                  {/* Execution Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <ExecutionStatusBadge status={execution.status} />
                        <Badge
                          variant="secondary"
                          className="font-mono text-xs"
                        >
                          {execution.workflowId.slice(0, 8)}...
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatTimestamp(execution.startedAt)}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpand(execution.workflowId)}
                    >
                      {expandedExecution === execution.workflowId ? (
                        <IconChevronDown className="size-4" />
                      ) : (
                        <IconChevronRight className="size-4" />
                      )}
                    </Button>
                  </div>

                  {/* Execution Metrics */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Duration</p>
                      <p className="font-medium">
                        {formatDuration(execution.duration)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Trigger</p>
                      <p className="font-medium capitalize">
                        {execution.triggerType}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Nodes</p>
                      <p className="font-medium">
                        {execution.nodeStates?.length || 0} executed
                      </p>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedExecution === execution.workflowId && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      {/* Node States */}
                      {execution.nodeStates &&
                        execution.nodeStates.length > 0 && (
                          <div>
                            <h4 className="mb-2 text-sm font-semibold">
                              Node Execution Details
                            </h4>
                            <div className="space-y-2">
                              {execution.nodeStates.map(
                                (nodeState: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="rounded-md bg-muted p-3 text-sm"
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="font-medium">
                                        {nodeState.nodeId}
                                      </span>
                                      <Badge
                                        variant={
                                          nodeState.status === "failed"
                                            ? "destructive"
                                            : "secondary"
                                        }
                                        className={`text-xs ${
                                          nodeState.status === "completed"
                                            ? "bg-green-500 text-white"
                                            : ""
                                        }`}
                                      >
                                        {nodeState.status}
                                      </Badge>
                                    </div>
                                    {nodeState.output && (
                                      <pre className="mt-2 overflow-x-auto rounded bg-background p-2 text-xs">
                                        {JSON.stringify(
                                          nodeState.output,
                                          null,
                                          2,
                                        )}
                                      </pre>
                                    )}
                                    {nodeState.error && (
                                      <div className="mt-2 rounded bg-destructive/10 p-2 text-xs text-destructive">
                                        {nodeState.error.message ||
                                          "Error occurred"}
                                      </div>
                                    )}
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}

                      {/* Execution Error */}
                      {execution.error && (
                        <div className="rounded-md bg-destructive/10 p-3">
                          <h4 className="mb-1 text-sm font-semibold text-destructive">
                            Execution Error
                          </h4>
                          <p className="text-sm text-destructive">
                            {execution.error.message}
                          </p>
                          {(execution.error as any).nodeId && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Failed at node: {(execution.error as any).nodeId}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Execution Path */}
                      {execution.executionPath &&
                        execution.executionPath.length > 0 && (
                          <div>
                            <h4 className="mb-2 text-sm font-semibold">
                              Execution Path
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {execution.executionPath.map(
                                (nodeId: string, idx: number) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-1"
                                  >
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {nodeId}
                                    </Badge>
                                    {idx <
                                      execution.executionPath!.length - 1 && (
                                      <span className="text-muted-foreground">
                                        →
                                      </span>
                                    )}
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}

                      {/* Workflow IDs */}
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-muted-foreground">Workflow ID</p>
                          <p className="font-mono">{execution.workflowId}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Run ID</p>
                          <p className="font-mono">{execution.runId}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
