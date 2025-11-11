/**
 * Loop Control Plugin
 *
 * Controls loop iteration with continue/break logic.
 * Supports accumulator pattern for maintaining state across iterations.
 *
 * Use cases:
 * - X rounds of LLM conversation
 * - Retry until success (with max attempts)
 * - Accumulate data from multiple iterations
 */

import { createPlugin, z } from "@kianax/plugin-sdk";

const inputSchema = z.object({
  condition: z
    .boolean()
    .describe("Continue condition - true to continue, false to break"),
  accumulatedData: z
    .record(z.unknown())
    .optional()
    .describe("Data to accumulate across iterations"),
});

const outputSchema = z.object({
  branch: z
    .enum(["continue", "break"])
    .describe("Loop control decision - continue or break"),
  result: z.boolean().describe("Whether loop should continue"),
  iteration: z.number().optional().describe("Current iteration number"),
  accumulator: z.record(z.unknown()).optional().describe("Accumulated data"),
});

export const loopControlPlugin = createPlugin("loop-control")
  .withMetadata({
    name: "Loop Control",
    description:
      "Controls loop iteration with continue/break logic. Use with loop edges to create iterative workflows.",
    version: "1.0.0",
    author: {
      name: "Kianax",
      url: "https://kianax.com",
    },
    tags: ["logic", "control-flow", "loops"],
    icon: "🔄",
  })
  .withInput("input", {
    label: "Input",
    description: "Loop control input with condition and accumulator",
    schema: inputSchema,
  })
  .withOutput("continue", {
    label: "Continue",
    description: "Continue to next iteration",
    schema: outputSchema,
  })
  .withOutput("break", {
    label: "Break",
    description: "Exit the loop",
    schema: outputSchema,
  })
  .execute(async ({ inputs, context }) => {
    const { condition, accumulatedData } = inputs.input;

    // Get loop context from workflow
    const iteration = context.loopIteration || 0;
    const accumulator = context.loopAccumulator || {};

    // Merge new accumulated data
    const updatedAccumulator = {
      ...accumulator,
      ...(accumulatedData || {}),
    };

    // Determine branch based on condition
    const shouldContinue = condition === true;

    // Return on the appropriate output port
    if (shouldContinue) {
      return {
        continue: {
          branch: "continue" as const,
          result: true,
          iteration,
          accumulator: updatedAccumulator,
        },
      };
    } else {
      return {
        break: {
          branch: "break" as const,
          result: false,
          iteration,
          accumulator: updatedAccumulator,
        },
      };
    }
  })
  .build();
