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
 *     variables: [{ name: "baseUrl", type: "string", value: "https://api.example.com" }],
 *     upstreamNodes: [{ id: "http_1", label: "HTTP Request", pluginId: "http-request", outputs: ["success", "error"] }],
 *   }}
 *   showPreview
 *   previewContext={{
 *     vars: { baseUrl: "https://api.example.com" },
 *   }}
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
 * Available variable context for autocomplete suggestions.
 */
export interface ExpressionContext {
  /** Available routine variables */
  variables?: Array<{
    name: string;
    type: "string" | "number" | "boolean" | "json";
    value?: unknown;
    description?: string;
  }>;

  /** Upstream nodes with their output ports */
  upstreamNodes?: Array<{
    id: string;
    label: string;
    pluginId: string;
    outputs: string[];
  }>;

  /** Whether trigger context is available */
  hasTrigger?: boolean;
}

/**
 * Context for resolving preview values.
 * Used to show live preview of resolved expressions.
 */
export interface PreviewContext {
  vars?: Record<string, unknown>;
  nodes?: Record<string, Record<string, unknown>>;
  trigger?: unknown;
  execution?: { id: string; routineId: string; startedAt: number };
}

export interface ExpressionInputProps {
  /** Current value (may contain {{ expressions }}) */
  value: string;
  /** Called when value changes */
  onChange: (value: string) => void;

  /** Expression context for autocomplete suggestions */
  context?: ExpressionContext;

  /** Show live preview of resolved value (Phase 4.4) */
  showPreview?: boolean;
  /** Context for resolving preview (Phase 4.4) */
  previewContext?: PreviewContext;

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
      previewContext,
      multiline = false,
      rows,
      placeholder,
      disabled = false,
      className,
      error,
      extensions,
      onFocus,
      onBlur,
    },
    ref,
  ) {
    const [isFocused, setIsFocused] = useState(false);
    const [preview, setPreview] = useState<PreviewResult | null>(null);
    const [isResolvingPreview, setIsResolvingPreview] = useState(false);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (!showPreview || !previewContext) {
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

      // Debounce the resolution
      debounceTimerRef.current = setTimeout(() => {
        const result = resolvePreview(value, {
          vars: previewContext.vars ?? {},
          nodes: previewContext.nodes ?? {},
          trigger: previewContext.trigger,
          execution: previewContext.execution,
        });
        setPreview(result);
        setIsResolvingPreview(false);
      }, PREVIEW_DEBOUNCE_MS);

      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    }, [value, showPreview, previewContext]);

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
