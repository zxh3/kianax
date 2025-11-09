/**
 * Plugin Execution Activity
 *
 * Executes plugin code within a Temporal Activity.
 * Activities can make network calls, use Date.now(), etc.
 */

import { Context } from '@temporalio/activity';
import type { ExecutePluginInput } from '@kianax/shared/temporal';

export async function executePlugin(
  input: ExecutePluginInput
): Promise<any> {
  const { pluginId, config, inputs, context } = input;

  // Send heartbeat to show activity is alive
  Context.current().heartbeat();

  // TODO: Load plugin from Convex and execute
  // For now, return mock data for development
  console.log(`Executing plugin: ${pluginId} for user: ${context.userId}`);
  console.log(`  Node ID: ${context.nodeId}`);
  console.log(`  Config:`, config);
  console.log(`  Inputs:`, inputs);

  // Heartbeat before execution
  Context.current().heartbeat();

  // Mock plugin execution
  // In production, this would:
  // 1. Load plugin code from Convex
  // 2. Load user credentials if needed
  // 3. Execute plugin.execute(inputs, config, credentials)
  // 4. Return plugin output

  const output = {
    success: true,
    data: `Mock output from ${pluginId}`,
    timestamp: Date.now(),
  };

  return output;
}
