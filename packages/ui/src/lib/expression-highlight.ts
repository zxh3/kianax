/**
 * CodeMirror 6 syntax highlighting styles for expression syntax.
 *
 * Uses shadcn/ui CSS variables for consistent theming.
 * Works with both light and dark modes automatically.
 */

import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/**
 * Highlight style mapping CodeMirror tags to CSS styles.
 *
 * Token types from expression-language.ts:
 * - brace: {{ and }}
 * - keyword: vars, nodes, trigger, execution
 * - variableName: identifiers
 * - punctuation: dots
 * - squareBracket: [ and ]
 * - number: array indices
 * - invalid: unknown characters inside expressions
 */
export const expressionHighlightStyle = HighlightStyle.define([
  {
    tag: tags.brace,
    color: "hsl(var(--primary))",
    fontWeight: "600",
  },
  {
    tag: tags.keyword,
    color: "hsl(var(--chart-1))",
    fontWeight: "500",
  },
  {
    tag: tags.variableName,
    color: "hsl(var(--foreground))",
  },
  {
    tag: tags.punctuation,
    color: "hsl(var(--muted-foreground))",
  },
  {
    tag: tags.squareBracket,
    color: "hsl(var(--primary))",
  },
  {
    tag: tags.number,
    color: "hsl(var(--chart-4))",
  },
  {
    tag: tags.invalid,
    color: "hsl(var(--destructive))",
    textDecoration: "underline wavy",
  },
]);

/**
 * Syntax highlighting extension for CodeMirror.
 *
 * Usage:
 * ```typescript
 * import { expressionHighlight } from "./expression-highlight";
 *
 * const extensions = [expressionHighlight];
 * ```
 */
export const expressionHighlight = syntaxHighlighting(expressionHighlightStyle);
