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
  /** Accept drag & drop of expression paths */
  acceptDrop?: boolean;
  /** Called when drag-over state changes */
  onDragOverChange?: (isDragOver: boolean) => void;
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
  acceptDrop = false,
  onDragOverChange,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const isInternalUpdate = useRef(false);
  const expressionContextRef = useRef(expressionContext);
  const onDragOverChangeRef = useRef(onDragOverChange);

  // Keep refs updated
  onDragOverChangeRef.current = onDragOverChange;

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

  // Drag & drop handlers for accepting expression paths
  const dragDropHandlers = useCallback(
    () =>
      EditorView.domEventHandlers({
        dragover: (event, view) => {
          if (!acceptDrop) return false;

          // Check if this is an expression path drag
          const hasExpressionData = event.dataTransfer?.types.includes(
            "application/x-expression-path",
          );
          if (!hasExpressionData) return false;

          event.preventDefault();
          event.dataTransfer!.dropEffect = "copy";
          onDragOverChangeRef.current?.(true);

          // Focus the editor to show the cursor
          if (!view.hasFocus) {
            view.focus();
          }

          // Move cursor to drop position
          const pos = view.posAtCoords({
            x: event.clientX,
            y: event.clientY,
          });
          if (pos !== null) {
            view.dispatch({
              selection: { anchor: pos },
            });
          }

          return true;
        },
        dragleave: () => {
          if (!acceptDrop) return false;
          onDragOverChangeRef.current?.(false);
          return false;
        },
        drop: (event, view) => {
          if (!acceptDrop) return false;

          const expressionPath = event.dataTransfer?.getData(
            "application/x-expression-path",
          );
          if (!expressionPath) return false;

          event.preventDefault();
          onDragOverChangeRef.current?.(false);

          // Insert expression at cursor/drop position
          const pos = view.posAtCoords({
            x: event.clientX,
            y: event.clientY,
          });
          if (pos !== null) {
            const insertion = `{{ ${expressionPath} }}`;
            view.dispatch({
              changes: { from: pos, insert: insertion },
              selection: { anchor: pos + insertion.length },
            });
          }

          return true;
        },
      }),
    [acceptDrop],
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
      dragDropHandlers(),

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
    // Only recreate on mount/unmount and when multiline/disabled/acceptDrop change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiline, disabled, acceptDrop]);

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
