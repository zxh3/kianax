"use client";

/**
 * ExpressionInput Component
 *
 * A drop-in replacement for Input/Textarea that provides expression-aware
 * editing with syntax highlighting for {{ expression }} patterns.
 *
 * Features:
 * - Syntax highlighting for expressions ({{ vars.*, nodes.*, etc. }})
 * - Single-line and multi-line modes
 * - Matches shadcn/ui Input and Textarea styling
 * - Supports placeholder, disabled states
 * - Future: autocomplete, live preview
 *
 * Usage:
 * ```tsx
 * <ExpressionInput
 *   value={url}
 *   onChange={setUrl}
 *   placeholder="Enter URL with {{ vars.baseUrl }}"
 * />
 * ```
 */

import { forwardRef, useState, useCallback } from "react";
import type { Extension } from "@codemirror/state";
import { cn } from "../../lib/utils";
import { Editor } from "./editor";

/**
 * Available variable context for autocomplete suggestions.
 * This will be expanded in Phase 4.2 for autocomplete functionality.
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

  /** Expression context for autocomplete suggestions (Phase 4.2) */
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
export const ExpressionInput = forwardRef<HTMLDivElement, ExpressionInputProps>(
  function ExpressionInput(
    {
      value,
      onChange,
      context: _context, // Reserved for Phase 4.2
      showPreview: _showPreview, // Reserved for Phase 4.4
      previewContext: _previewContext, // Reserved for Phase 4.4
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

    const handleFocus = useCallback(() => {
      setIsFocused(true);
      onFocus?.();
    }, [onFocus]);

    const handleBlur = useCallback(() => {
      setIsFocused(false);
      onBlur?.();
    }, [onBlur]);

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
            placeholder={placeholder}
            disabled={disabled}
            multiline={multiline}
            extensions={extensions}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        </div>

        {/* Error message display */}
        {error && <p className="text-destructive mt-1.5 text-sm">{error}</p>}
      </div>
    );
  },
);

// Re-export types for convenience
export type { EditorProps } from "./editor";
