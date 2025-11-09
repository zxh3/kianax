/**
 * Activity Definitions
 *
 * Activities are functions that can perform side effects:
 * - Execute plugins
 * - Call external APIs
 * - Update Convex database
 * - Send notifications
 */

/**
 * Example activity: Execute a plugin
 */
export async function executePlugin(params: {
  pluginId: string;
  input: unknown;
  config?: unknown;
  userId: string;
  workflowId: string;
}): Promise<unknown> {
  // TODO: Implement plugin execution
  console.log(`Executing plugin: ${params.pluginId}`);
  return { message: "Plugin execution placeholder" };
}

/**
 * Update execution status in Convex
 */
export async function updateExecutionStatus(params: {
  executionId: string;
  nodeId: string;
  status: "running" | "completed" | "failed";
  output?: unknown;
  error?: string;
}): Promise<void> {
  // TODO: Call Convex mutation to update status
  console.log(`Updating execution status: ${params.status}`);
}
