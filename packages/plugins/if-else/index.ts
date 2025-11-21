/**
 * If-Else Logic Plugin (Builder Pattern)
 *
 * Conditional branching based on comparisons and logical operators.
 * This demonstrates the builder pattern for complex logic plugins.
 */

import { createPlugin, z } from "@kianax/plugin-sdk";
import { IfElseConfigUI } from "./config-ui";

// Schema for the data we're evaluating
const dataSchema = z.any().describe("The value to evaluate");

// Schema for result data (passed to both branches)
const resultSchema = z.object({
  result: z.boolean().describe("The result of the condition evaluation"),
  details: z
    .string()
    .optional()
    .describe("Human-readable explanation of the result"),
  evaluatedValue: z.unknown().describe("The original value that was evaluated"),
});

// Config schema defines what users can configure in the UI
const configSchema = z.object({
  conditions: z.array(
    z.object({
      operator: z.string(),
      compareValue: z.string(),
    }),
  ),
  logicalOperator: z.enum(["AND", "OR"]),
});

/**
 * Helper: Evaluate a single condition
 */
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

/**
 * Helper: Stringify values for display
 */
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

export const ifElsePlugin = createPlugin("if-else")
  .withMetadata({
    name: "If-Else Logic",
    description:
      "Conditional branching with support for comparisons (==, !=, >, <, >=, <=) and logical operators (AND, OR)",
    version: "1.0.0",
    icon: "🔀",
    tags: [
      "logic", // Role tag
      "condition", // Category tag
      "branching", // Feature tag
      "if-else", // Specific tag
      "comparison", // Feature tag
    ],
    author: {
      name: "Kianax",
      url: "https://kianax.com",
    },
  })
  .withInput("data", {
    label: "Data",
    description: "The data to evaluate",
    schema: dataSchema,
  })
  .withOutput("true", {
    label: "True",
    description: "Executed when condition is true",
    schema: resultSchema,
  })
  .withOutput("false", {
    label: "False",
    description: "Executed when condition is false",
    schema: resultSchema,
  })
  .withConfig(configSchema)
  .withConfigUI(IfElseConfigUI)
  .execute(async ({ inputs, config }) => {
    // Fully typed!
    const value = inputs.data;

    // If no config, default to always true
    if (!config || !config.conditions || config.conditions.length === 0) {
      return {
        true: {
          result: true,
          details: "No conditions configured, defaulting to true",
          evaluatedValue: value,
        },
      };
    }

    const results: boolean[] = [];
    const explanations: string[] = [];

    // Evaluate each condition
    for (const condition of config.conditions) {
      const result = evaluateCondition(
        value,
        condition.operator,
        condition.compareValue,
      );

      results.push(result);

      // Build explanation
      const valueStr = stringifyValue(value);
      const compareStr = stringifyValue(condition.compareValue);
      const operatorStr = condition.operator;

      explanations.push(`${valueStr} ${operatorStr} ${compareStr} = ${result}`);
    }

    // Combine results based on logical operator
    let finalResult: boolean;

    if (config.logicalOperator === "AND") {
      finalResult = results.every((r) => r === true);
    } else {
      // OR
      finalResult = results.some((r) => r === true);
    }

    // Build details
    const details = `Evaluated ${config.conditions.length} condition(s) with ${config.logicalOperator}: ${explanations.join(`, ${config.logicalOperator} `)}. Result: ${finalResult}`;

    // Return result data on the appropriate output port
    const resultData = {
      result: finalResult,
      details,
      evaluatedValue: value,
    };

    // Only one output port will have data
    // The workflow executor will follow only the port that has data
    if (finalResult) {
      return {
        true: resultData,
      };
    } else {
      return {
        false: resultData,
      };
    }
  })
  .build();
