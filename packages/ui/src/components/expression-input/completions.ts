/**
 * CodeMirror 6 autocomplete completion source for expression syntax.
 *
 * Provides context-aware suggestions when the user types {{ in the editor.
 * Suggestions include:
 * - Routine variables (vars.*)
 * - Upstream node outputs (nodes.*.*)
 * - Trigger data (trigger.*)
 * - Execution context (execution.*)
 */

import type {
  CompletionContext,
  CompletionResult,
  Completion,
} from "@codemirror/autocomplete";
import type { ExpressionContext } from "./index";

/**
 * Type badge labels for completion items.
 */
const TYPE_LABELS: Record<string, string> = {
  string: "str",
  number: "num",
  boolean: "bool",
  json: "json",
  object: "obj",
  unknown: "?",
};

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

    // Parse the expression to determine what to suggest
    const parts = expressionText.split(".");
    const completions: Completion[] = [];

    if (
      parts.length === 0 ||
      (parts.length === 1 && !expressionText.includes("."))
    ) {
      // At the root level - suggest sources
      completions.push(...getRootCompletions(expressionContext));
    } else {
      // We have at least one part - determine what to suggest next
      const source = parts[0];
      const remainingParts = parts.slice(1);

      if (source === "vars" && expressionContext?.variables) {
        completions.push(
          ...getVariableCompletions(
            expressionContext.variables,
            remainingParts,
          ),
        );
      } else if (source === "nodes" && expressionContext?.upstreamNodes) {
        completions.push(
          ...getNodeCompletions(
            expressionContext.upstreamNodes,
            remainingParts,
          ),
        );
      } else if (source === "trigger" && expressionContext?.hasTrigger) {
        completions.push(...getTriggerCompletions(remainingParts));
      } else if (source === "execution") {
        completions.push(...getExecutionCompletions(remainingParts));
      }
    }

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
 * Get root-level source completions (vars, nodes, trigger, execution).
 */
function getRootCompletions(
  context: ExpressionContext | undefined,
): Completion[] {
  const completions: Completion[] = [];

  // Always show vars and execution
  completions.push({
    label: "vars",
    type: "keyword",
    detail: "Routine variables",
    info: "Access routine-level variables",
    boost: 10,
  });

  completions.push({
    label: "execution",
    type: "keyword",
    detail: "Execution context",
    info: "Access execution metadata (id, routineId, startedAt)",
    boost: 5,
  });

  // Show nodes if there are upstream nodes
  if (context?.upstreamNodes && context.upstreamNodes.length > 0) {
    completions.push({
      label: "nodes",
      type: "keyword",
      detail: "Node outputs",
      info: `Access outputs from ${context.upstreamNodes.length} upstream node(s)`,
      boost: 8,
    });
  }

  // Show trigger if available
  if (context?.hasTrigger) {
    completions.push({
      label: "trigger",
      type: "keyword",
      detail: "Trigger data",
      info: "Access data from the routine trigger",
      boost: 7,
    });
  }

  return completions;
}

/**
 * Get variable completions.
 */
function getVariableCompletions(
  variables: NonNullable<ExpressionContext["variables"]>,
  path: string[],
): Completion[] {
  // At vars. level - show all variables
  if (path.length === 0 || (path.length === 1 && path[0] === "")) {
    return variables.map((v) => ({
      label: v.name,
      type: "variable",
      detail: TYPE_LABELS[v.type] || v.type,
      info: v.description || `${v.type} variable`,
      boost: 5,
    }));
  }

  // Deeper path - we don't know the structure, so no completions
  return [];
}

/**
 * Get node output completions.
 */
function getNodeCompletions(
  nodes: NonNullable<ExpressionContext["upstreamNodes"]>,
  path: string[],
): Completion[] {
  // At nodes. level - show all node IDs
  if (path.length === 0 || (path.length === 1 && path[0] === "")) {
    return nodes.map((node) => ({
      label: node.id,
      type: "class",
      detail: node.pluginId,
      info: node.label,
      boost: 5,
    }));
  }

  // At nodes.<nodeId>. level - show output ports
  if (path.length === 1 || (path.length === 2 && path[1] === "")) {
    const nodeId = path[0];
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      return node.outputs.map((output) => ({
        label: output,
        type: "property",
        detail: "output port",
        boost: 5,
      }));
    }
  }

  // Deeper path - we don't know the structure
  return [];
}

/**
 * Get trigger data completions.
 */
function getTriggerCompletions(path: string[]): Completion[] {
  // At trigger. level - show common trigger properties
  if (path.length === 0 || (path.length === 1 && path[0] === "")) {
    return [
      {
        label: "payload",
        type: "property",
        detail: "object",
        info: "Trigger payload data",
        boost: 5,
      },
      {
        label: "type",
        type: "property",
        detail: "string",
        info: "Trigger type (webhook, schedule, etc.)",
        boost: 4,
      },
    ];
  }

  return [];
}

/**
 * Get execution context completions.
 */
function getExecutionCompletions(path: string[]): Completion[] {
  // At execution. level - show execution properties
  if (path.length === 0 || (path.length === 1 && path[0] === "")) {
    return [
      {
        label: "id",
        type: "property",
        detail: "string",
        info: "Unique execution ID",
        boost: 5,
      },
      {
        label: "routineId",
        type: "property",
        detail: "string",
        info: "ID of the routine being executed",
        boost: 4,
      },
      {
        label: "startedAt",
        type: "property",
        detail: "number",
        info: "Execution start timestamp (ms)",
        boost: 3,
      },
    ];
  }

  return [];
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
