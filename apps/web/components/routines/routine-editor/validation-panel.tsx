"use client";

import type { ExpressionValidationError } from "@kianax/execution-engine";
import { IconAlertTriangle, IconX } from "@tabler/icons-react";
import { Button } from "@kianax/ui/components/button";

interface ValidationPanelProps {
  errors: ExpressionValidationError[];
  onClose: () => void;
  onNodeClick?: (nodeId: string) => void;
}

/**
 * Panel that displays expression validation errors
 */
export function ValidationPanel({
  errors,
  onClose,
  onNodeClick,
}: ValidationPanelProps) {
  if (errors.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 z-50 max-h-48 overflow-auto rounded-lg border border-destructive/50 bg-destructive/10 p-3 shadow-lg backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <IconAlertTriangle className="size-4" />
          <span>
            {errors.length} Expression Error{errors.length > 1 ? "s" : ""}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 text-destructive hover:text-destructive"
          onClick={onClose}
        >
          <IconX className="size-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {errors.map((error, index) => (
          <div
            key={`${error.nodeId}-${index}`}
            className="rounded-md bg-background/80 p-2 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-medium text-foreground">{error.message}</p>
                <p className="mt-0.5 text-muted-foreground">
                  Node:{" "}
                  {onNodeClick ? (
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => onNodeClick(error.nodeId)}
                    >
                      {error.nodeLabel || error.nodeId}
                    </button>
                  ) : (
                    <span>{error.nodeLabel || error.nodeId}</span>
                  )}
                </p>
                <code className="mt-1 block rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                  {error.expression}
                </code>
              </div>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  error.type === "UNDEFINED_VARIABLE"
                    ? "bg-amber-500/20 text-amber-600"
                    : error.type === "NOT_UPSTREAM"
                      ? "bg-blue-500/20 text-blue-600"
                      : "bg-red-500/20 text-red-600"
                }`}
              >
                {error.type === "UNDEFINED_VARIABLE"
                  ? "Undefined Var"
                  : error.type === "NOT_UPSTREAM"
                    ? "Not Upstream"
                    : error.type === "SELF_REFERENCE"
                      ? "Self Ref"
                      : "Invalid Node"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
