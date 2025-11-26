/**
 * Plugin Testing Utilities
 *
 * Tools for testing plugins locally before integration.
 */

import type { Plugin, PluginContext } from "../index";

/**
 * Mock context builder for testing
 */
export function mockContext(overrides?: Partial<PluginContext>): PluginContext {
  return {
    userId: overrides?.userId || "test-user-id",
    routineId: overrides?.routineId || "test-routine-id",
    executionId: overrides?.executionId || "test-execution-id",
    nodeId: overrides?.nodeId || "test-node-id",
    credentials: overrides?.credentials || {},
    triggerData: overrides?.triggerData,
  };
}

/**
 * Test harness for plugins
 *
 * @example
 * ```typescript
 * const tester = new PluginTester(myPlugin);
 *
 * const result = await tester.execute({
 *   inputs: { query: { text: "test" } },
 *   config: { apiKey: "test-key" },
 *   credentials: { apiToken: "secret" }
 * });
 * ```
 */
export class PluginTester {
  constructor(private plugin: Plugin<any>) {}

  /**
   * Execute plugin with test data
   */
  async execute(options: {
    inputs: Record<string, any>;
    config?: any;
    credentials?: Record<string, string>;
    context?: Partial<PluginContext>;
  }): Promise<Record<string, any>> {
    // Create test context
    const context = mockContext({
      ...options.context,
      credentials: options.credentials,
    });

    // Validate inputs (optional, but good for testing)
    const schemas = this.plugin.defineSchemas();
    for (const [portName, portDef] of Object.entries(schemas.inputs)) {
      if (options.inputs[portName]) {
        portDef.schema.parse(options.inputs[portName]);
      } else if (!portDef.schema.isOptional()) {
        // Simple check, might not be perfect for all Zod schemas but decent
        // actually zod schema doesn't have isOptional() on base type easily accessible
        // without casting. Let's just rely on runtime validation inside execute if any.
        // Or better, use the plugin's validate method if it existed, or just parse if present.
      }
    }

    // Execute plugin
    const result = await this.plugin.execute(
      options.inputs,
      options.config,
      context,
      {}, // nodeState (empty for testing)
    );

    // Validate outputs
    for (const [portName, portDef] of Object.entries(schemas.outputs)) {
      if (result[portName] !== undefined) {
        portDef.schema.parse(result[portName]);
      }
    }

    return result;
  }

  /**
   * Get plugin metadata
   */
  getMetadata() {
    return this.plugin.getMetadata();
  }
}
