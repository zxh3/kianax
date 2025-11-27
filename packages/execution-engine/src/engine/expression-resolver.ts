/**
 * Expression Resolver for Variable System
 *
 * Resolves expressions like {{ nodes.http_1.success.data }} in node configurations.
 * Supports multiple variable sources:
 * - nodes: Access outputs from previously executed nodes
 * - vars: Access routine-level variables
 * - trigger: Access trigger data
 * - execution: Access execution metadata
 */

import type { PortData } from "../types/execution.js";

/**
 * Context for expression resolution
 */
export interface ExpressionContext {
  /** Node outputs indexed by node ID */
  nodes: Map<string, PortData[]>;
  /** Routine-level variables */
  vars: Record<string, unknown>;
  /** Trigger data */
  trigger: unknown;
  /** Execution metadata */
  execution: {
    id: string;
    routineId: string;
    startedAt: number;
  };
}

/**
 * Reference to a variable in an expression
 */
export interface VariableReference {
  /** The source type (nodes, vars, trigger, execution) */
  source: "nodes" | "vars" | "trigger" | "execution";
  /** The full path after the source */
  path: string[];
  /** The original expression string */
  expression: string;
  /** For node references, the node ID */
  nodeId?: string;
  /** For node references, the port name */
  portName?: string;
}

/**
 * Expression pattern: {{ source.path.to.value }}
 * Captures the content between {{ and }}
 */
const EXPRESSION_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g;

/**
 * Valid source types for expressions
 */
const VALID_SOURCES = ["nodes", "vars", "trigger", "execution"] as const;

export class ExpressionResolver {
  constructor(private context: ExpressionContext) {}

  /**
   * Resolve all expressions in a value.
   * Handles strings, objects, and arrays recursively.
   */
  resolve<T>(value: T): T {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === "string") {
      return this.resolveString(value) as T;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.resolve(item)) as T;
    }

    if (typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.resolve(val);
      }
      return result as T;
    }

    // Primitives (number, boolean) pass through unchanged
    return value;
  }

  /**
   * Resolve expressions in a string value.
   * If the entire string is a single expression, returns the resolved value directly.
   * If the string contains multiple expressions or mixed content, returns a string.
   */
  private resolveString(value: string): unknown {
    // Check if the entire string is a single expression
    const trimmed = value.trim();
    const singleExprMatch = trimmed.match(/^\{\{\s*([^}]+?)\s*\}\}$/);

    if (singleExprMatch?.[1]) {
      // Single expression - return the resolved value directly (preserves type)
      return this.resolveExpression(singleExprMatch[1]);
    }

    // Multiple expressions or mixed content - interpolate as string
    return value.replace(EXPRESSION_PATTERN, (_match, expr) => {
      const resolved = this.resolveExpression(expr);
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
  private resolveExpression(expr: string): unknown {
    const parts = expr.trim().split(".");
    if (parts.length === 0) {
      return undefined;
    }

    const source = parts[0] as (typeof VALID_SOURCES)[number];
    if (!VALID_SOURCES.includes(source)) {
      console.warn(`Unknown expression source: ${source}`);
      return undefined;
    }

    const path = parts.slice(1);

    switch (source) {
      case "nodes":
        return this.resolveNodeReference(path);
      case "vars":
        return this.resolveVarsReference(path);
      case "trigger":
        return this.resolvePath(this.context.trigger, path);
      case "execution":
        return this.resolvePath(this.context.execution, path);
      default:
        return undefined;
    }
  }

  /**
   * Resolve a node output reference
   * Path format: nodeId.portName.path.to.value
   */
  private resolveNodeReference(path: string[]): unknown {
    if (path.length < 1) {
      console.warn("Node reference requires at least a node ID");
      return undefined;
    }

    const nodeId = path[0]!;
    const nodeOutputs = this.context.nodes.get(nodeId);

    if (!nodeOutputs) {
      console.warn(`Node output not found: ${nodeId}`);
      return undefined;
    }

    // If only nodeId provided, return all outputs as an object
    if (path.length === 1) {
      const result: Record<string, unknown> = {};
      for (const portData of nodeOutputs) {
        if (portData.items.length > 0) {
          result[portData.portName] = portData.items[0]?.data;
        }
      }
      return result;
    }

    // Get specific port - handle array indexing on port name (e.g., "output[0]")
    let portNameSegment = path[1]!;
    let portArrayIndex: number | undefined;

    const portArrayMatch = portNameSegment.match(/^([^[]+)\[(\d+)\]$/);
    if (portArrayMatch?.[1] && portArrayMatch[2]) {
      portNameSegment = portArrayMatch[1];
      portArrayIndex = parseInt(portArrayMatch[2], 10);
    }

    const portData = nodeOutputs.find((p) => p.portName === portNameSegment);

    if (!portData || portData.items.length === 0) {
      console.warn(`Port not found or empty: ${nodeId}.${portNameSegment}`);
      return undefined;
    }

    // Get the first item's data
    let data = portData.items[0]?.data;

    // If port had array index, apply it to the data
    if (portArrayIndex !== undefined) {
      if (Array.isArray(data) && portArrayIndex < data.length) {
        data = data[portArrayIndex];
      } else {
        return undefined;
      }
    }

    // If there's more path, resolve it
    if (path.length > 2) {
      return this.resolvePath(data, path.slice(2));
    }

    return data;
  }

  /**
   * Resolve a vars reference
   */
  private resolveVarsReference(path: string[]): unknown {
    if (path.length === 0) {
      return this.context.vars;
    }
    return this.resolvePath(this.context.vars, path);
  }

  /**
   * Resolve a path on an object
   * Supports dot notation and array indexing: path[0].nested
   */
  private resolvePath(obj: unknown, path: string[]): unknown {
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
   * Check if a string contains expressions
   */
  hasExpressions(value: string): boolean {
    EXPRESSION_PATTERN.lastIndex = 0;
    return EXPRESSION_PATTERN.test(value);
  }

  /**
   * Extract all variable references from a value
   */
  extractReferences(value: unknown): VariableReference[] {
    const refs: VariableReference[] = [];
    this.collectReferences(value, refs);
    return refs;
  }

  /**
   * Recursively collect references from a value
   */
  private collectReferences(value: unknown, refs: VariableReference[]): void {
    if (typeof value === "string") {
      EXPRESSION_PATTERN.lastIndex = 0;
      let match = EXPRESSION_PATTERN.exec(value);
      while (match !== null) {
        const exprMatch = match[1];
        if (exprMatch) {
          const expr = exprMatch.trim();
          const parts = expr.split(".");
          const source = parts[0] as VariableReference["source"];

          if (VALID_SOURCES.includes(source)) {
            const ref: VariableReference = {
              source,
              path: parts.slice(1),
              expression: match[0],
            };

            // Add node-specific info
            if (source === "nodes" && parts.length >= 2) {
              ref.nodeId = parts[1];
              if (parts.length >= 3) {
                ref.portName = parts[2];
              }
            }

            refs.push(ref);
          }
        }
        match = EXPRESSION_PATTERN.exec(value);
      }
    } else if (Array.isArray(value)) {
      for (const item of value) {
        this.collectReferences(item, refs);
      }
    } else if (typeof value === "object" && value !== null) {
      for (const val of Object.values(value)) {
        this.collectReferences(val, refs);
      }
    }
  }
}

/**
 * Create an empty expression context
 */
export function createEmptyContext(): ExpressionContext {
  return {
    nodes: new Map(),
    vars: {},
    trigger: undefined,
    execution: {
      id: "",
      routineId: "",
      startedAt: 0,
    },
  };
}
