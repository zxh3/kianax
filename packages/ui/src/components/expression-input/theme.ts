/**
 * CodeMirror 6 theme that matches shadcn/ui design system.
 *
 * Uses CSS variables for colors to support both light and dark modes.
 * Styled to match the Input and Textarea components.
 */

import { EditorView } from "@codemirror/view";

/**
 * Base theme for the editor container and content.
 * Matches shadcn/ui input styling.
 */
export const shadcnBaseTheme = EditorView.theme({
  // Root container
  "&": {
    fontSize: "14px",
    backgroundColor: "transparent",
  },

  // Focused state - matches input focus ring
  "&.cm-focused": {
    outline: "none",
  },

  // Content area
  ".cm-content": {
    fontFamily: "inherit",
    caretColor: "hsl(var(--foreground))",
  },

  // Individual lines
  ".cm-line": {
    padding: "0",
  },

  // Cursor
  ".cm-cursor": {
    borderLeftColor: "hsl(var(--foreground))",
    borderLeftWidth: "2px",
  },

  // Selection
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "hsl(var(--primary) / 0.2)",
  },

  // Active line highlight (subtle)
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },

  // Gutters (line numbers) - hidden by default
  ".cm-gutters": {
    display: "none",
  },

  // Scrollbar styling
  ".cm-scroller": {
    fontFamily: "inherit",
    lineHeight: "1.5",
  },

  // Placeholder text
  ".cm-placeholder": {
    color: "hsl(var(--muted-foreground))",
    fontStyle: "normal",
  },
});

/**
 * Single-line input theme.
 * Styled to match shadcn/ui Input component.
 */
export const singleLineTheme = EditorView.theme({
  "&": {
    height: "36px", // h-9 = 36px
  },
  ".cm-scroller": {
    overflow: "hidden",
  },
  ".cm-content": {
    padding: "6px 12px", // py-1.5 px-3
    minHeight: "36px",
    display: "flex",
    alignItems: "center",
  },
  ".cm-line": {
    lineHeight: "24px",
  },
});

/**
 * Multi-line textarea theme.
 * Styled to match shadcn/ui Textarea component.
 */
export const multiLineTheme = EditorView.theme({
  "&": {
    minHeight: "64px", // min-h-16
  },
  ".cm-scroller": {
    overflow: "auto",
  },
  ".cm-content": {
    padding: "8px 12px", // py-2 px-3
  },
});

/**
 * Autocomplete dropdown styling.
 * Matches shadcn/ui popover/dropdown styling.
 */
export const autocompleteTheme = EditorView.theme({
  ".cm-tooltip": {
    backgroundColor: "hsl(var(--popover))",
    color: "hsl(var(--popover-foreground))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "calc(var(--radius) - 2px)",
    boxShadow:
      "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    overflow: "hidden",
  },

  ".cm-tooltip-autocomplete": {
    "& > ul": {
      fontFamily: "inherit",
      maxHeight: "300px",
      maxWidth: "400px",
    },
    "& > ul > li": {
      padding: "6px 8px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
    },
    "& > ul > li[aria-selected]": {
      backgroundColor: "hsl(var(--accent))",
      color: "hsl(var(--accent-foreground))",
    },
  },

  // Completion item parts
  ".cm-completionLabel": {
    flex: "1",
  },
  ".cm-completionDetail": {
    fontSize: "12px",
    color: "hsl(var(--muted-foreground))",
    marginLeft: "auto",
  },
  ".cm-completionMatchedText": {
    fontWeight: "600",
    color: "hsl(var(--primary))",
  },
});

/**
 * Combined theme with all styles.
 */
export function getExpressionInputTheme(multiline: boolean) {
  return [
    shadcnBaseTheme,
    multiline ? multiLineTheme : singleLineTheme,
    autocompleteTheme,
  ];
}
