/**
 * If-Else Logic Plugin
 *
 * Conditional branching based on comparisons and logical operators.
 */

import { definePlugin, z } from "@kianax/plugin-sdk";

export const ifElse = definePlugin({
  id: "if-else",
  name: "If-Else Logic",
  description:
    "Conditional branching with support for comparisons (==, !=, >, <, >=, <=) and logical operators (AND, OR)",
  version: "1.0.0",
  type: "logic",

  author: {
    name: "Kianax",
    url: "https://kianax.com",
  },

  inputSchema: z.object({
    value: z.unknown().describe("The value to evaluate"),
    conditions: z
      .array(
        z.object({
          operator: z
            .enum([
              "==",
              "!=",
              ">",
              "<",
              ">=",
              "<=",
              "contains",
              "startsWith",
              "endsWith",
              "exists",
              "empty",
            ])
            .describe("Comparison operator"),
          compareValue: z
            .unknown()
            .optional()
            .describe("Value to compare against (not needed for exists/empty)"),
        }),
      )
      .describe("List of conditions to evaluate"),
    logicalOperator: z
      .enum(["AND", "OR"])
      .optional()
      .default("AND")
      .describe("How to combine multiple conditions"),
  }),

  outputSchema: z.object({
    result: z.boolean().describe("The result of the condition evaluation"),
    branch: z.enum(["true", "false"]).describe("Which branch to take"),
    details: z
      .string()
      .optional()
      .describe("Human-readable explanation of the result"),
  }),

  tags: ["logic", "condition", "if-else", "branching"],
  icon: "🔀",

  async execute(input, _config, _context) {
    const results: boolean[] = [];
    const explanations: string[] = [];

    // Evaluate each condition
    for (const condition of input.conditions) {
      const result = evaluateCondition(
        input.value,
        condition.operator,
        condition.compareValue,
      );

      results.push(result);

      // Build explanation
      const valueStr = stringifyValue(input.value);
      const compareStr = stringifyValue(condition.compareValue);
      const operatorStr = condition.operator;

      explanations.push(`${valueStr} ${operatorStr} ${compareStr} = ${result}`);
    }

    // Combine results based on logical operator
    let finalResult: boolean;

    if (input.logicalOperator === "AND") {
      finalResult = results.every((r) => r === true);
    } else {
      // OR
      finalResult = results.some((r) => r === true);
    }

    // Build details
    const details = `Evaluated ${input.conditions.length} condition(s) with ${input.logicalOperator}: ${explanations.join(`, ${input.logicalOperator} `)}. Result: ${finalResult}`;

    return {
      result: finalResult,
      branch: (finalResult ? "true" : "false") as "true" | "false",
      details,
    };
  },
});

// Helper function to evaluate a single condition
function evaluateCondition(
  value: unknown,
  operator: string,
  compareValue: unknown,
): boolean {
  switch (operator) {
    case "==":
      return value === compareValue;

    case "!=":
      return value !== compareValue;

    case ">":
      return Number(value) > Number(compareValue);

    case "<":
      return Number(value) < Number(compareValue);

    case ">=":
      return Number(value) >= Number(compareValue);

    case "<=":
      return Number(value) <= Number(compareValue);

    case "contains":
      if (typeof value === "string" && typeof compareValue === "string") {
        return value.includes(compareValue);
      }
      if (Array.isArray(value)) {
        return value.includes(compareValue);
      }
      return false;

    case "startsWith":
      if (typeof value === "string" && typeof compareValue === "string") {
        return value.startsWith(compareValue);
      }
      return false;

    case "endsWith":
      if (typeof value === "string" && typeof compareValue === "string") {
        return value.endsWith(compareValue);
      }
      return false;

    case "exists":
      return value !== null && value !== undefined;

    case "empty":
      if (value === null || value === undefined) return true;
      if (typeof value === "string") return value.length === 0;
      if (Array.isArray(value)) return value.length === 0;
      if (typeof value === "object") return Object.keys(value).length === 0;
      return false;

    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
}

// Helper function to stringify values for display
function stringifyValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === "object") return `{${Object.keys(value).length} keys}`;
  return String(value);
}
