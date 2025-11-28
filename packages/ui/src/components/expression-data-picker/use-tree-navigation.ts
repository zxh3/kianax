"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { inferType } from "../../lib/expression-types";
import type { CompletionItem } from "../expression-input";

interface TreeNavigationOptions {
  /** Root completion items */
  items: CompletionItem[];
  /** Currently expanded paths */
  isExpanded: (path: string) => boolean;
  /** Toggle expansion state */
  toggleExpanded: (path: string) => void;
  /** Callback when a node is selected */
  onSelect?: (path: string, value: unknown) => void;
}

interface FlatNode {
  path: string;
  item: CompletionItem;
  depth: number;
  hasChildren: boolean;
}

/**
 * Check if an item has expandable children
 */
function itemHasChildren(item: CompletionItem): boolean {
  if (item.children && item.children.length > 0) {
    return true;
  }
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
 * Get children from an item (with value merging)
 */
function getItemChildren(item: CompletionItem): CompletionItem[] {
  const valueObj = item.value as Record<string, unknown> | undefined;

  if (item.children && item.children.length > 0) {
    return item.children.map((child) => {
      if (child.value !== undefined) {
        return child;
      }
      if (
        valueObj &&
        typeof valueObj === "object" &&
        !Array.isArray(valueObj)
      ) {
        const childValue = valueObj[child.name];
        if (childValue !== undefined) {
          return { ...child, value: childValue };
        }
      }
      return child;
    });
  }

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

/**
 * Flatten the visible tree nodes for navigation
 */
function flattenVisibleNodes(
  items: CompletionItem[],
  isExpanded: (path: string) => boolean,
  parentPath = "",
  depth = 0,
): FlatNode[] {
  const result: FlatNode[] = [];

  for (const item of items) {
    const path = parentPath ? `${parentPath}.${item.name}` : item.name;
    const hasChildren = itemHasChildren(item);

    result.push({ path, item, depth, hasChildren });

    if (hasChildren && isExpanded(path)) {
      const children = getItemChildren(item);
      result.push(
        ...flattenVisibleNodes(children, isExpanded, path, depth + 1),
      );
    }
  }

  return result;
}

/**
 * Hook for keyboard navigation in the tree
 */
export function useTreeNavigation({
  items,
  isExpanded,
  toggleExpanded,
  onSelect,
}: TreeNavigationOptions) {
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get flattened visible nodes
  const visibleNodes = flattenVisibleNodes(items, isExpanded);

  // Find current focused index
  const focusedIndex = focusedPath
    ? visibleNodes.findIndex((n) => n.path === focusedPath)
    : -1;

  const focusedNode = focusedIndex >= 0 ? visibleNodes[focusedIndex] : null;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (visibleNodes.length === 0) return;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const nextIndex = Math.min(focusedIndex + 1, visibleNodes.length - 1);
          const nextNode = visibleNodes[nextIndex];
          if (nextIndex >= 0 && nextNode) {
            setFocusedPath(nextNode.path);
          }
          break;
        }

        case "ArrowUp": {
          e.preventDefault();
          const prevIndex = Math.max(focusedIndex - 1, 0);
          const prevNode = visibleNodes[prevIndex];
          if (prevIndex >= 0 && prevNode) {
            setFocusedPath(prevNode.path);
          }
          break;
        }

        case "ArrowRight": {
          e.preventDefault();
          if (focusedNode) {
            if (focusedNode.hasChildren && !isExpanded(focusedNode.path)) {
              // Expand the node
              toggleExpanded(focusedNode.path);
            } else if (
              focusedNode.hasChildren &&
              isExpanded(focusedNode.path)
            ) {
              // Move to first child
              const childIndex = visibleNodes.findIndex(
                (n) =>
                  n.path.startsWith(`${focusedNode.path}.`) &&
                  n.depth === focusedNode.depth + 1,
              );
              const childNode = visibleNodes[childIndex];
              if (childIndex >= 0 && childNode) {
                setFocusedPath(childNode.path);
              }
            }
          }
          break;
        }

        case "ArrowLeft": {
          e.preventDefault();
          if (focusedNode) {
            if (focusedNode.hasChildren && isExpanded(focusedNode.path)) {
              // Collapse the node
              toggleExpanded(focusedNode.path);
            } else {
              // Move to parent
              const lastDot = focusedNode.path.lastIndexOf(".");
              if (lastDot > 0) {
                const parentPath = focusedNode.path.slice(0, lastDot);
                setFocusedPath(parentPath);
              }
            }
          }
          break;
        }

        case "Enter":
        case " ": {
          e.preventDefault();
          if (focusedNode) {
            if (focusedNode.hasChildren) {
              toggleExpanded(focusedNode.path);
            } else {
              onSelect?.(focusedNode.path, focusedNode.item.value);
            }
          }
          break;
        }

        case "Home": {
          e.preventDefault();
          const firstNode = visibleNodes[0];
          if (firstNode) {
            setFocusedPath(firstNode.path);
          }
          break;
        }

        case "End": {
          e.preventDefault();
          const lastNode = visibleNodes[visibleNodes.length - 1];
          if (lastNode) {
            setFocusedPath(lastNode.path);
          }
          break;
        }

        case "Escape": {
          e.preventDefault();
          containerRef.current?.blur();
          setFocusedPath(null);
          break;
        }
      }
    },
    [
      visibleNodes,
      focusedIndex,
      focusedNode,
      isExpanded,
      toggleExpanded,
      onSelect,
    ],
  );

  // Reset focus when items change significantly
  useEffect(() => {
    if (focusedPath && !visibleNodes.find((n) => n.path === focusedPath)) {
      // Find closest ancestor that still exists
      const parts = focusedPath.split(".");
      while (parts.length > 0) {
        const ancestorPath = parts.join(".");
        if (visibleNodes.find((n) => n.path === ancestorPath)) {
          setFocusedPath(ancestorPath);
          return;
        }
        parts.pop();
      }
      setFocusedPath(visibleNodes[0]?.path ?? null);
    }
  }, [focusedPath, visibleNodes]);

  const handleFocus = useCallback(() => {
    // Focus first node if nothing is focused
    const firstNode = visibleNodes[0];
    if (!focusedPath && firstNode) {
      setFocusedPath(firstNode.path);
    }
  }, [focusedPath, visibleNodes]);

  const handleBlur = useCallback(() => {
    // Keep the focused state for visual indicator
  }, []);

  return {
    containerRef,
    focusedPath,
    setFocusedPath,
    handleKeyDown,
    handleFocus,
    handleBlur,
  };
}
