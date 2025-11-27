/**
 * CodeMirror 6 StreamLanguage definition for Kianax expression syntax.
 *
 * Tokenizes {{ expression }} patterns within text:
 * - {{ and }} are marked as braces
 * - vars, nodes, trigger, execution are keywords
 * - Identifiers, dots, brackets are styled accordingly
 * - Text outside expressions is left unstyled
 */

import { StreamLanguage, type StringStream } from "@codemirror/language";

interface ExpressionState {
  /** Whether we're currently inside an expression {{ ... }} */
  inExpression: boolean;
}

/**
 * Custom tokenizer for expression syntax.
 *
 * Returns CodeMirror token tags that map to highlight styles.
 */
function tokenize(stream: StringStream, state: ExpressionState): string | null {
  // Match opening braces
  if (stream.match("{{")) {
    state.inExpression = true;
    return "brace";
  }

  // Match closing braces
  if (stream.match("}}")) {
    state.inExpression = false;
    return "brace";
  }

  // Inside expression: highlight tokens
  if (state.inExpression) {
    // Skip whitespace
    if (stream.match(/\s+/)) {
      return null;
    }

    // Source keywords
    if (stream.match(/vars|nodes|trigger|execution/)) {
      return "keyword";
    }

    // Dot separator
    if (stream.match(".")) {
      return "punctuation";
    }

    // Array access brackets
    if (stream.match("[")) {
      return "squareBracket";
    }
    if (stream.match("]")) {
      return "squareBracket";
    }

    // Numeric indices
    if (stream.match(/\d+/)) {
      return "number";
    }

    // Identifiers (variable names, node IDs, port names)
    // Allow hyphens in identifiers for node IDs like "http-request_1"
    if (stream.match(/[a-zA-Z_][a-zA-Z0-9_-]*/)) {
      return "variableName";
    }

    // Unknown character inside expression - skip it
    stream.next();
    return "invalid";
  }

  // Outside expression: plain text (no highlighting)
  // Consume characters until we hit {{ or end of line
  while (!stream.eol()) {
    if (stream.match("{{", false)) {
      // Don't consume the {{, let next call handle it
      break;
    }
    stream.next();
  }
  return null;
}

/**
 * CodeMirror StreamLanguage for expression syntax.
 *
 * Usage:
 * ```typescript
 * import { expressionLanguage } from "./expression-language";
 *
 * const extensions = [expressionLanguage];
 * ```
 */
export const expressionLanguage = StreamLanguage.define<ExpressionState>({
  name: "expression",
  token: tokenize,
  startState(): ExpressionState {
    return { inExpression: false };
  },
});

/**
 * Check if a string contains expression syntax.
 */
export function containsExpression(text: string): boolean {
  return /\{\{.*?\}\}/.test(text);
}

/**
 * Extract all expression strings from text.
 */
export function extractExpressions(text: string): string[] {
  const matches = text.match(/\{\{.*?\}\}/g);
  return matches ?? [];
}
