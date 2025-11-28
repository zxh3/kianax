/**
 * Conditional Branch Plugin
 *
 * Routes execution flow based on condition evaluation.
 * Conditions are configured at design-time (part of workflow structure).
 * Only the value being tested flows at runtime.
 *
 * Boolean Logic: OR of AND groups
 * - Each group's conditions are ANDed together
 * - Groups are ORed together
 * - Example: (temp > 70 AND humidity > 80) OR (temp > 90)
 *
 * Usage Examples:
 * - Single condition: [{ conditions: [{ operator: ">", compareValue: 70 }] }]
 * - Simple AND: [{ conditions: [cond1, cond2, cond3] }]
 * - Simple OR: [{ conditions: [cond1] }, { conditions: [cond2] }, { conditions: [cond3] }]
 * - Complex: [{ conditions: [cond1, cond2] }, { conditions: [cond3, cond4] }]
 *   → Evaluates as: (cond1 AND cond2) OR (cond3 AND cond4)
 *
 * Design principles:
 * - Conditions = workflow structure (design-time config)
 * - Value = runtime data (input)
 * - Errors route to false branch (graceful degradation)
 * - Visual editor can display configured conditions
 */

import { createPlugin, z } from "@kianax/plugin-sdk";
import { IfElseConfigUI } from "./config-ui";

/**
 * Comparison operators
 */
const ComparisonOperator = z.enum([
  "==",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
  "contains",
  "startsWith",
  "endsWith",
  "matches",
  "exists",
  "empty",
]);

type ComparisonOperator = z.infer<typeof ComparisonOperator>;

/**
 * Single condition (configured at design-time)
 */
const ConditionSchema = z.object({
  operator: ComparisonOperator.describe("Comparison operator"),
  compareValue: z.unknown().describe("Value to compare against"),
});

/**
 * Condition group (all conditions within a group are ANDed)
 */
const ConditionGroupSchema = z.object({
  conditions: z
    .array(ConditionSchema)
    .min(1)
    .describe("Conditions to AND together"),
});

/**
 * Output: evaluation results with details
 */
const BranchOutputSchema = z.object({
  result: z.boolean().describe("Overall condition result"),
  value: z.unknown().describe("The value that was tested"),
  groups: z
    .array(
      z.object({
        passed: z
          .boolean()
          .describe("Whether this group passed (all conditions ANDed)"),
        conditions: z
          .array(
            z.object({
              operator: z.string(),
              expected: z.unknown(),
              actual: z.unknown(),
              passed: z.boolean(),
            }),
          )
          .describe("Individual condition results within this group"),
      }),
    )
    .describe("Results for each condition group (groups are ORed together)"),
});

/**
 * Evaluate a single condition
 */
function evaluateCondition(
  value: unknown,
  operator: ComparisonOperator,
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
      return (
        typeof value === "string" &&
        typeof compareValue === "string" &&
        value.startsWith(compareValue)
      );

    case "endsWith":
      return (
        typeof value === "string" &&
        typeof compareValue === "string" &&
        value.endsWith(compareValue)
      );

    case "matches":
      if (typeof value === "string" && typeof compareValue === "string") {
        try {
          const regex = new RegExp(compareValue);
          return regex.test(value);
        } catch {
          return false;
        }
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
  }
}

export const ifElsePlugin = createPlugin("if-else")
  .withMetadata({
    name: "Conditional Branch",
    description:
      "Routes execution based on configured conditions. Configure comparison logic at design-time; value flows at runtime.",
    version: "2.1.1",
    icon: "🔀",
    tags: ["logic"],
    author: {
      name: "Kianax",
      url: "https://kianax.com",
    },
  })
  // Input: data flows into the node
  .withInput("data", {
    label: "Data",
    description: "The data to test against configured conditions",
    schema: z.unknown(),
  })
  // Control flow node: multiple output handles for routing (NO generic "output")
  // The execution routes to either "true" or "false" based on condition evaluation
  .withOutputHandles([
    {
      name: "true",
      label: "True",
      description: "Executed when conditions pass",
    },
    {
      name: "false",
      label: "False",
      description: "Executed when conditions fail",
    },
  ])
  .withOutput("true", {
    label: "True",
    description: "Executed when conditions pass",
    schema: BranchOutputSchema,
  })
  .withOutput("false", {
    label: "False",
    description: "Executed when conditions fail",
    schema: BranchOutputSchema,
  })
  .withConfig(
    z.object({
      conditionGroups: z
        .array(ConditionGroupSchema)
        .min(1)
        .describe(
          "Condition groups (OR of AND groups). Each group's conditions are ANDed; groups are ORed together.",
        ),
    }),
  )
  .withConfigUI(IfElseConfigUI)
  .execute(async ({ inputs, config }) => {
    const data = inputs.data;

    // Evaluate each group (conditions within a group are ANDed)
    const groupResults = config.conditionGroups.map((group) => {
      const conditionResults = group.conditions.map((condition) => {
        try {
          const passed = evaluateCondition(
            data,
            condition.operator,
            condition.compareValue,
          );

          return {
            operator: condition.operator,
            expected: condition.compareValue,
            actual: data,
            passed,
          };
        } catch {
          // Errors route to false branch (graceful degradation)
          return {
            operator: condition.operator,
            expected: condition.compareValue,
            actual: data,
            passed: false,
          };
        }
      });

      // Group passes if ALL conditions pass (AND)
      const groupPassed = conditionResults.every((c) => c.passed);

      return {
        passed: groupPassed,
        conditions: conditionResults,
      };
    });

    // Final result: true if ANY group passes (OR of AND groups)
    const finalResult = groupResults.some((g) => g.passed);

    const output = {
      result: finalResult,
      value: data,
      groups: groupResults,
    };

    // Only active branch receives output
    return finalResult ? { true: output } : { false: output };
  })
  .build();
