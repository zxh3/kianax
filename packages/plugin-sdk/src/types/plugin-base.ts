/**
 * Base Plugin Class
 *
 * All plugins extend this class and define their metadata, schemas, and execution logic.
 * Provides a clean, object-oriented API for plugin authors.
 */

import type { z } from "zod";
import type { ComponentType } from "react";
import type { PluginContext, PluginMetadata } from "./common";

export type { PluginContext, PluginMetadata };

/**
 * Plugin configuration UI component props
 */
export interface PluginConfigUIProps<TConfig = any> {
  value?: TConfig;
  onChange: (value: TConfig) => void;
}

/**
 * Named port definition (input or output)
 */
export interface PluginPort {
  /** Port name (used for connections) */
  name: string;
  /** Port label (displayed in UI) */
  label: string;
  /** Port description */
  description?: string;
  /** Zod schema for this port */
  schema: z.ZodType;
}

/**
 * Plugin schemas with named inputs/outputs
 */
export interface PluginSchemas {
  /** Named input ports */
  inputs: Record<string, PluginPort>;
  /** Named output ports */
  outputs: Record<string, PluginPort>;
  /** Optional config schema */
  config?: z.ZodType;
}

/**
 * Base Plugin Class
 *
 * @example
 * ```typescript
 * import { Plugin, z } from "@kianax/plugin-sdk";
 * import { MyConfigUI } from "./config-ui";
 *
 * export class MyPlugin extends Plugin {
 *   static metadata = {
 *     id: "my-plugin",
 *     name: "My Plugin",
 *     description: "Does something cool",
 *     version: "1.0.0",
 *     icon: "🚀",
 *     tags: ["api", "data", "input"],
 *   };
 *
 *   defineSchemas() {
 *     return {
 *       inputs: {
 *         query: {
 *           name: "query",
 *           label: "Search Query",
 *           description: "Text to search for",
 *           schema: z.object({ text: z.string() })
 *         }
 *       },
 *       outputs: {
 *         results: {
 *           name: "results",
 *           label: "Search Results",
 *           schema: z.object({ items: z.array(z.string()) })
 *         },
 *         count: {
 *           name: "count",
 *           label: "Result Count",
 *           schema: z.object({ total: z.number() })
 *         }
 *       },
 *       config: z.object({ apiKey: z.string() }),
 *     };
 *   }
 *
 *   getConfigUI() {
 *     return MyConfigUI;
 *   }
 *
 *   async execute(inputs, config, context) {
 *     // inputs: { query: { text: "..." } }
 *     // Return outputs: { results: { items: [...] }, count: { total: 5 } }
 *     return {
 *       results: { items: [] },
 *       count: { total: 0 }
 *     };
 *   }
 * }
 * ```
 */
export abstract class Plugin<TConfigSchema extends z.ZodType = z.ZodType> {
  /**
   * Static metadata about the plugin
   * Must be defined by subclasses
   */
  static metadata: PluginMetadata;

  /**
   * Define the plugin's schemas with named inputs/outputs
   * Must be implemented by subclasses
   */
  abstract defineSchemas(): PluginSchemas;

  /**
   * Optional: Provide a configuration UI component
   * Return null if no configuration is needed
   */
  getConfigUI(): ComponentType<
    PluginConfigUIProps<
      TConfigSchema extends z.ZodType ? z.infer<TConfigSchema> : unknown
    >
  > | null {
    return null;
  }

  /**
   * Execute the plugin logic
   * Must be implemented by subclasses
   *
   * @param inputs - Record of input port names to their values
   * @param config - Plugin configuration
   * @param context - Execution context
   * @param nodeState - Persistent node state (for loop nodes, stateful operations, etc.)
   * @returns Record of output port names to their values
   */
  abstract execute(
    inputs: Record<string, any>,
    config: TConfigSchema extends z.ZodType ? z.infer<TConfigSchema> : unknown,
    context: PluginContext,
    nodeState: Record<string, unknown>,
  ): Promise<Record<string, any>>;

  /**
   * Optional: Validate inputs before execution
   * Override to add custom validation logic
   */
  async validate(
    inputs: Record<string, any>,
    config: TConfigSchema extends z.ZodType ? z.infer<TConfigSchema> : unknown,
  ): Promise<{ valid: boolean; errors?: string[] }> {
    const schemas = this.defineSchemas();
    const errors: string[] = [];

    try {
      // Validate each input
      for (const [portName, portDef] of Object.entries(schemas.inputs)) {
        const inputValue = inputs[portName];
        if (inputValue === undefined) {
          errors.push(`Missing required input: ${portName}`);
          continue;
        }

        try {
          portDef.schema.parse(inputValue);
        } catch (error: any) {
          errors.push(`Invalid input '${portName}': ${error.message}`);
        }
      }

      // Validate config if schema exists
      if (schemas.config && config !== undefined) {
        try {
          schemas.config.parse(config);
        } catch (error: any) {
          errors.push(`Invalid config: ${error.message}`);
        }
      }

      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      return {
        valid: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Get plugin metadata
   * Accesses the static metadata property
   */
  getMetadata(): PluginMetadata {
    return (this.constructor as typeof Plugin).metadata;
  }

  /**
   * Get plugin ID
   */
  getId(): string {
    return this.getMetadata().id;
  }

  /**
   * Get plugin name
   */
  getName(): string {
    return this.getMetadata().name;
  }

  /**
   * Get plugin tags
   */
  getTags(): string[] {
    return this.getMetadata().tags;
  }

  /**
   * Check if plugin has a specific tag
   */
  hasTag(tag: string): boolean {
    // We can cast tag to PluginTag for the check since includes checks value equality
    return this.getTags().includes(tag as any);
  }

  /**
   * Get all input port definitions
   */
  getInputs(): Record<string, PluginPort> {
    return this.defineSchemas().inputs;
  }

  /**
   * Get all output port definitions
   */
  getOutputs(): Record<string, PluginPort> {
    return this.defineSchemas().outputs;
  }

  /**
   * Get a specific input port
   */
  getInput(name: string): PluginPort | undefined {
    return this.getInputs()[name];
  }

  /**
   * Get a specific output port
   */
  getOutput(name: string): PluginPort | undefined {
    return this.getOutputs()[name];
  }

  /**
   * Check if this plugin can connect to another plugin
   * (if any output schema matches any input schema of target)
   */
  canConnectTo(target: Plugin, outputPort: string, inputPort: string): boolean {
    const myOutput = this.getOutput(outputPort);
    const targetInput = target.getInput(inputPort);

    if (!myOutput || !targetInput) {
      return false;
    }

    // TODO: Implement schema compatibility check
    // For now, just check if both exist
    return true;
  }
}

/**
 * Helper to check if two Zod schemas are compatible
 * (one can be assigned to the other)
 */
export function isSchemasCompatible(
  outputSchema: z.ZodType,
  inputSchema: z.ZodType,
): boolean {
  // Basic compatibility check
  // TODO: Implement more sophisticated schema comparison
  // For now, we'll do a simple JSON schema comparison

  try {
    // If schemas are identical, they're compatible
    return (
      outputSchema === inputSchema ||
      JSON.stringify(outputSchema._def) === JSON.stringify(inputSchema._def)
    );
  } catch {
    return false;
  }
}

/**
 * Type helper to extract config type from a plugin class
 */
export type PluginConfig<T extends Plugin<any>> = T extends Plugin<
  infer TConfig
>
  ? TConfig extends z.ZodType
    ? z.infer<TConfig>
    : unknown
  : never;
