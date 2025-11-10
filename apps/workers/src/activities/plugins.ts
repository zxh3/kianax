/**
 * Plugin Execution Activity
 *
 * Executes plugin code within a Temporal Activity.
 * Activities can make network calls, use Date.now(), etc.
 */

import { Context } from "@temporalio/activity";
import type { ExecutePluginInput } from "@kianax/shared/temporal";
import { getPlugin } from "@kianax/plugins";
import { validateInput, validateOutput } from "@kianax/plugin-sdk";

export async function executePlugin(
  input: ExecutePluginInput,
): Promise<unknown> {
  const { pluginId, config, inputs, context } = input;

  // Send heartbeat to show activity is alive
  Context.current().heartbeat();

  console.log(`Executing plugin: ${pluginId} for user: ${context.userId}`);
  console.log(`  Node ID: ${context.nodeId}`);
  console.log(`  Routine ID: ${context.routineId}`);

  try {
    // 1. Load plugin from registry
    const plugin = getPlugin(pluginId);

    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    console.log(`  Plugin found: ${plugin.name} v${plugin.version}`);

    // 2. Validate input against plugin's input schema
    const validatedInput = validateInput(inputs, plugin.inputSchema);

    // 3. Load user credentials if plugin requires them
    // TODO: In production, fetch credentials from Convex based on context.userId
    // For now, use credentials from context (passed from workflow)
    const credentials = context.credentials || {};

    // Check if plugin requires credentials that are missing
    if (plugin.credentials && plugin.credentials.length > 0) {
      for (const credentialSchema of plugin.credentials) {
        if (credentialSchema.required && !credentials[credentialSchema.key]) {
          throw new Error(
            `Missing required credential: ${credentialSchema.label} (${credentialSchema.key})`,
          );
        }
      }
    }

    // Heartbeat before execution
    Context.current().heartbeat();

    console.log(`  Executing plugin...`);

    // 4. Execute plugin
    const output = await plugin.execute(validatedInput, config || {}, {
      userId: context.userId,
      routineId: context.routineId,
      executionId: context.executionId,
      nodeId: context.nodeId,
      credentials,
      triggerData: context.triggerData,
    });

    // 5. Validate output against plugin's output schema
    const validatedOutput = validateOutput(output, plugin.outputSchema);

    console.log(`  Plugin executed successfully`);

    // Heartbeat after execution
    Context.current().heartbeat();

    return validatedOutput;
  } catch (error) {
    console.error(`  Plugin execution failed:`, error);

    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Plugin ${pluginId} execution failed: ${error.message}`);
    }

    throw error;
  }
}
