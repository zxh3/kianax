/**
 * Plugin Builder API (Flow-Based)
 *
 * Fluent builder pattern for creating plugins with full type inference.
 * In the flow-based system, all runtime data comes through config expressions.
 *
 * @example
 * ```typescript
 * // Flow-based plugin - all data comes through config
 * export const myPlugin = createPlugin("my-plugin")
 *   .withMetadata({
 *     name: "My Plugin",
 *     description: "Processes data from upstream nodes",
 *     version: "1.0.0",
 *     tags: ["processor"]
 *   })
 *   .withConfig(z.object({
 *     // Static config
 *     apiKey: z.string(),
 *     // Runtime data via expression: {{ nodes.upstream.output }}
 *     inputData: z.any(),
 *   }))
 *   .withOutputSchema(z.object({
 *     result: z.any(),
 *     metadata: z.object({ processedAt: z.string() })
 *   }))
 *   .execute(async ({ config, context }) => {
 *     // config.inputData is resolved from expression
 *     const data = config.inputData;
 *     return {
 *       output: {
 *         result: processData(data),
 *         metadata: { processedAt: new Date().toISOString() }
 *       }
 *     };
 *   })
 *   .build();
 * ```
 */

import { z } from "zod";
import type { ComponentType } from "react";
import { Plugin } from "./types/plugin-base";
import type {
  PluginMetadata,
  PluginPort,
  PluginContext,
  PluginConfigUIProps,
  CredentialSchemasRecord,
  InferCredentialsData,
} from "./types/plugin-base";
import type { OutputHandle } from "./types/common";
import type { CredentialType } from "./types/credentials"; // Import CredentialType

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
 * Execute function signature for flow-based plugins
 *
 * In the flow-based system, all data comes through config (with expressions resolved).
 * There is no separate `inputs` parameter - everything is in `config`.
 */
export type ExecuteFunction<
  TOutputs,
  TConfig,
  TCredentialsData extends Record<string, unknown>,
> = (params: {
  /** Plugin configuration with all expressions resolved */
  config: TConfig;
  /** Execution context (credentials, execution info, etc.) */
  context: PluginContext<TCredentialsData>;
  /** Persistent node state (for loop nodes, stateful operations, etc.) */
  nodeState: Record<string, unknown>;
}) => Promise<Partial<TOutputs>>;

/**
 * Internal state for tracking port schemas during build
 */
interface PortSchemaMap {
  [portName: string]: z.ZodType;
}

// Re-export OutputHandle for convenience
export type { OutputHandle } from "./types/common";

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
  TCredentialSchemas extends CredentialSchemasRecord = Record<
    string,
    z.ZodType
  >, // New: Accumulates credential schemas
  TCredentialsData extends Record<
    string,
    unknown
  > = InferCredentialsData<TCredentialSchemas>, // New: Inferred data type
> {
  private _id: string;
  private _metadata: Partial<PluginMetadata> = {};
  private _inputs: Map<string, PluginPort> = new Map();
  private _outputs: Map<string, PluginPort> = new Map();
  private _inputSchemas: Map<string, z.ZodType> = new Map();
  private _outputSchemas: Map<string, z.ZodType> = new Map();
  private _configSchema?: z.ZodType;
  private _execute?: ExecuteFunction<any, any, any>;
  private _configUI?: ComponentType<PluginConfigUIProps<any, any>>;

  private _credentialSchemas: CredentialSchemasRecord = {};

  // Flow-based system additions
  private _outputSchema?: z.ZodType; // Single output schema for flow-based plugins
  private _outputHandles: OutputHandle[] = []; // Control flow handles

  constructor(id: string) {
    this._id = id;
    this._metadata.id = id;
  }

  /**
   * Set plugin metadata
   */
  withMetadata(
    metadata: Omit<PluginMetadata, "id">,
  ): PluginBuilder<
    TInputSchemas,
    TOutputSchemas,
    TConfig,
    TCredentialSchemas,
    TCredentialsData
  > {
    this._metadata = { ...this._metadata, ...metadata, id: this._id };
    return this;
  }

  /**
   * Add an input port definition (for UI purposes only)
   *
   * @deprecated In the flow-based system, inputs come through config expressions.
   * This method is kept for backwards compatibility and UI purposes (showing input handles).
   * The input schema is NOT used at runtime - all data flows through config.
   */
  withInput<TName extends string, TSchema extends z.ZodType>(
    name: TName,
    port: { label: string; description?: string; schema: TSchema },
  ): PluginBuilder<
    TInputSchemas & Record<TName, TSchema>,
    TOutputSchemas,
    TConfig,
    TCredentialSchemas,
    TCredentialsData
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
   *
   * @deprecated For new plugins, prefer withOutputSchema() for data output definition
   * and withOutputHandles() for control flow routing. Port-based outputs are maintained
   * for backwards compatibility but the flow-based system uses handles for routing.
   */
  withOutput<TName extends string, TSchema extends z.ZodType>(
    name: TName,
    port: { label: string; description?: string; schema: TSchema },
  ): PluginBuilder<
    TInputSchemas,
    TOutputSchemas & Record<TName, TSchema>,
    TConfig,
    TCredentialSchemas,
    TCredentialsData
  > {
    this._outputs.set(name, {
      name,
      label: port.label,
      description: port.description,
      schema: port.schema,
    });
    this._outputSchemas.set(name, port.schema);

    // Also register as an output handle for flow-based routing
    if (!this._outputHandles.find((h) => h.name === name)) {
      this._outputHandles.push({
        name,
        label: port.label,
        description: port.description,
      });
    }

    return this as any;
  }

  /**
   * Define the output schema for flow-based plugins
   *
   * In the flow-based system, plugins declare a single output schema that describes
   * the shape of data they produce. This schema is used for:
   * - Autocomplete in expression inputs (shows available fields)
   * - Type validation at design time
   * - Documentation generation
   *
   * @example
   * ```typescript
   * createPlugin("http-request")
   *   .withOutputSchema(z.object({
   *     status: z.number(),
   *     data: z.unknown(),
   *     headers: z.record(z.string())
   *   }))
   * ```
   */
  withOutputSchema<TSchema extends z.ZodType>(
    schema: TSchema,
  ): PluginBuilder<
    TInputSchemas,
    TOutputSchemas & Record<"output", TSchema>,
    TConfig,
    TCredentialSchemas,
    TCredentialsData
  > {
    this._outputSchema = schema;

    // Also register as a default "output" port for compatibility
    this._outputs.set("output", {
      name: "output",
      label: "Output",
      description: "Plugin output data",
      schema: schema,
    });
    this._outputSchemas.set("output", schema);

    return this as any;
  }

  /**
   * Define output handles for control flow routing
   *
   * Control flow plugins (if-else, switch, try-catch) use handles to route
   * execution to different paths. Each handle represents a possible execution
   * path that downstream nodes can connect to.
   *
   * When a plugin returns data keyed by handle name (e.g., `{ true: data }`),
   * only edges connected to that handle will be activated.
   *
   * @example
   * ```typescript
   * createPlugin("if-else")
   *   .withOutputHandles([
   *     { name: "true", label: "True", description: "Condition passed" },
   *     { name: "false", label: "False", description: "Condition failed" }
   *   ])
   * ```
   *
   * @example
   * ```typescript
   * createPlugin("try-catch")
   *   .withOutputHandles([
   *     { name: "success", label: "Success", description: "Execution succeeded" },
   *     { name: "error", label: "Error", description: "Execution failed" }
   *   ])
   * ```
   */
  withOutputHandles(
    handles: OutputHandle[],
  ): PluginBuilder<
    TInputSchemas,
    TOutputSchemas,
    TConfig,
    TCredentialSchemas,
    TCredentialsData
  > {
    this._outputHandles = handles;

    // Register handles as output ports for backwards compatibility with execution engine
    for (const handle of handles) {
      if (!this._outputs.has(handle.name)) {
        this._outputs.set(handle.name, {
          name: handle.name,
          label: handle.label,
          description: handle.description,
          schema: z.unknown(), // Handles don't have specific schemas
        });
      }
    }

    return this;
  }

  /**
   * Get the registered output handles
   * Used internally for execution engine and UI
   */
  getOutputHandles(): OutputHandle[] {
    return this._outputHandles;
  }

  /**
   * Get the output schema (for flow-based plugins)
   * Used internally for autocomplete and validation
   */
  getOutputSchema(): z.ZodType | undefined {
    return this._outputSchema;
  }

  /**
   * Set configuration schema with type tracking
   */
  withConfig<TConfigSchema extends z.ZodType>(
    schema: TConfigSchema,
  ): PluginBuilder<
    TInputSchemas,
    TOutputSchemas,
    z.infer<TConfigSchema>,
    TCredentialSchemas,
    TCredentialsData
  > {
    this._configSchema = schema;
    return this as any;
  }

  /**
   * Require a specific credential type for this plugin.
   *
   * @param credentialType - The credential definition object (containing ID and schema)
   * @param alias - Optional alias to refer to this credential in the execution context (e.g. "openai")
   * @param required - Whether this credential is strictly required (default: true)
   */
  requireCredential<
    TCred extends CredentialType<any, any>,
    TAlias extends string | undefined = undefined,
  >(
    credentialType: TCred,
    alias?: TAlias,
    required = true,
  ): PluginBuilder<
    TInputSchemas,
    TOutputSchemas,
    TConfig,
    TCredentialSchemas & {
      [_ in TAlias extends string
        ? TAlias
        : TCred["id"]]: TCred["runtimeSchema"] extends z.ZodType
        ? TCred["runtimeSchema"]
        : TCred["schema"];
    },
    InferCredentialsData<
      TCredentialSchemas & {
        [_ in TAlias extends string
          ? TAlias
          : TCred["id"]]: TCred["runtimeSchema"] extends z.ZodType
          ? TCred["runtimeSchema"]
          : TCred["schema"];
      }
    >
  > {
    const key = (alias || credentialType.id) as string;

    // Use runtimeSchema for context typing, but we still store the input schema for validation?
    // Actually, for execution context typing we want the runtime schema.
    // The builder stores schemas in `_credentialSchemas`.
    // This stored schema is used for validation?
    // If we use `runtimeSchema` here, we are saying "Context will have data matching this schema".
    // This is correct for `execute`.

    const effectiveSchema =
      credentialType.runtimeSchema || credentialType.schema;

    this._credentialSchemas = {
      ...this._credentialSchemas,
      [key]: effectiveSchema,
    };

    if (!this._metadata.credentialRequirements) {
      this._metadata.credentialRequirements = [];
    }
    this._metadata.credentialRequirements.push({
      id: credentialType.id,
      alias,
      required,
    });
    return this as any;
  }

  /**
   * Set configuration UI component
   */
  withConfigUI(
    component: ComponentType<PluginConfigUIProps<TConfig, TCredentialsData>>, // Updated
  ): PluginBuilder<
    TInputSchemas,
    TOutputSchemas,
    TConfig,
    TCredentialSchemas,
    TCredentialsData
  > {
    this._configUI = component;
    return this;
  }

  /**
   * Set execute function with full type inference
   *
   * In the flow-based system, all data comes through config (expressions resolved).
   * The outputs and config parameters are fully typed based on schemas defined above.
   */
  execute(
    fn: ExecuteFunction<
      InferSchemaRecord<TOutputSchemas>,
      TConfig,
      TCredentialsData
    >,
  ): PluginBuilder<
    TInputSchemas,
    TOutputSchemas,
    TConfig,
    TCredentialSchemas,
    TCredentialsData
  > {
    this._execute = fn;
    return this;
  }

  /**
   * Build the final Plugin instance
   *
   * Validates that all required fields are set and returns a Plugin instance
   * that's compatible with the existing plugin system.
   */
  build(): Plugin<
    TConfig extends z.ZodType ? z.infer<TConfig> : unknown, // TConfig (inferred)
    TCredentialsData // TCredentialsData
  > {
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

    // Auto-register a default "input" handle if no input was explicitly defined
    // This ensures all nodes have an input connection point for the UI
    if (this._inputs.size === 0) {
      this._inputs.set("input", {
        name: "input",
        label: "Input",
        description: "Node input (connects from upstream nodes)",
        schema: z.unknown(),
      });
    }

    // Add output handles to metadata if any are defined
    const metadata: PluginMetadata = {
      ...(this._metadata as PluginMetadata),
      outputHandles:
        this._outputHandles.length > 0 ? this._outputHandles : undefined,
    };

    // Create and return BuiltPlugin instance
    return new BuiltPlugin({
      metadata,
      inputs: this._inputs,
      outputs: this._outputs,
      outputSchema: this._outputSchema,
      configSchema: this._configSchema,
      execute: this._execute as any, // Cast due to complex generic type matching
      configUI: this._configUI as any, // Cast
      credentialSchemas: this._credentialSchemas,
    });
  }
}

/**
 * BuiltPlugin - Adapter class that makes builder output compatible with Plugin interface
 *
 * This class wraps the builder's configuration and implements the Plugin abstract class,
 * allowing builder-created plugins to work seamlessly with the existing plugin system.
 */
class BuiltPlugin<
  TConfig = unknown,
  TCredentialsData extends Record<string, unknown> = Record<string, unknown>,
> extends Plugin<TConfig, TCredentialsData> {
  static metadata: PluginMetadata; // Static metadata (not tied to generics)

  private _metadata: PluginMetadata;
  private _inputs: Map<string, PluginPort>;
  private _outputs: Map<string, PluginPort>;
  private _outputSchema?: z.ZodType; // Flow-based output schema
  private _configSchema?: z.ZodType;
  private _execute: ExecuteFunction<any, any, TCredentialsData>;
  private _configUI?: ComponentType<PluginConfigUIProps<any, TCredentialsData>>;

  constructor(config: {
    metadata: PluginMetadata;
    inputs: Map<string, PluginPort>;
    outputs: Map<string, PluginPort>;
    outputSchema?: z.ZodType;
    configSchema?: z.ZodType;
    execute: ExecuteFunction<any, any, TCredentialsData>;
    configUI?: ComponentType<PluginConfigUIProps<any, TCredentialsData>>;
    credentialSchemas: CredentialSchemasRecord;
  }) {
    super();

    // Store metadata on instance (not on shared static property)
    this._metadata = config.metadata;

    this._inputs = config.inputs;
    this._outputs = config.outputs;
    this._outputSchema = config.outputSchema;
    this._configSchema = config.configSchema;
    this._execute = config.execute;
    this._configUI = config.configUI;
  }

  /**
   * Get the output schema for flow-based plugins
   * Used for autocomplete and type validation
   */
  getOutputSchema(): z.ZodType | undefined {
    return this._outputSchema;
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
    // Pass resolved credentials to config UI if needed
    // TODO: The UI needs a way to get actual resolved credentials to pass here.
    // For now, configUI only receives TConfig and onChange.
    return this._configUI || null;
  }

  /**
   * Implement execute() from Plugin base class
   *
   * In the flow-based system, inputs are ignored - all data comes through config.
   */
  async execute(
    _inputs: Record<string, any>, // Ignored in flow-based system
    config: TConfig,
    context: PluginContext<TCredentialsData>,
    nodeState: Record<string, unknown>,
  ): Promise<Record<string, any>> {
    // Flow-based: pass only config (with expressions resolved), context, and nodeState
    const result = await this._execute({ config, context, nodeState });
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
 * // Flow-based plugin example
 * const plugin = createPlugin("weather-api")
 *   .withMetadata({
 *     name: "Weather API",
 *     description: "Fetch weather data for a location",
 *     version: "1.0.0",
 *     tags: ["api", "data-source"]
 *   })
 *   .withConfig(z.object({
 *     // Expression: {{ nodes.upstream.output.city }}
 *     city: z.string(),
 *     units: z.enum(["celsius", "fahrenheit"]).default("celsius"),
 *   }))
 *   .withOutputSchema(z.object({
 *     temp: z.number(),
 *     humidity: z.number(),
 *     description: z.string(),
 *   }))
 *   .execute(async ({ config }) => {
 *     const weather = await fetchWeather(config.city, config.units);
 *     return { output: weather };
 *   })
 *   .build();
 * ```
 */
export function createPlugin(id: string): PluginBuilder {
  return new PluginBuilder(id);
}
