"use client";

/**
 * ExpressionDataPicker Component
 *
 * A tree-based UI for browsing and selecting expression data, inspired by n8n.
 *
 * Features:
 * - Hierarchical tree displaying all completion sources (vars, nodes, trigger, execution)
 * - Expand/collapse functionality for nested data
 * - Type badges (str, num, bool, obj, arr) on nodes
 * - Value preview on hover or inline
 * - Click to select leaf nodes
 * - Drag leaf nodes to ExpressionInput
 *
 * Usage:
 * ```tsx
 * <ExpressionDataPicker
 *   context={expressionContext}
 *   onSelect={(path) => insertAtCursor(`{{ ${path} }}`)}
 *   draggable
 * />
 * ```
 */

import { forwardRef } from "react";
import { cn } from "../../lib/utils";
import { TreeProvider } from "./tree-context";
import { TreeNode } from "./tree-node";
import type { ExpressionContext } from "../expression-input";

export interface ExpressionDataPickerProps {
  /** Expression context (same as ExpressionInput) */
  context: ExpressionContext;

  /** Called when user selects a leaf node */
  onSelect?: (path: string, value: unknown) => void;

  /** Called when drag starts */
  onDragStart?: (path: string, value: unknown) => void;

  /** Enable/disable drag functionality */
  draggable?: boolean;

  /** Show search/filter input */
  showSearch?: boolean;

  /** Initially expanded paths */
  defaultExpanded?: string[];

  /** Additional CSS class */
  className?: string;
}

/**
 * Empty state shown when no completions are available
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <p className="text-sm text-muted-foreground">No data available</p>
      <p className="text-xs text-muted-foreground/70 mt-1">
        Context data will appear here when available
      </p>
    </div>
  );
}

/**
 * Expression Data Picker component.
 *
 * Renders a tree view of the expression context, allowing users to
 * browse and select expression paths.
 */
export const ExpressionDataPicker = forwardRef<
  HTMLDivElement,
  ExpressionDataPickerProps
>(function ExpressionDataPicker(
  {
    context,
    onSelect,
    onDragStart,
    draggable = false,
    showSearch = false,
    defaultExpanded = [],
    className,
  },
  ref,
) {
  const completions = context?.completions ?? [];

  if (completions.length === 0) {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-md border bg-card text-card-foreground",
          className,
        )}
      >
        <EmptyState />
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-md border bg-card text-card-foreground overflow-hidden",
        className,
      )}
    >
      {/* Search input (Phase 2) */}
      {showSearch && (
        <div className="p-2 border-b">
          <input
            type="text"
            placeholder="Search..."
            className="w-full px-2 py-1 text-sm rounded border bg-background"
            disabled
          />
        </div>
      )}

      {/* Tree view */}
      <div className="p-1 max-h-80 overflow-y-auto" role="tree">
        <TreeProvider defaultExpanded={defaultExpanded}>
          {completions.map((item) => (
            <TreeNode
              key={item.name}
              item={item}
              path={item.name}
              onSelect={onSelect}
              draggable={draggable}
              onDragStart={onDragStart}
            />
          ))}
        </TreeProvider>
      </div>
    </div>
  );
});

// Re-export types and utilities
export type { ExpressionContext } from "../expression-input";
export { TreeProvider, useTreeContext } from "./tree-context";
export { TreeNode } from "./tree-node";
