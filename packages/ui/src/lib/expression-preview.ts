/**
 * Expression Preview Resolver for UI
 *
 * Browser-compatible expression resolver for live preview in ExpressionInput.
 * Uses simplified context (default values, sample data) instead of runtime context.
 */

/**
 * Preview context for expression resolution
 */
export interface PreviewContext {
  /** Variable values (name -> value) */
  vars: Record<string, unknown>;
  /** Node outputs (nodeId -> portName -> value) */
  nodes: Record<string, Record<string, unknown>>;
  /** Trigger data */
  trigger?: unknown;
  /** Execution metadata */
  execution?: {
    id: string;
    routineId: string;
    startedAt: number;
  };
}

/**
 * Result of expression preview resolution
 */
export interface PreviewResult {
  /** The resolved value */
  value: unknown;
  /** The inferred type of the value */
  type:
    | "string"
    | "number"
    | "boolean"
    | "object"
    | "array"
    | "null"
    | "undefined";
  /** Whether resolution was successful */
  success: boolean;
  /** Error message if resolution failed */
  error?: string;
}

/**
 * Expression pattern: {{ source.path.to.value }}
 */
const EXPRESSION_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g;

/**
 * Valid source types for expressions
 */
const VALID_SOURCES = ["nodes", "vars", "trigger", "execution"] as const;

/**
 * Resolve expressions for preview display.
 * Returns the resolved value or error information.
 */
export function resolvePreview(
  value: string,
  context: PreviewContext,
): PreviewResult {
  try {
    const resolved = resolveExpressions(value, context);
    return {
      value: resolved,
      type: getValueType(resolved),
      success: true,
    };
  } catch (error) {
    return {
      value: undefined,
      type: "undefined",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Resolve all expressions in a string value.
 */
function resolveExpressions(value: string, context: PreviewContext): unknown {
  // Check if the entire string is a single expression
  const trimmed = value.trim();
  const singleExprMatch = trimmed.match(/^\{\{\s*([^}]+?)\s*\}\}$/);

  if (singleExprMatch?.[1]) {
    // Single expression - return the resolved value directly (preserves type)
    return resolveExpression(singleExprMatch[1], context);
  }

  // Multiple expressions or mixed content - interpolate as string
  return value.replace(EXPRESSION_PATTERN, (_match, expr) => {
    const resolved = resolveExpression(expr, context);
    if (resolved === undefined || resolved === null) {
      return "";
    }
    if (typeof resolved === "object") {
      return JSON.stringify(resolved);
    }
    return String(resolved);
  });
}

/**
 * Resolve a single expression (without the {{ }} delimiters)
 */
function resolveExpression(expr: string, context: PreviewContext): unknown {
  const parts = expr.trim().split(".");
  if (parts.length === 0) {
    return undefined;
  }

  const source = parts[0] as (typeof VALID_SOURCES)[number];
  if (!VALID_SOURCES.includes(source)) {
    throw new Error(`Unknown source: ${source}`);
  }

  const path = parts.slice(1);

  switch (source) {
    case "nodes":
      return resolveNodeReference(path, context);
    case "vars":
      return resolvePath(context.vars, path);
    case "trigger":
      return resolvePath(context.trigger, path);
    case "execution":
      return resolvePath(context.execution ?? createDefaultExecution(), path);
    default:
      return undefined;
  }
}

/**
 * Resolve a node output reference.
 * Path format: nodeId.portName.path.to.value
 */
function resolveNodeReference(
  path: string[],
  context: PreviewContext,
): unknown {
  if (path.length < 1) {
    throw new Error("Node reference requires a node ID");
  }

  const nodeId = path[0]!;
  const nodeOutputs = context.nodes[nodeId];

  if (!nodeOutputs) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  // If only nodeId provided, return all outputs
  if (path.length === 1) {
    return nodeOutputs;
  }

  // Get specific port
  const portName = path[1]!;
  const portData = nodeOutputs[portName];

  if (portData === undefined) {
    throw new Error(`Port not found: ${nodeId}.${portName}`);
  }

  // If there's more path, resolve it
  if (path.length > 2) {
    return resolvePath(portData, path.slice(2));
  }

  return portData;
}

/**
 * Resolve a path on an object.
 * Supports dot notation and array indexing: path[0].nested
 */
function resolvePath(obj: unknown, path: string[]): unknown {
  let current = obj;

  for (const segment of path) {
    if (current === null || current === undefined) {
      return undefined;
    }

    // Check for array index notation: segment[index]
    const arrayMatch = segment.match(/^([^[]+)\[(\d+)\]$/);

    if (arrayMatch?.[1] && arrayMatch[2]) {
      const key = arrayMatch[1];
      const index = parseInt(arrayMatch[2], 10);

      // First access the property
      if (typeof current === "object" && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }

      // Then access the array index
      if (Array.isArray(current) && index < current.length) {
        current = current[index];
      } else {
        return undefined;
      }
    } else {
      // Regular property access
      if (typeof current === "object" && segment in current) {
        current = (current as Record<string, unknown>)[segment];
      } else {
        return undefined;
      }
    }
  }

  return current;
}

/**
 * Get the type of a value for display
 */
function getValueType(value: unknown): PreviewResult["type"] {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "array";
  return typeof value as PreviewResult["type"];
}

/**
 * Create default execution context for preview
 */
function createDefaultExecution() {
  return {
    id: "preview-execution-id",
    routineId: "preview-routine-id",
    startedAt: Date.now(),
  };
}

/**
 * Check if a string contains expressions
 */
export function containsExpression(value: string): boolean {
  EXPRESSION_PATTERN.lastIndex = 0;
  return EXPRESSION_PATTERN.test(value);
}

/**
 * Format a preview value for display
 */
export function formatPreviewValue(value: unknown, maxLength = 50): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";

  if (typeof value === "string") {
    if (value.length > maxLength) {
      return `"${value.slice(0, maxLength - 3)}..."`;
    }
    return `"${value}"`;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }

  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length <= 3) {
      return `{${keys.join(", ")}}`;
    }
    return `{${keys.slice(0, 3).join(", ")}, ...}`;
  }

  return String(value);
}
