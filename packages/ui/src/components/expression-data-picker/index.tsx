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
 * - Keyboard navigation (arrow keys, Enter, Escape)
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

import { forwardRef, useState, useCallback, useMemo } from "react";
import { cn } from "../../lib/utils";
import { TreeProvider, useTreeContext } from "./tree-context";
import { TreeNode } from "./tree-node";
import { useTreeNavigation } from "./use-tree-navigation";
import type { ExpressionContext, CompletionItem } from "../expression-input";

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
 * Filter completion items based on search query
 */
function filterItems(items: CompletionItem[], query: string): CompletionItem[] {
  if (!query.trim()) return items;

  const lowerQuery = query.toLowerCase();
  const result: CompletionItem[] = [];

  for (const item of items) {
    // Check if this item matches
    const nameMatches = item.name.toLowerCase().includes(lowerQuery);
    const detailMatches = item.detail?.toLowerCase().includes(lowerQuery);

    // Recursively filter children
    const filteredChildren = item.children
      ? filterItems(item.children, query)
      : [];

    // Include if this item matches or has matching children
    if (nameMatches || detailMatches || filteredChildren.length > 0) {
      result.push({
        ...item,
        children:
          filteredChildren.length > 0 ? filteredChildren : item.children,
      });
    }
  }

  return result;
}

/**
 * Inner tree component with access to TreeContext
 */
function TreeContent({
  items,
  onSelect,
  onDragStart,
  draggable,
  searchQuery,
}: {
  items: CompletionItem[];
  onSelect?: (path: string, value: unknown) => void;
  onDragStart?: (path: string, value: unknown) => void;
  draggable: boolean;
  searchQuery: string;
}) {
  const { isExpanded, toggleExpanded } = useTreeContext();

  // Filter items based on search
  const filteredItems = useMemo(
    () => filterItems(items, searchQuery),
    [items, searchQuery],
  );

  const {
    containerRef,
    focusedPath,
    setFocusedPath,
    handleKeyDown,
    handleFocus,
    handleBlur,
  } = useTreeNavigation({
    items: filteredItems,
    isExpanded,
    toggleExpanded,
    onSelect,
  });

  if (filteredItems.length === 0 && searchQuery) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        No results for "{searchQuery}"
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="p-1 max-h-80 overflow-y-auto outline-none focus:ring-2 focus:ring-ring focus:ring-inset"
      role="tree"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {filteredItems.map((item) => (
        <TreeNode
          key={item.name}
          item={item}
          path={item.name}
          onSelect={onSelect}
          draggable={draggable}
          onDragStart={onDragStart}
          focusedPath={focusedPath}
          onFocusPath={setFocusedPath}
        />
      ))}
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
  const [searchQuery, setSearchQuery] = useState("");
  const completions = context?.completions ?? [];

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
    },
    [],
  );

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
      {/* Search input */}
      {showSearch && (
        <div className="p-2 border-b">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full px-2 py-1 text-sm rounded border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {/* Tree view */}
      <TreeProvider defaultExpanded={defaultExpanded}>
        <TreeContent
          items={completions}
          onSelect={onSelect}
          onDragStart={onDragStart}
          draggable={draggable}
          searchQuery={searchQuery}
        />
      </TreeProvider>
    </div>
  );
});

// Re-export types and utilities
export type { ExpressionContext } from "../expression-input";
export { TreeProvider, useTreeContext } from "./tree-context";
export { TreeNode } from "./tree-node";
export { useTreeNavigation } from "./use-tree-navigation";
