"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";

interface TreeContextValue {
  /** Set of expanded node paths */
  expandedPaths: Set<string>;
  /** Toggle expansion state of a path */
  toggleExpanded: (path: string) => void;
  /** Check if a path is expanded */
  isExpanded: (path: string) => boolean;
  /** Expand a specific path */
  expand: (path: string) => void;
  /** Collapse a specific path */
  collapse: (path: string) => void;
  /** Expand all paths */
  expandAll: () => void;
  /** Collapse all paths */
  collapseAll: () => void;
}

const TreeContext = createContext<TreeContextValue | null>(null);

interface TreeProviderProps {
  children: ReactNode;
  /** Initially expanded paths */
  defaultExpanded?: string[];
}

export function TreeProvider({
  children,
  defaultExpanded = [],
}: TreeProviderProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set(defaultExpanded),
  );

  const toggleExpanded = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const isExpanded = useCallback(
    (path: string) => expandedPaths.has(path),
    [expandedPaths],
  );

  const expand = useCallback((path: string) => {
    setExpandedPaths((prev) => new Set(prev).add(path));
  }, []);

  const collapse = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    // This is a no-op here - would need all paths passed in
    // For now, consumers should call expand() on specific paths
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set());
  }, []);

  return (
    <TreeContext.Provider
      value={{
        expandedPaths,
        toggleExpanded,
        isExpanded,
        expand,
        collapse,
        expandAll,
        collapseAll,
      }}
    >
      {children}
    </TreeContext.Provider>
  );
}

export function useTreeContext() {
  const context = useContext(TreeContext);
  if (!context) {
    throw new Error("useTreeContext must be used within a TreeProvider");
  }
  return context;
}
