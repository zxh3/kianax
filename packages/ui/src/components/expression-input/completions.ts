/**
 * CodeMirror 6 autocomplete completion source for expression syntax.
 *
 * Provides context-aware suggestions when the user types {{ in the editor.
 * Traverses a generic tree of CompletionItem nodes to provide suggestions
 * at any nesting level.
 *
 * The completion source is agnostic to what the items represent - it simply
 * traverses the tree structure provided in the ExpressionContext.
 */

import type {
  CompletionContext,
  CompletionResult,
  Completion,
} from "@codemirror/autocomplete";
import type { ExpressionContext, CompletionItem } from "./index";

/**
 * Create a completion source function for expression autocomplete.
 *
 * @param getContext - Function that returns the current expression context.
 *                     Called on each completion request to get fresh data.
 */
export function createExpressionCompletionSource(
  getContext: () => ExpressionContext | undefined,
) {
  return function expressionCompletionSource(
    ctx: CompletionContext,
  ): CompletionResult | null {
    const expressionContext = getContext();

    // Find the start of the current expression
    const line = ctx.state.doc.lineAt(ctx.pos);
    const lineText = line.text;
    const posInLine = ctx.pos - line.from;

    // Look for {{ before the cursor
    const beforeCursor = lineText.slice(0, posInLine);
    const lastOpenBrace = beforeCursor.lastIndexOf("{{");

    // Not inside an expression
    if (lastOpenBrace === -1) {
      return null;
    }

    // Check if there's a closing }} between {{ and cursor
    const betweenBraces = beforeCursor.slice(lastOpenBrace + 2);
    if (betweenBraces.includes("}}")) {
      return null;
    }

    // We're inside an expression - get the text after {{
    const expressionText = betweenBraces.trimStart();
    const expressionStart =
      line.from +
      lastOpenBrace +
      2 +
      (betweenBraces.length - betweenBraces.trimStart().length);

    // Parse the expression path
    const path = expressionText.split(".");

    // Get completions by traversing the tree
    const completions = getCompletionsForPath(
      expressionContext?.completions ?? [],
      path,
    );

    if (completions.length === 0) {
      return null;
    }

    // Calculate the range to replace
    // If we're in the middle of typing a word, replace from the start of that word
    const lastDot = expressionText.lastIndexOf(".");
    const replaceFrom =
      lastDot >= 0 ? expressionStart + lastDot + 1 : expressionStart;

    return {
      from: replaceFrom,
      options: completions,
      validFor: /^[a-zA-Z_][a-zA-Z0-9_-]*$/,
    };
  };
}

/**
 * Get completions for a given path by traversing the completion tree.
 *
 * @param items - The completion items at the current level
 * @param path - The path segments typed so far (e.g., ["vars", "config", ""])
 */
function getCompletionsForPath(
  items: CompletionItem[],
  path: string[],
): Completion[] {
  // At root level - show all root items
  const rootPrefix = path[0] ?? "";
  if (path.length === 0 || (path.length === 1 && !rootPrefix.includes("."))) {
    return items
      .filter((item) => item.name.startsWith(rootPrefix))
      .map((item) => toCompletion(item, "keyword", 10));
  }

  // Navigate to the correct level in the tree
  const [firstSegment, ...remainingPath] = path;
  const currentItem = items.find((item) => item.name === firstSegment);

  if (!currentItem) {
    return [];
  }

  // If we're at the end of the path (user just typed a dot), show children
  if (
    remainingPath.length === 0 ||
    (remainingPath.length === 1 && remainingPath[0] === "")
  ) {
    return getChildCompletions(currentItem);
  }

  // Continue traversing for deeper paths
  return getCompletionsFromItem(currentItem, remainingPath);
}

/**
 * Get completions from a single item, navigating through its children or value.
 */
function getCompletionsFromItem(
  item: CompletionItem,
  path: string[],
): Completion[] {
  // If we have one segment left and it's empty, show children at current level
  if (path.length === 1 && path[0] === "") {
    return getChildCompletions(item);
  }

  // Try to find matching child
  const segment = path[0];
  const remaining = path.slice(1);

  if (!segment) {
    return [];
  }

  // First check static children
  if (item.children) {
    const child = item.children.find((c) => c.name === segment);
    if (child) {
      if (remaining.length === 0 || (remaining.length === 1 && !remaining[0])) {
        return getChildCompletions(child);
      }
      return getCompletionsFromItem(child, remaining);
    }
  }

  // Then check dynamic value (for runtime introspection)
  if (item.value !== undefined && item.value !== null) {
    const nestedValue = getNestedValue(item.value, [segment]);
    if (nestedValue !== undefined && isPlainObject(nestedValue)) {
      // Navigate deeper if needed
      if (remaining.length > 0 && remaining[0] !== "") {
        const deeperValue = getNestedValue(nestedValue, remaining.slice(0, -1));
        if (deeperValue !== undefined && isPlainObject(deeperValue)) {
          return objectKeysToCompletions(deeperValue);
        }
      }
      return objectKeysToCompletions(nestedValue);
    }
  }

  return [];
}

/**
 * Get child completions for an item (from static children or dynamic value).
 */
function getChildCompletions(item: CompletionItem): Completion[] {
  const completions: Completion[] = [];

  // Static children take precedence
  if (item.children && item.children.length > 0) {
    completions.push(
      ...item.children.map((child) => toCompletion(child, "property", 5)),
    );
  }

  // If item has a value and it's an object, also include its keys
  if (
    item.value !== undefined &&
    item.value !== null &&
    isPlainObject(item.value)
  ) {
    const existingNames = new Set(completions.map((c) => c.label));
    const valueCompletions = objectKeysToCompletions(item.value).filter(
      (c) => !existingNames.has(c.label),
    );
    completions.push(...valueCompletions);
  }

  return completions;
}

/**
 * Convert a CompletionItem to a CodeMirror Completion.
 */
function toCompletion(
  item: CompletionItem,
  defaultType: string,
  boost: number,
): Completion {
  return {
    label: item.name,
    type: item.type || defaultType,
    detail: item.detail,
    info: item.info,
    boost,
  };
}

/**
 * Convert object keys to completions.
 */
function objectKeysToCompletions(obj: Record<string, unknown>): Completion[] {
  return Object.keys(obj).map((key) => ({
    label: key,
    type: "property",
    detail: getValueType(obj[key]),
    info: formatNestedPreview(obj[key]),
    boost: 5,
  }));
}

/**
 * Get a nested value from an object using a path array.
 */
function getNestedValue(obj: unknown, path: string[]): unknown {
  if (path.length === 0 || (path.length === 1 && path[0] === "")) {
    return obj;
  }

  let current: unknown = obj;
  for (const key of path) {
    if (key === "") continue;
    if (!isPlainObject(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
    if (current === undefined) return undefined;
  }

  return current;
}

/**
 * Check if a value is a plain object (not array, null, etc.)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Get a short type label for a value.
 */
function getValueType(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "?";
  if (Array.isArray(value)) return `arr[${value.length}]`;
  if (typeof value === "object") return "obj";
  if (typeof value === "string") return "str";
  if (typeof value === "number") return "num";
  if (typeof value === "boolean") return "bool";
  return typeof value;
}

/**
 * Format a nested value for preview in completion info.
 */
function formatNestedPreview(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") {
    return value.length > 20 ? `"${value.slice(0, 17)}..."` : `"${value}"`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    return `{${keys.slice(0, 3).join(", ")}${keys.length > 3 ? ", ..." : ""}}`;
  }
  return String(value);
}

/**
 * Helper to format a preview value for display.
 */
export function formatPreviewValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") {
    return value.length > 30 ? `"${value.slice(0, 27)}..."` : `"${value}"`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }
  if (typeof value === "object") {
    return `{${Object.keys(value).length} keys}`;
  }
  return String(value);
}
