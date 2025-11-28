"use client";

/**
 * ExpressionInput Component
 *
 * A drop-in replacement for Input/Textarea that provides expression-aware
 * editing with syntax highlighting for {{ expression }} patterns.
 *
 * Features:
 * - Syntax highlighting for expressions ({{ vars.*, nodes.*, etc. }})
 * - Autocomplete suggestions when typing {{ (triggered by context)
 * - Live preview of resolved expression values (debounced)
 * - Single-line and multi-line modes
 * - Matches shadcn/ui Input and Textarea styling
 * - Supports placeholder, disabled states
 *
 * Usage:
 * ```tsx
 * <ExpressionInput
 *   value={url}
 *   onChange={setUrl}
 *   context={{
 *     completions: [
 *       {
 *         name: "vars",
 *         detail: "Variables",
 *         children: [
 *           { name: "baseUrl", type: "str", value: "https://api.example.com" },
 *         ],
 *       },
 *       {
 *         name: "data",
 *         detail: "API Data",
 *         children: [
 *           { name: "user", detail: "User info", children: [{ name: "id" }, { name: "email" }] },
 *         ],
 *       },
 *     ],
 *   }}
 *   showPreview
 *   placeholder="Enter URL with {{ vars.baseUrl }}"
 * />
 * ```
 */

import { forwardRef, useState, useCallback, useEffect, useRef } from "react";
import type { Extension } from "@codemirror/state";
import { cn } from "../../lib/utils";
import { Editor } from "./editor";
import {
  resolvePreview,
  containsExpression,
  formatPreviewValue,
  type PreviewResult,
} from "../../lib/expression-preview";

/**
 * A completion item for expression autocomplete.
 * This is a generic tree structure that allows arbitrary nesting.
 */
export interface CompletionItem {
  /** Display name shown in dropdown */
  name: string;
  /** Type indicator for badge (e.g., "str", "num", "obj", "keyword") */
  type?: string;
  /** Short description shown next to name */
  detail?: string;
  /** Extended info/documentation */
  info?: string;
  /** Nested completion items (static children) */
  children?: CompletionItem[];
  /** Runtime value for dynamic introspection (object keys become children) */
  value?: unknown;
}

/**
 * Context for expression autocompletion.
 * Provides a tree of completion sources that the component traverses.
 *
 * The component is agnostic to what the completions represent - consumers
 * can use this for variables, API endpoints, configuration, or any other
 * hierarchical data structure.
 */
export interface ExpressionContext {
  /** Root-level completion items */
  completions: CompletionItem[];
}

/**
 * Internal context for resolving preview values.
 * Extracted automatically from ExpressionContext.
 */
interface PreviewData {
  vars: Record<string, unknown>;
  nodes: Record<string, Record<string, unknown>>;
  trigger?: unknown;
  execution?: { id: string; routineId: string; startedAt: number };
}

/**
 * Extract preview data from the context tree.
 * This derives the preview values from CompletionItem.value fields.
 */
function extractPreviewData(
  context: ExpressionContext | undefined,
): PreviewData {
  const result: PreviewData = { vars: {}, nodes: {} };

  if (!context?.completions) return result;

  for (const item of context.completions) {
    if (item.name === "vars" && item.children) {
      for (const child of item.children) {
        if (child.value !== undefined) {
          result.vars[child.name] = child.value;
        }
      }
    } else if (item.name === "nodes" && item.children) {
      for (const nodeItem of item.children) {
        if (nodeItem.value !== undefined) {
          result.nodes[nodeItem.name] = nodeItem.value as Record<
            string,
            unknown
          >;
        } else if (nodeItem.children) {
          // Build from nested children if no direct value
          const nodeOutputs: Record<string, unknown> = {};
          for (const outputItem of nodeItem.children) {
            if (outputItem.value !== undefined) {
              nodeOutputs[outputItem.name] = outputItem.value;
            }
          }
          if (Object.keys(nodeOutputs).length > 0) {
            result.nodes[nodeItem.name] = nodeOutputs;
          }
        }
      }
    } else if (item.name === "trigger" && item.value !== undefined) {
      result.trigger = item.value;
    } else if (item.name === "execution" && item.value !== undefined) {
      result.execution = item.value as PreviewData["execution"];
    }
  }

  return result;
}

export interface ExpressionInputProps {
  /** Current value (may contain {{ expressions }}) */
  value: string;
  /** Called when value changes */
  onChange: (value: string) => void;

  /** Expression context for autocomplete suggestions and preview values */
  context?: ExpressionContext;

  /** Show live preview of resolved value */
  showPreview?: boolean;

  /** Multi-line mode (renders as textarea) */
  multiline?: boolean;
  /** Number of rows for multiline (CSS min-height) */
  rows?: number;

  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;

  /** Validation error message */
  error?: string;

  /** Additional CodeMirror extensions */
  extensions?: Extension[];

  /** Called when input gains focus */
  onFocus?: () => void;
  /** Called when input loses focus */
  onBlur?: () => void;

  /** Accept drag & drop of expression paths from ExpressionDataPicker */
  acceptDrop?: boolean;
}

/**
 * Expression-aware input component with syntax highlighting.
 *
 * Drop-in replacement for Input or Textarea components when you need
 * to support {{ expression }} syntax with visual feedback.
 */
/** Debounce delay for preview resolution in milliseconds */
const PREVIEW_DEBOUNCE_MS = 300;

export const ExpressionInput = forwardRef<HTMLDivElement, ExpressionInputProps>(
  function ExpressionInput(
    {
      value,
      onChange,
      context,
      showPreview = false,
      multiline = false,
      rows,
      placeholder,
      disabled = false,
      className,
      error,
      extensions,
      onFocus,
      onBlur,
      acceptDrop = false,
    },
    ref,
  ) {
    const [isFocused, setIsFocused] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [preview, setPreview] = useState<PreviewResult | null>(null);
    const [isResolvingPreview, setIsResolvingPreview] = useState(false);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleDragOverChange = useCallback((isOver: boolean) => {
      setIsDragOver(isOver);
    }, []);

    const handleFocus = useCallback(() => {
      setIsFocused(true);
      onFocus?.();
    }, [onFocus]);

    const handleBlur = useCallback(() => {
      setIsFocused(false);
      onBlur?.();
    }, [onBlur]);

    // Debounced preview resolution
    useEffect(() => {
      // Clear any pending timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Skip preview if not enabled or no context
      if (!showPreview || !context) {
        setPreview(null);
        return;
      }

      // Skip if no expressions in value
      if (!containsExpression(value)) {
        setPreview(null);
        return;
      }

      // Set resolving state
      setIsResolvingPreview(true);

      // Extract preview data from context tree
      const previewData = extractPreviewData(context);

      // Debounce the resolution
      debounceTimerRef.current = setTimeout(() => {
        const result = resolvePreview(value, {
          vars: previewData.vars,
          nodes: previewData.nodes,
          trigger: previewData.trigger,
          execution: previewData.execution,
        });
        setPreview(result);
        setIsResolvingPreview(false);
      }, PREVIEW_DEBOUNCE_MS);

      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    }, [value, showPreview, context]);

    // Calculate min-height for multiline based on rows
    const minHeight = multiline && rows ? `${rows * 24 + 16}px` : undefined;

    // Build container classes matching shadcn/ui input/textarea styling
    const containerClasses = cn(
      // Base styles
      "w-full rounded-md border bg-transparent shadow-xs transition-[color,box-shadow]",

      // Single-line vs multi-line
      multiline ? "min-h-16" : "h-9",

      // Border and background
      "border-input",
      "dark:bg-input/30",

      // Focus state
      isFocused && ["border-ring", "ring-ring/50", "ring-[3px]"],

      // Drag-over state (highlight as drop target)
      isDragOver && [
        "border-primary",
        "ring-primary/50",
        "ring-[3px]",
        "bg-primary/5",
      ],

      // Error state
      error && [
        "border-destructive",
        "ring-destructive/20",
        "dark:ring-destructive/40",
      ],

      // Disabled state
      disabled && "cursor-not-allowed opacity-50",

      className,
    );

    return (
      <div ref={ref} className="relative">
        <div className={containerClasses} style={{ minHeight }}>
          <Editor
            value={value}
            onChange={onChange}
            expressionContext={context}
            placeholder={placeholder}
            disabled={disabled}
            multiline={multiline}
            extensions={extensions}
            onFocus={handleFocus}
            onBlur={handleBlur}
            acceptDrop={acceptDrop}
            onDragOverChange={handleDragOverChange}
          />
        </div>

        {/* Live preview display */}
        {showPreview && preview && (
          <PreviewBadge preview={preview} isResolving={isResolvingPreview} />
        )}

        {/* Error message display */}
        {error && <p className="text-destructive mt-1.5 text-sm">{error}</p>}
      </div>
    );
  },
);

/**
 * Preview badge component showing resolved value
 */
function PreviewBadge({
  preview,
  isResolving,
}: {
  preview: PreviewResult;
  isResolving: boolean;
}) {
  // Type badge colors
  const typeColors: Record<PreviewResult["type"], string> = {
    string: "bg-green-500/10 text-green-600 dark:text-green-400",
    number: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    boolean: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    object: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    array: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    null: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
    undefined: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  };

  // Type labels
  const typeLabels: Record<PreviewResult["type"], string> = {
    string: "str",
    number: "num",
    boolean: "bool",
    object: "obj",
    array: "arr",
    null: "null",
    undefined: "?",
  };

  if (!preview.success) {
    return (
      <div className="mt-1 flex items-center gap-1.5">
        <span className="bg-destructive/10 text-destructive rounded px-1.5 py-0.5 text-xs font-medium">
          error
        </span>
        <span className="text-muted-foreground text-xs truncate">
          {preview.error}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-1.5">
      {isResolving ? (
        <span className="bg-muted text-muted-foreground animate-pulse rounded px-1.5 py-0.5 text-xs">
          resolving...
        </span>
      ) : (
        <>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-xs font-medium",
              typeColors[preview.type],
            )}
          >
            {typeLabels[preview.type]}
          </span>
          <span className="text-muted-foreground text-xs truncate font-mono">
            {formatPreviewValue(preview.value)}
          </span>
        </>
      )}
    </div>
  );
}

// Re-export types for convenience
export type { EditorProps } from "./editor";

/**
 * Type map for converting domain types to display badges.
 */
const TYPE_BADGE_MAP: Record<string, string> = {
  string: "str",
  number: "num",
  boolean: "bool",
  json: "obj",
  object: "obj",
  array: "arr",
};

/**
 * Domain-specific variable type (from plugin system or routine editor).
 */
interface DomainVariable {
  name: string;
  type?: string;
  value?: unknown;
  description?: string;
}

/**
 * Domain-specific node type (from plugin system or routine editor).
 */
interface DomainNode {
  id: string;
  label?: string;
  /** Any domain-specific field (e.g., pluginId) */
  [key: string]: unknown;
  outputs?: string[];
}

/**
 * Domain-specific expression context (from plugin system or routine editor).
 * This is the format that domain code uses before conversion.
 */
export interface DomainExpressionContext {
  variables?: DomainVariable[];
  upstreamNodes?: DomainNode[];
  hasTrigger?: boolean;
  /** Additional root completion sources */
  additionalSources?: CompletionItem[];
}

/**
 * Convert a domain-specific expression context to the generic tree format.
 *
 * This helper allows consumers (plugins, routine editor) to work with their
 * domain-specific types while using the ExpressionInput component's generic
 * tree-based completion system.
 *
 * @param domain - Domain-specific context with variables, nodes, etc.
 * @returns Generic ExpressionContext with tree-based completions
 *
 * @example
 * ```tsx
 * // In plugin config UI:
 * const uiContext = buildExpressionContext({
 *   variables: routineVariables,
 *   upstreamNodes: upstreamNodes,
 *   hasTrigger: true,
 * });
 *
 * <ExpressionInput context={uiContext} ... />
 * ```
 */
export function buildExpressionContext(
  domain: DomainExpressionContext | undefined,
): ExpressionContext | undefined {
  if (!domain) return undefined;

  const completions: CompletionItem[] = [];

  // Convert variables to completion tree
  if (domain.variables && domain.variables.length > 0) {
    completions.push({
      name: "vars",
      detail: "Variables",
      info: "Access routine-level variables",
      children: domain.variables.map((v) => ({
        name: v.name,
        type: TYPE_BADGE_MAP[v.type ?? ""] ?? v.type,
        detail: v.description,
        value: v.value,
      })),
    });
  }

  // Convert upstream nodes to completion tree
  if (domain.upstreamNodes && domain.upstreamNodes.length > 0) {
    completions.push({
      name: "nodes",
      detail: "Node outputs",
      info: `Access outputs from ${domain.upstreamNodes.length} upstream node(s)`,
      children: domain.upstreamNodes.map((node) => ({
        name: node.id,
        // Use label if available, otherwise use a generic detail
        detail: (node.label as string) ?? "Node",
        children: (node.outputs ?? []).map((output) => ({
          name: output,
          detail: "output",
        })),
      })),
    });
  }

  // Add trigger source if available
  if (domain.hasTrigger) {
    completions.push({
      name: "trigger",
      detail: "Trigger data",
      info: "Access data from the routine trigger",
      children: [
        { name: "payload", type: "obj", detail: "Trigger payload data" },
        { name: "type", type: "str", detail: "Trigger type" },
      ],
    });
  }

  // Always add execution context
  completions.push({
    name: "execution",
    detail: "Execution context",
    info: "Access execution metadata (id, routineId, startedAt)",
    children: [
      { name: "id", type: "str", detail: "Unique execution ID" },
      { name: "routineId", type: "str", detail: "ID of the routine" },
      { name: "startedAt", type: "num", detail: "Start timestamp (ms)" },
    ],
  });

  // Add any additional custom sources
  if (domain.additionalSources) {
    completions.push(...domain.additionalSources);
  }

  return { completions };
}
