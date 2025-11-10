/**
 * Example Workflow
 *
 * A simple workflow that demonstrates basic Temporal concepts:
 * - Workflow parameters
 * - Activity execution
 * - Data flow
 * - Return values
 */

import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities";

// Proxy activities with timeout configuration
const { greet, logMessage } = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 seconds",
  retry: {
    initialInterval: "1s",
    maximumAttempts: 3,
  },
});

/**
 * Simple example workflow that greets a user
 */
export async function example({ name }: { name: string }): Promise<string> {
  // Log workflow start
  await logMessage(`Starting example workflow for: ${name}`);

  // Execute greeting activity
  const greeting = await greet(name);

  // Log workflow completion
  await logMessage(`Workflow completed with result: ${greeting}`);

  return greeting;
}

/**
 * More complex example with multiple activities
 */
export async function exampleWithSteps(
  name: string,
  steps: number,
): Promise<{ greeting: string; totalSteps: number }> {
  await logMessage(`Starting multi-step workflow for: ${name}`);

  // Execute greeting
  const greeting = await greet(name);

  // Execute multiple steps in sequence
  for (let i = 1; i <= steps; i++) {
    await logMessage(`Processing step ${i} of ${steps}`);
    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  await logMessage(`Completed all ${steps} steps`);

  return {
    greeting,
    totalSteps: steps,
  };
}
