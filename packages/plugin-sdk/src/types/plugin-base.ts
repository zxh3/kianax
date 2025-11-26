import type { z } from "zod";
import type { ComponentType } from "react";
import type {
  PluginContext,
  PluginMetadata,
  CredentialSchemasRecord,
  InferCredentialsData,
} from "./common";

export type {
  PluginContext,
  PluginMetadata,
  CredentialSchemasRecord,
  InferCredentialsData,
};

/**
 * Plugin configuration UI component props
 */
export interface PluginConfigUIProps<
  TConfig = any,
  TCredentialsData extends Record<string, unknown> = Record<string, unknown>,
> {
  value?: TConfig;
  onChange: (value: TConfig) => void;
  /**
   * The resolved credentials, if any.
   * Useful for showing connected status or relevant info in the config UI.
   */
  credentials?: TCredentialsData;
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
 */
export abstract class Plugin<
  TConfig = unknown, // Now accepts inferred type
  TCredentialsData extends Record<string, unknown> = Record<string, unknown>,
> {
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
    PluginConfigUIProps<TConfig, TCredentialsData>
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
    config: TConfig,
    context: PluginContext<TCredentialsData>,
    nodeState: Record<string, unknown>,
  ): Promise<Record<string, any>>;

  /**
   * Optional: Validate inputs before execution
   * Override to add custom validation logic
   */
  async validate(
    inputs: Record<string, any>,
    config: TConfig,
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

  // ... (getMetadata, getId, getName, getTags, hasTag, getInputs, getOutputs, getInput, getOutput, canConnectTo, isSchemasCompatible are unchanged)

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
  ? TConfig
  : never;
