"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { inferType } from "../../lib/expression-types";
import { useTreeContext } from "./tree-context";
import type { CompletionItem } from "../expression-input";

/**
 * Type badge colors matching the PreviewBadge in ExpressionInput
 */
const TYPE_COLORS: Record<string, string> = {
  str: "bg-green-500/10 text-green-600 dark:text-green-400",
  string: "bg-green-500/10 text-green-600 dark:text-green-400",
  num: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  number: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  bool: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  boolean: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  obj: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  object: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  arr: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  array: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  null: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

/**
 * Normalize type to badge label
 */
function getTypeBadge(type: string | undefined): string | undefined {
  if (!type) return undefined;
  const normalized = type.toLowerCase();
  const map: Record<string, string> = {
    string: "str",
    number: "num",
    boolean: "bool",
    object: "obj",
    array: "arr",
  };
  return map[normalized] ?? type;
}

/**
 * Format a value for inline preview (truncated)
 */
function formatValuePreview(value: unknown, maxLength = 30): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  if (typeof value === "string") {
    if (value.length > maxLength) {
      return `"${value.slice(0, maxLength)}..."`;
    }
    return `"${value}"`;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);
    return `{${keys.length} keys}`;
  }

  return String(value);
}

/**
 * Check if an item has expandable children
 */
function hasChildren(item: CompletionItem): boolean {
  // Has explicit children
  if (item.children && item.children.length > 0) {
    return true;
  }
  // Has object/array value that can be expanded
  if (item.value !== null && item.value !== undefined) {
    if (Array.isArray(item.value) && item.value.length > 0) {
      return true;
    }
    if (
      typeof item.value === "object" &&
      Object.keys(item.value as object).length > 0
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Get children from an item (merging explicit children with value introspection)
 */
function getChildren(item: CompletionItem): CompletionItem[] {
  const valueObj = item.value as Record<string, unknown> | undefined;

  // If we have explicit children, merge them with values from item.value
  if (item.children && item.children.length > 0) {
    return item.children.map((child) => {
      // If child already has a value, use it
      if (child.value !== undefined) {
        return child;
      }
      // Otherwise, try to get the value from the parent's value object
      if (
        valueObj &&
        typeof valueObj === "object" &&
        !Array.isArray(valueObj)
      ) {
        const childValue = valueObj[child.name];
        if (childValue !== undefined) {
          return {
            ...child,
            value: childValue,
            type: child.type ?? inferType(childValue),
          };
        }
      }
      return child;
    });
  }

  // Introspect object/array values when no explicit children
  if (item.value !== null && item.value !== undefined) {
    if (Array.isArray(item.value)) {
      return item.value.map((v, i) => ({
        name: String(i),
        type: inferType(v),
        value: v,
      }));
    }
    if (typeof item.value === "object") {
      return Object.entries(item.value as Record<string, unknown>).map(
        ([key, val]) => ({
          name: key,
          type: inferType(val),
          value: val,
        }),
      );
    }
  }

  return [];
}

interface TreeNodeProps {
  /** The completion item to render */
  item: CompletionItem;
  /** Current path to this node (for building expression path) */
  path: string;
  /** Nesting depth for indentation */
  depth?: number;
  /** Called when a leaf node is selected */
  onSelect?: (path: string, value: unknown) => void;
  /** Whether nodes are draggable */
  draggable?: boolean;
  /** Called when drag starts */
  onDragStart?: (path: string, value: unknown) => void;
  /** Currently focused path (for keyboard navigation) */
  focusedPath?: string | null;
  /** Called to update focused path */
  onFocusPath?: (path: string) => void;
}

export function TreeNode({
  item,
  path,
  depth = 0,
  onSelect,
  draggable = false,
  onDragStart,
  focusedPath,
  onFocusPath,
}: TreeNodeProps) {
  const { isExpanded, toggleExpanded } = useTreeContext();

  const isExpandable = hasChildren(item);
  const expanded = isExpanded(path);
  const children = expanded ? getChildren(item) : [];

  // Determine type badge
  const typeBadge = getTypeBadge(item.type) ?? inferType(item.value);
  const typeColor = typeBadge
    ? (TYPE_COLORS[typeBadge] ?? TYPE_COLORS.obj)
    : undefined;

  // Is this a leaf node (can be selected)?
  const isLeaf = !isExpandable;

  // Is this node focused?
  const isFocused = focusedPath === path;

  const handleClick = () => {
    // Set focus when clicking
    onFocusPath?.(path);
    if (isExpandable) {
      toggleExpanded(path);
    } else if (onSelect) {
      onSelect(path, item.value);
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (!draggable || !isLeaf) return;

    e.dataTransfer.setData("text/plain", `{{ ${path} }}`);
    e.dataTransfer.setData("application/x-expression-path", path);
    e.dataTransfer.effectAllowed = "copy";

    onDragStart?.(path, item.value);
  };

  return (
    <div className="select-none">
      {/* Node row */}
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-sm cursor-pointer",
          "hover:bg-accent/50 transition-colors",
          isLeaf && draggable && "cursor-grab active:cursor-grabbing",
          isFocused && "bg-accent ring-1 ring-ring",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        draggable={draggable && isLeaf}
        onDragStart={handleDragStart}
        role="treeitem"
        aria-expanded={isExpandable ? expanded : undefined}
        aria-selected={isFocused}
      >
        {/* Expand/collapse indicator */}
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {isExpandable && (
            <ChevronRight
              className={cn(
                "w-3 h-3 text-muted-foreground transition-transform",
                expanded && "rotate-90",
              )}
            />
          )}
        </span>

        {/* Node name */}
        <span className="text-sm font-medium truncate">{item.name}</span>

        {/* Type badge */}
        {typeBadge && (
          <span
            className={cn(
              "shrink-0 rounded px-1 py-0.5 text-[10px] font-medium uppercase",
              typeColor,
            )}
          >
            {typeBadge}
          </span>
        )}

        {/* Value preview (for leaf nodes or when useful) */}
        {isLeaf && item.value !== undefined && (
          <span
            className="text-xs text-muted-foreground font-mono truncate ml-auto"
            title={JSON.stringify(item.value, null, 2)}
          >
            {formatValuePreview(item.value)}
          </span>
        )}

        {/* Detail text */}
        {!isLeaf && item.detail && (
          <span className="text-xs text-muted-foreground truncate ml-auto">
            {item.detail}
          </span>
        )}
      </div>

      {/* Children (when expanded) */}
      {expanded && children.length > 0 && (
        <div role="group">
          {children.map((child) => (
            <TreeNode
              key={child.name}
              item={child}
              path={`${path}.${child.name}`}
              depth={depth + 1}
              onSelect={onSelect}
              draggable={draggable}
              onDragStart={onDragStart}
              focusedPath={focusedPath}
              onFocusPath={onFocusPath}
            />
          ))}
        </div>
      )}
    </div>
  );
}
