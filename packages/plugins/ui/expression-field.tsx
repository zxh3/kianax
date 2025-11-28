"use client";

/**
 * ExpressionField Component
 *
 * A wrapper around ExpressionInput that integrates with the plugin config UI
 * system. Provides expression-aware input with autocomplete for routine
 * variables and upstream node outputs.
 *
 * Features:
 * - Syntax highlighting for {{ expression }} patterns
 * - Autocomplete suggestions when typing {{
 * - Live preview of resolved values
 * - Collapsible data picker for browsing available data
 * - Drag & drop from data picker to input
 * - Click to insert expressions
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

import { useState, useCallback, useRef } from "react";
import {
  ExpressionInput,
  buildExpressionContext,
} from "@kianax/ui/components/expression-input";
import { ExpressionDataPicker } from "@kianax/ui/components/expression-data-picker";
import { Button } from "@kianax/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@kianax/ui/components/collapsible";
import { IconChevronDown, IconDatabase } from "@tabler/icons-react";
import { cn } from "@kianax/ui/lib/utils";
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
  /** Show variable picker by default */
  defaultShowVariablePicker?: boolean;
  /** Hide the variable picker toggle entirely */
  hideVariablePicker?: boolean;
}

/**
 * Expression-aware field for plugin configuration.
 *
 * Drop-in replacement for Input/Textarea in plugin config UIs that adds
 * autocomplete for {{ vars.* }}, {{ nodes.* }}, etc.
 *
 * Includes an optional collapsible data picker for browsing and selecting
 * available expression data via drag & drop or click.
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
  defaultShowVariablePicker = false,
  hideVariablePicker = true,
}: ExpressionFieldProps) {
  const [isVariablePickerOpen, setIsVariablePickerOpen] = useState(
    defaultShowVariablePicker,
  );
  const inputRef = useRef<HTMLDivElement>(null);

  // Convert domain-specific context to generic tree format
  // Preview values are derived from the `value` fields in the context
  const uiContext = buildExpressionContext(expressionContext);

  // Handle click-to-insert from data picker
  const handleSelectPath = useCallback(
    (path: string) => {
      // Insert the expression at the end (or could be at cursor position)
      const expression = `{{ ${path} }}`;
      // If the current value is empty or ends with space, just append
      // Otherwise, add a space before the expression
      const needsSpace = value.length > 0 && !value.endsWith(" ");
      onChange(value + (needsSpace ? " " : "") + expression);
    },
    [value, onChange],
  );

  // Check if we have any data to show in the picker
  const hasExpressionData =
    expressionContext &&
    ((expressionContext.variables && expressionContext.variables.length > 0) ||
      (expressionContext.upstreamNodes &&
        expressionContext.upstreamNodes.length > 0) ||
      expressionContext.hasTrigger);

  // Show data picker toggle only if we have context and it's not hidden
  const showVariablePickerToggle = !hideVariablePicker && hasExpressionData;

  return (
    <ConfigSection
      label={label}
      description={description}
      error={error}
      action={
        action ||
        (showVariablePickerToggle ? (
          <Collapsible
            open={isVariablePickerOpen}
            onOpenChange={setIsVariablePickerOpen}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <IconDatabase className="size-3.5" />
                Variables
                <IconChevronDown
                  className={cn(
                    "size-3 transition-transform duration-200",
                    isVariablePickerOpen && "rotate-180",
                  )}
                />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        ) : undefined)
      }
    >
      <div className="space-y-2">
        <ExpressionInput
          ref={inputRef}
          value={value}
          onChange={onChange}
          context={uiContext}
          showPreview={showPreview && !!expressionContext}
          multiline={multiline}
          rows={rows}
          placeholder={placeholder}
          error={error}
          className={className}
          acceptDrop={hasExpressionData}
        />

        {/* Collapsible data picker */}
        {showVariablePickerToggle && uiContext && (
          <Collapsible
            open={isVariablePickerOpen}
            onOpenChange={setIsVariablePickerOpen}
          >
            <CollapsibleContent>
              <div className="pt-2">
                <ExpressionDataPicker
                  context={uiContext}
                  onSelect={handleSelectPath}
                  draggable
                  showSearch
                  searchPlaceholder="Search variables and nodes..."
                  maxHeight={240}
                  className="border-dashed"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Click to insert or drag to the input field above
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </ConfigSection>
  );
}
