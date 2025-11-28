"use client";

/**
 * ExpressionField Component
 *
 * A wrapper around ExpressionInput that integrates with the plugin config UI
 * system. Provides expression-aware input with autocomplete for routine
 * variables and upstream node outputs.
 *
 * Usage:
 * ```tsx
 * <ExpressionField
 *   label="URL"
 *   description="API endpoint. Supports {{ vars.* }} and {{ nodes.* }}"
 *   value={config.url}
 *   onChange={(url) => handleChange({ url })}
 *   expressionContext={expressionContext}
 *   placeholder="https://api.example.com"
 * />
 * ```
 */

import {
  ExpressionInput,
  buildExpressionContext,
} from "@kianax/ui/components/expression-input";
import { ConfigSection } from "./config-section";
import type { ExpressionContext } from "../config-registry";

interface ExpressionFieldProps {
  /** Field label */
  label: string;
  /** Field description (supports expression syntax hints) */
  description?: string;
  /** Current value (may contain {{ expressions }}) */
  value: string;
  /** Called when value changes */
  onChange: (value: string) => void;
  /** Expression context for autocomplete (from plugin config props) */
  expressionContext?: ExpressionContext;
  /** Multi-line mode (renders as textarea) */
  multiline?: boolean;
  /** Number of rows for multiline */
  rows?: number;
  /** Placeholder text */
  placeholder?: string;
  /** Validation error message */
  error?: string;
  /** Show live preview of resolved value */
  showPreview?: boolean;
  /** Additional CSS class */
  className?: string;
  /** Action button (e.g., "Format JSON") */
  action?: React.ReactNode;
}

/**
 * Expression-aware field for plugin configuration.
 *
 * Drop-in replacement for Input/Textarea in plugin config UIs that adds
 * autocomplete for {{ vars.* }}, {{ nodes.* }}, etc.
 */
export function ExpressionField({
  label,
  description,
  value,
  onChange,
  expressionContext,
  multiline = false,
  rows,
  placeholder,
  error,
  showPreview = true,
  className,
  action,
}: ExpressionFieldProps) {
  // Convert domain-specific context to generic tree format
  // Preview values are derived from the `value` fields in the context
  const uiContext = buildExpressionContext(expressionContext);

  return (
    <ConfigSection
      label={label}
      description={description}
      error={error}
      action={action}
    >
      <ExpressionInput
        value={value}
        onChange={onChange}
        context={uiContext}
        showPreview={showPreview && !!expressionContext}
        multiline={multiline}
        rows={rows}
        placeholder={placeholder}
        error={error}
        className={className}
      />
    </ConfigSection>
  );
}
