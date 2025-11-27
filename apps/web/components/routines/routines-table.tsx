"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Id } from "@kianax/server/convex/_generated/dataModel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@kianax/ui/components/table";
import { Button } from "@kianax/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@kianax/ui/components/tooltip";
import {
  IconEdit,
  IconTrash,
  IconPlayerPlay,
  IconHistory,
  IconClock,
  IconLoader2,
  IconSettingsAutomation,
} from "@tabler/icons-react";
import { StatusBadge } from "./status-badge";
import { formatDistanceToNow } from "date-fns";

interface Routine {
  _id: Id<"routines">;
  name: string;
  description?: string;
  status: "draft" | "active" | "paused" | "archived";
  triggerType: "manual" | "cron" | "webhook" | "event";
  nodes: unknown[];
  lastExecutedAt?: number;
  _creationTime: number;
}

interface RoutinesTableProps {
  routines: Routine[];
  onEdit: (routine: Routine) => void;
  onDelete: (routineId: Id<"routines">) => void;
  onViewHistory: (routine: Routine) => void;
  onRunNow: (routineId: Id<"routines">) => void;
}

export function RoutinesTable({
  routines,
  onEdit,
  onDelete,
  onViewHistory,
  onRunNow,
}: RoutinesTableProps) {
  const router = useRouter();
  const [runningRoutines, setRunningRoutines] = useState<Set<string>>(
    new Set(),
  );

  const handleRunNow = async (routineId: Id<"routines">) => {
    setRunningRoutines((prev) => new Set(prev).add(routineId));
    try {
      await onRunNow(routineId);
    } finally {
      setRunningRoutines((prev) => {
        const next = new Set(prev);
        next.delete(routineId);
        return next;
      });
    }
  };

  const formatTriggerType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const formatLastRun = (timestamp?: number) => {
    if (!timestamp) return "Never";
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  };

  if (routines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
          <IconClock className="size-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">No routines yet</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Get started by creating your first routine
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Trigger</TableHead>
            <TableHead>Nodes</TableHead>
            <TableHead>Last Run</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {routines.map((routine) => (
            <TableRow key={routine._id}>
              <TableCell>
                <div>
                  <div className="font-medium">{routine.name}</div>
                  {routine.description && (
                    <div className="text-sm text-muted-foreground">
                      {routine.description}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={routine.status} />
              </TableCell>
              <TableCell>{formatTriggerType(routine.triggerType)}</TableCell>
              <TableCell>
                {routine.nodes?.length || 0} node
                {routine.nodes?.length !== 1 ? "s" : ""}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatLastRun(routine.lastExecutedAt)}
              </TableCell>
              <TableCell className="text-right">
                <TooltipProvider delayDuration={300}>
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => handleRunNow(routine._id)}
                          disabled={runningRoutines.has(routine._id)}
                        >
                          {runningRoutines.has(routine._id) ? (
                            <IconLoader2 className="size-4 animate-spin" />
                          ) : (
                            <IconPlayerPlay className="size-4" />
                          )}
                          <span className="sr-only">Run now</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Run now</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => onViewHistory(routine)}
                        >
                          <IconHistory className="size-4" />
                          <span className="sr-only">View history</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View history</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() =>
                            router.push(
                              `/dashboard/routines/${routine._id}/edit`,
                            )
                          }
                        >
                          <IconSettingsAutomation className="size-4" />
                          <span className="sr-only">Edit routine</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit routine</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => onEdit(routine)}
                        >
                          <IconEdit className="size-4" />
                          <span className="sr-only">Edit details</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit details</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => onDelete(routine._id)}
                        >
                          <IconTrash className="size-4" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
