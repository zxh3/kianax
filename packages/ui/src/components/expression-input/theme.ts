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
    fontSize: "12px", // text-xs
    backgroundColor: "transparent",
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
  },

  // Focused state - matches input focus ring
  "&.cm-focused": {
    outline: "none",
  },

  // Content area
  ".cm-content": {
    fontFamily: "inherit",
    caretColor: "var(--foreground)",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },

  // Individual lines
  ".cm-line": {
    padding: "0",
  },

  // Cursor
  ".cm-cursor": {
    borderLeftColor: "var(--foreground)",
    borderLeftWidth: "2px",
  },

  // Selection
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "oklch(from var(--primary) l c h / 0.2)",
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
    maxWidth: "100%",
  },

  // Placeholder text
  ".cm-placeholder": {
    color: "var(--muted-foreground)",
    fontStyle: "normal",
  },
});

/**
 * Single-line input theme.
 * Styled to match shadcn/ui Input component but allows text wrapping.
 */
export const singleLineTheme = EditorView.theme({
  "&": {
    minHeight: "36px", // h-9 = 36px
  },
  "& .cm-scroller": {
    // overflow: "hidden", // Removed to allow scrolling/wrapping if needed
    // alignItems: "center", // Removed to allow multiline alignment
  },
  ".cm-content": {
    padding: "8px 12px", // py-2 px-3, same as multiline for consistency when wrapping
  },
  ".cm-line": {
    // lineHeight: "31.5px", // Removed fixed line height
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
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    boxShadow:
      "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    overflow: "hidden",
    zIndex: "50",
  },

  ".cm-tooltip-autocomplete": {
    "& > ul": {
      fontFamily: "inherit",
      maxHeight: "300px",
      maxWidth: "400px",
      padding: "4px",
      margin: "0",
      listStyle: "none",
      backgroundColor: "var(--popover)",
    },
    "& > ul > li": {
      padding: "8px 12px",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      borderRadius: "calc(var(--radius) - 4px)",
      cursor: "pointer",
    },
    "& > ul > li[aria-selected]": {
      backgroundColor: "var(--accent)",
      color: "var(--accent-foreground)",
    },
  },

  // Completion item parts
  ".cm-completionLabel": {
    flex: "1",
    fontWeight: "500",
  },
  ".cm-completionDetail": {
    fontSize: "12px",
    color: "var(--muted-foreground)",
    marginLeft: "auto",
    fontStyle: "italic",
  },
  ".cm-completionMatchedText": {
    fontWeight: "600",
    color: "var(--primary)",
  },
  // Hide the default completion icon
  ".cm-completionIcon": {
    display: "none",
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
