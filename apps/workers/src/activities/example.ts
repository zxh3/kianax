/**
 * Example Activities
 *
 * Simple activities for demonstration and testing purposes.
 */

/**
 * Simple greeting activity
 */
export async function greet(name: string): Promise<string> {
  console.log(`[Activity] Greeting: ${name}`);
  return `Hello, ${name}!`;
}

/**
 * Log a message activity
 */
export async function logMessage(message: string): Promise<void> {
  console.log(`[Activity] Log: ${message}`);
}

/**
 * Simulate async work
 */
export async function doWork(
  taskName: string,
  durationMs: number,
): Promise<string> {
  console.log(`[Activity] Starting task: ${taskName} (${durationMs}ms)`);

  await new Promise((resolve) => setTimeout(resolve, durationMs));

  console.log(`[Activity] Completed task: ${taskName}`);
  return `Task "${taskName}" completed in ${durationMs}ms`;
}
