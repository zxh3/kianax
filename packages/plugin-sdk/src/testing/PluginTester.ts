/**
 * Plugin Testing Utilities
 *
 * Tools for testing plugins locally before integration.
 */

import type { z } from "zod";
import type { Plugin, PluginContext } from "../types/index.js";

/**
 * Mock context builder for testing
 */
export function mockContext(
  overrides?: Partial<PluginContext>,
): PluginContext {
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
 *   input: { query: "test" },
 *   config: { apiKey: "test-key" },
 *   credentials: { apiToken: "secret" }
 * });
 * ```
 */
export class PluginTester<
  TInputSchema extends z.ZodType,
  TOutputSchema extends z.ZodType,
  TConfigSchema extends z.ZodType = z.ZodUnknown,
> {
  constructor(
    private plugin: Plugin<TInputSchema, TOutputSchema, TConfigSchema>,
  ) {}

  /**
   * Execute plugin with test data
   */
  async execute(options: {
    input: z.infer<TInputSchema>;
    config?: TConfigSchema extends z.ZodType ? z.infer<TConfigSchema> : unknown;
    credentials?: Record<string, string>;
    context?: Partial<PluginContext>;
  }): Promise<z.infer<TOutputSchema>> {
    // Create test context
    const context = mockContext({
      ...options.context,
      credentials: options.credentials,
    });

    // Execute plugin
    const result = await this.plugin.execute(
      options.input,
      options.config as any,
      context,
    );

    return result;
  }

  /**
   * Validate input against plugin schema
   */
  validateInput(data: unknown): z.infer<TInputSchema> {
    const result = this.plugin.inputSchema.safeParse(data);

    if (!result.success) {
      throw new Error(
        `Input validation failed: ${JSON.stringify(result.error.issues, null, 2)}`,
      );
    }

    return result.data;
  }

  /**
   * Validate output against plugin schema
   */
  validateOutput(data: unknown): z.infer<TOutputSchema> {
    const result = this.plugin.outputSchema.safeParse(data);

    if (!result.success) {
      throw new Error(
        `Output validation failed: ${JSON.stringify(result.error.issues, null, 2)}`,
      );
    }

    return result.data;
  }

  /**
   * Validate config against plugin schema
   */
  validateConfig(
    data: unknown,
  ): TConfigSchema extends z.ZodType ? z.infer<TConfigSchema> : unknown {
    if (!this.plugin.configSchema) {
      return data as any;
    }

    const result = this.plugin.configSchema.safeParse(data);

    if (!result.success) {
      throw new Error(
        `Config validation failed: ${JSON.stringify(result.error.issues, null, 2)}`,
      );
    }

    return result.data;
  }

  /**
   * Get plugin metadata
   */
  getMetadata() {
    return {
      id: this.plugin.id,
      name: this.plugin.name,
      description: this.plugin.description,
      version: this.plugin.version,
      type: this.plugin.type,
      author: this.plugin.author,
      tags: this.plugin.tags,
      icon: this.plugin.icon,
      credentials: this.plugin.credentials,
    };
  }
}
