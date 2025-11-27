"use client";

/**
 * CodeMirror 6 EditorView wrapper for React.
 *
 * Handles the low-level integration between React and CodeMirror:
 * - Creates and destroys EditorView on mount/unmount
 * - Syncs value changes between React state and editor
 * - Applies extensions and configuration
 * - Provides autocomplete for expressions
 */

import { useEffect, useRef, useCallback, useMemo } from "react";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, placeholder as placeholderExt } from "@codemirror/view";
import { autocompletion } from "@codemirror/autocomplete";
import { expressionLanguage } from "../../lib/expression-language";
import { expressionHighlight } from "../../lib/expression-highlight";
import { getExpressionInputTheme } from "./theme";
import { createExpressionCompletionSource } from "./completions";
import type { ExpressionContext } from "./index";

export interface EditorProps {
  /** Current value */
  value: string;
  /** Called when value changes */
  onChange: (value: string) => void;
  /** Expression context for autocomplete suggestions */
  expressionContext?: ExpressionContext;
  /** Placeholder text when empty */
  placeholder?: string;
  /** Whether the editor is disabled */
  disabled?: boolean;
  /** Whether to allow multiple lines */
  multiline?: boolean;
  /** Additional extensions to apply */
  extensions?: Extension[];
  /** Called when editor gains focus */
  onFocus?: () => void;
  /** Called when editor loses focus */
  onBlur?: () => void;
  /** CSS class for the container */
  className?: string;
}

/**
 * Low-level CodeMirror editor component.
 *
 * This component manages the CodeMirror EditorView lifecycle and
 * synchronizes with React state. Use ExpressionInput for the
 * higher-level component with full styling.
 */
export function Editor({
  value,
  onChange,
  expressionContext,
  placeholder,
  disabled = false,
  multiline = false,
  extensions: additionalExtensions = [],
  onFocus,
  onBlur,
  className,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const isInternalUpdate = useRef(false);
  const expressionContextRef = useRef(expressionContext);

  // Keep refs updated
  onChangeRef.current = onChange;
  expressionContextRef.current = expressionContext;

  // Create autocomplete extension with context-aware completions
  const autocompleteExtension = useMemo(
    () =>
      autocompletion({
        override: [
          createExpressionCompletionSource(() => expressionContextRef.current),
        ],
        activateOnTyping: true,
        maxRenderedOptions: 20,
      }),
    [],
  );

  // Create update listener extension
  const updateListener = useCallback(
    () =>
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !isInternalUpdate.current) {
          const newValue = update.state.doc.toString();
          onChangeRef.current(newValue);
        }
      }),
    [],
  );

  // Create focus/blur event handlers
  const focusHandlers = useCallback(
    () =>
      EditorView.domEventHandlers({
        focus: () => {
          onFocus?.();
          return false;
        },
        blur: () => {
          onBlur?.();
          return false;
        },
      }),
    [onFocus, onBlur],
  );

  // Single-line mode: prevent Enter from inserting newlines
  const singleLineExtension = useCallback(
    () =>
      EditorView.domEventHandlers({
        keydown: (event) => {
          if (!multiline && event.key === "Enter") {
            event.preventDefault();
            return true;
          }
          return false;
        },
      }),
    [multiline],
  );

  // Read-only extension for disabled state
  const readOnlyExtension = useCallback(
    () => EditorState.readOnly.of(disabled),
    [disabled],
  );

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;

    const extensions: Extension[] = [
      // Core language support
      expressionLanguage,
      expressionHighlight,

      // Autocomplete
      autocompleteExtension,

      // Theme
      ...getExpressionInputTheme(multiline),

      // Placeholder
      ...(placeholder ? [placeholderExt(placeholder)] : []),

      // Event handlers
      updateListener(),
      focusHandlers(),
      singleLineExtension(),
      readOnlyExtension(),

      // Additional extensions from props
      ...additionalExtensions,
    ];

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only recreate on mount/unmount and when multiline/disabled change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiline, disabled]);

  // Sync external value changes to editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentValue = view.state.doc.toString();
    if (currentValue !== value) {
      isInternalUpdate.current = true;
      view.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
      });
      isInternalUpdate.current = false;
    }
  }, [value]);

  return <div ref={containerRef} className={className} />;
}
