/**
 * Plugin Builder API
 *
 * Fluent builder pattern for creating plugins with full type inference.
 * Provides better type safety and developer experience compared to class-based approach.
 *
 * @example
 * ```typescript
 * export const myPlugin = createPlugin("my-plugin")
 *   .withMetadata({ name: "My Plugin", description: "...", version: "1.0.0" })
 *   .withInput("query", {
 *     label: "Query",
 *     schema: z.object({ text: z.string() })
 *   })
 *   .withOutput("results", {
 *     label: "Results",
 *     schema: z.object({ items: z.array(z.string()) })
 *   })
 *   .withConfig(z.object({ apiKey: z.string() }))
 *   .execute(async ({ inputs, config, context }) => {
 *     const query = inputs.query.text;  // Fully typed!
 *     const apiKey = config.apiKey;      // Fully typed!
 *     return { results: { items: [] } };
 *   })
 *   .build();
 * ```
 */

import type { z } from "zod";
import type { ComponentType } from "react";
import { Plugin } from "./types/plugin-base";
import type {
  PluginMetadata,
  PluginPort,
  PluginContext,
  PluginConfigUIProps,
} from "./types/plugin-base";

/**
 * Extract inferred types from a record of Zod schemas
 */
type InferSchemaRecord<T extends Record<string, z.ZodType>> = {
  [K in keyof T]: z.infer<T[K]>;
};

/**
 * Port definition for builder (without redundant name field)
 */
export interface BuilderPortDefinition {
  label: string;
  description?: string;
  schema: z.ZodType;
}

/**
 * Execute function signature with full type inference
 */
export type ExecuteFunction<TInputs, TOutputs, TConfig> = (params: {
  inputs: TInputs;
  config: TConfig;
  context: PluginContext;
  /** Persistent node state (for loop nodes, stateful operations, etc.) */
  nodeState: Record<string, unknown>;
}) => Promise<Partial<TOutputs>>;

/**
 * Internal state for tracking port schemas during build
 */
interface PortSchemaMap {
  [portName: string]: z.ZodType;
}

/**
 * Plugin Builder with progressive type accumulation
 *
 * Each method call adds to the type signature, ensuring full type safety
 * throughout the building process.
 */
export class PluginBuilder<
  TInputSchemas extends PortSchemaMap = Record<
    string,
    z.ZodType<any, any, any>
  >,
  TOutputSchemas extends PortSchemaMap = Record<
    string,
    z.ZodType<any, any, any>
  >,
  TConfig = unknown,
> {
  private _id: string;
  private _metadata: Partial<PluginMetadata> = {};
  private _inputs: Map<string, PluginPort> = new Map();
  private _outputs: Map<string, PluginPort> = new Map();
  private _inputSchemas: Map<string, z.ZodType> = new Map();
  private _outputSchemas: Map<string, z.ZodType> = new Map();
  private _configSchema?: z.ZodType;
  private _execute?: ExecuteFunction<any, any, any>;
  private _configUI?: ComponentType<PluginConfigUIProps<any>>;

  constructor(id: string) {
    this._id = id;
    this._metadata.id = id;
  }

  /**
   * Set plugin metadata
   */
  withMetadata(
    metadata: Omit<PluginMetadata, "id">,
  ): PluginBuilder<TInputSchemas, TOutputSchemas, TConfig> {
    this._metadata = { ...this._metadata, ...metadata, id: this._id };
    return this;
  }

  /**
   * Add an input port with full type tracking
   */
  withInput<TName extends string, TSchema extends z.ZodType>(
    name: TName,
    port: { label: string; description?: string; schema: TSchema },
  ): PluginBuilder<
    TInputSchemas & Record<TName, TSchema>,
    TOutputSchemas,
    TConfig
  > {
    this._inputs.set(name, {
      name,
      label: port.label,
      description: port.description,
      schema: port.schema,
    });
    this._inputSchemas.set(name, port.schema);
    return this as any;
  }

  /**
   * Add an output port with full type tracking
   */
  withOutput<TName extends string, TSchema extends z.ZodType>(
    name: TName,
    port: { label: string; description?: string; schema: TSchema },
  ): PluginBuilder<
    TInputSchemas,
    TOutputSchemas & Record<TName, TSchema>,
    TConfig
  > {
    this._outputs.set(name, {
      name,
      label: port.label,
      description: port.description,
      schema: port.schema,
    });
    this._outputSchemas.set(name, port.schema);
    return this as any;
  }

  /**
   * Set configuration schema with type tracking
   */
  withConfig<TConfigSchema extends z.ZodType>(
    schema: TConfigSchema,
  ): PluginBuilder<TInputSchemas, TOutputSchemas, z.infer<TConfigSchema>> {
    this._configSchema = schema;
    return this as any;
  }

  /**
   * Set required credentials
   */
  withCredentials(
    credentials: NonNullable<PluginMetadata["credentials"]>,
  ): PluginBuilder<TInputSchemas, TOutputSchemas, TConfig> {
    this._metadata.credentials = credentials;
    return this;
  }

  /**
   * Set configuration UI component
   */
  withConfigUI(
    component: ComponentType<PluginConfigUIProps<TConfig>>,
  ): PluginBuilder<TInputSchemas, TOutputSchemas, TConfig> {
    this._configUI = component;
    return this;
  }

  /**
   * Set execute function with full type inference
   *
   * The inputs, outputs, and config parameters are all fully typed based on
   * the schemas defined in previous builder calls!
   */
  execute(
    fn: ExecuteFunction<
      InferSchemaRecord<TInputSchemas>,
      InferSchemaRecord<TOutputSchemas>,
      TConfig
    >,
  ): PluginBuilder<TInputSchemas, TOutputSchemas, TConfig> {
    this._execute = fn;
    return this;
  }

  /**
   * Build the final Plugin instance
   *
   * Validates that all required fields are set and returns a Plugin instance
   * that's compatible with the existing plugin system.
   */
  build(): Plugin {
    // Validate required fields
    if (!this._id) {
      throw new Error("Plugin ID is required");
    }

    if (!this._metadata.name) {
      throw new Error("Plugin name is required (use .withMetadata())");
    }

    if (!this._metadata.description) {
      throw new Error("Plugin description is required (use .withMetadata())");
    }

    if (!this._metadata.version) {
      throw new Error("Plugin version is required (use .withMetadata())");
    }

    if (!this._metadata.tags || this._metadata.tags.length === 0) {
      throw new Error("Plugin tags are required (use .withMetadata())");
    }

    if (!this._execute) {
      throw new Error("Plugin execute function is required (use .execute())");
    }

    if (this._outputs.size === 0) {
      throw new Error("At least one output is required (use .withOutput())");
    }

    // Create and return BuiltPlugin instance
    return new BuiltPlugin({
      metadata: this._metadata as PluginMetadata,
      inputs: this._inputs,
      outputs: this._outputs,
      configSchema: this._configSchema,
      execute: this._execute,
      configUI: this._configUI,
    });
  }
}

/**
 * BuiltPlugin - Adapter class that makes builder output compatible with Plugin interface
 *
 * This class wraps the builder's configuration and implements the Plugin abstract class,
 * allowing builder-created plugins to work seamlessly with the existing plugin system.
 */
class BuiltPlugin extends Plugin {
  static metadata: PluginMetadata;

  private _metadata: PluginMetadata;
  private _inputs: Map<string, PluginPort>;
  private _outputs: Map<string, PluginPort>;
  private _configSchema?: z.ZodType;
  private _execute: ExecuteFunction<any, any, any>;
  private _configUI?: ComponentType<PluginConfigUIProps<any>>;

  constructor(config: {
    metadata: PluginMetadata;
    inputs: Map<string, PluginPort>;
    outputs: Map<string, PluginPort>;
    configSchema?: z.ZodType;
    execute: ExecuteFunction<any, any, any>;
    configUI?: ComponentType<PluginConfigUIProps<any>>;
  }) {
    super();

    // Store metadata on instance (not on shared static property)
    this._metadata = config.metadata;

    this._inputs = config.inputs;
    this._outputs = config.outputs;
    this._configSchema = config.configSchema;
    this._execute = config.execute;
    this._configUI = config.configUI;
  }

  /**
   * Override getMetadata() to return instance metadata
   */
  getMetadata(): PluginMetadata {
    return this._metadata;
  }

  /**
   * Implement defineSchemas() from Plugin base class
   */
  defineSchemas() {
    return {
      inputs: Object.fromEntries(this._inputs),
      outputs: Object.fromEntries(this._outputs),
      config: this._configSchema,
    };
  }

  /**
   * Implement getConfigUI() from Plugin base class
   */
  getConfigUI() {
    return this._configUI || null;
  }

  /**
   * Implement execute() from Plugin base class
   */
  async execute(
    inputs: Record<string, any>,
    config: any,
    context: PluginContext,
    nodeState: Record<string, unknown>,
  ): Promise<Record<string, any>> {
    const result = await this._execute({ inputs, config, context, nodeState });
    return result as Record<string, any>;
  }
}

/**
 * Create a new plugin builder
 *
 * @param id - Unique plugin identifier (e.g., 'my-plugin', 'http-request')
 * @returns A new PluginBuilder instance
 *
 * @example
 * ```typescript
 * const plugin = createPlugin("weather-api")
 *   .withMetadata({
 *     name: "Weather API",
 *     description: "Fetch weather data",
 *     version: "1.0.0",
 *     tags: ["api", "weather", "input"]
 *   })
 *   .withInput("location", {
 *     label: "Location",
 *     schema: z.object({ city: z.string() })
 *   })
 *   .withOutput("weather", {
 *     label: "Weather Data",
 *     schema: z.object({ temp: z.number() })
 *   })
 *   .execute(async ({ inputs }) => {
 *     return { weather: { temp: 72 } };
 *   })
 *   .build();
 * ```
 */
export function createPlugin(id: string): PluginBuilder {
  return new PluginBuilder(id);
}
