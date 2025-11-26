/**
 * Plugin Execution Activity
 *
 * Executes plugin code within a Temporal Activity.
 * Activities can make network calls, use Date.now(), etc.
 */

import { Context } from "@temporalio/activity";
import type { ExecutePluginInput } from "@kianax/shared/temporal";
import { createPluginInstance, getPluginMetadata } from "@kianax/plugins";

export async function executePlugin(
  input: ExecutePluginInput,
): Promise<{ output: unknown; nodeState: Record<string, unknown> }> {
  const { pluginId, config, inputs, context, nodeState = {} } = input;

  // Send heartbeat to show activity is alive
  Context.current().heartbeat();

  console.log(`Executing plugin: ${pluginId} for user: ${context.userId}`);
  console.log(`  Node ID: ${context.nodeId}`);
  console.log(`  Routine ID: ${context.routineId}`);

  // 1. Create plugin instance
  const plugin = createPluginInstance(pluginId);

  if (!plugin) {
    throw new Error(`Plugin not found: ${pluginId}`);
  }

  // Get plugin metadata
  const metadata = getPluginMetadata(pluginId);
  if (metadata) {
    console.log(`  Plugin found: ${metadata.name} v${metadata.version}`);
  }

  // 2. Get plugin schemas
  const schemas = plugin.defineSchemas();

  // 3. Validate inputs against plugin's input schemas
  const validatedInputs: Record<string, any> = {};
  for (const [inputName, inputValue] of Object.entries(inputs)) {
    const inputSchema = schemas.inputs[inputName];
    if (!inputSchema) {
      throw new Error(
        `Unknown input: ${inputName}. Available inputs: ${Object.keys(schemas.inputs).join(", ")}`,
      );
    }

    // Validate using zod schema
    const result = inputSchema.schema.safeParse(inputValue);
    if (!result.success) {
      throw new Error(
        `Invalid input for ${inputName}: ${result.error.message}`,
      );
    }
    validatedInputs[inputName] = result.data;
  }

  // 4. Load user credentials if plugin requires them
  // TODO: In production, fetch credentials from Convex based on context.userId
  // For now, use credentials from context (passed from workflow)
  const credentials = context.credentials || {};

  // Check if plugin requires credentials that are missing
  if (metadata?.credentials && metadata.credentials.length > 0) {
    for (const credentialSchema of metadata.credentials) {
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

  // 5. Execute plugin with nodeState
  const output = await plugin.execute(
    validatedInputs,
    config || {},
    {
      userId: context.userId,
      routineId: context.routineId,
      executionId: context.executionId,
      nodeId: context.nodeId,
      credentials,
      triggerData: context.triggerData,
    },
    nodeState, // Pass nodeState to plugin
  );

  // 6. Validate outputs against plugin's output schemas
  const validatedOutputs: Record<string, any> = {};
  for (const [outputName, outputValue] of Object.entries(output)) {
    const outputSchema = schemas.outputs[outputName];
    if (!outputSchema) {
      throw new Error(
        `Unknown output: ${outputName}. Available outputs: ${Object.keys(schemas.outputs).join(", ")}`,
      );
    }

    // Validate using zod schema
    const result = outputSchema.schema.safeParse(outputValue);
    if (!result.success) {
      throw new Error(
        `Invalid output for ${outputName}: ${result.error.message}`,
      );
    }
    validatedOutputs[outputName] = result.data;
  }

  console.log(`  Plugin executed successfully`);

  // Heartbeat after execution
  Context.current().heartbeat();

  // Return both output and updated nodeState
  return {
    output: validatedOutputs,
    nodeState, // Return potentially modified nodeState
  };
}
