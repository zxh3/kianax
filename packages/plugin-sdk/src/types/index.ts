/**
 * Plugin Type Definitions (Zod-based)
 *
 * Uses Zod for runtime validation and TypeScript type inference.
 */

import type { z } from "zod";

/**
 * Plugin types determine their role in a routine
 */
export type PluginType = "input" | "processor" | "logic" | "output";

/**
 * Plugin tags for categorization and filtering
 */
export type PluginTag = "logic" | "data-source" | "action" | "transformer";

/**
 * Plugin execution context passed to the execute function
 */
export interface PluginContext {
  userId: string;
  routineId: string;
  executionId: string;
  nodeId: string;
  credentials?: Record<string, string>;
  triggerData?: unknown;
}

/**
 * Credential schema for plugins that require API keys, tokens, etc.
 */
export interface CredentialSchema {
  key: string;
  label: string;
  description?: string;
  type: "password" | "text" | "oauth";
  required: boolean;
  pattern?: string;
  oauth?: {
    provider: string;
    scopes: string[];
  };
}

/**
 * Base plugin interface using Zod schemas
 */
export interface Plugin<
  TInputSchema extends z.ZodType = z.ZodType,
  TOutputSchema extends z.ZodType = z.ZodType,
  TConfigSchema extends z.ZodType = z.ZodType,
> {
  /** Unique plugin identifier (e.g., 'stock-price-polygon') */
  id: string;

  /** Human-readable plugin name */
  name: string;

  /** Plugin description */
  description: string;

  /** Semantic version */
  version: string;

  /** Plugin category */
  type: PluginType;

  /** Author/publisher information */
  author?: {
    name: string;
    email?: string;
    url?: string;
  };

  /** Zod schema for input validation */
  inputSchema: TInputSchema;

  /** Zod schema for output validation */
  outputSchema: TOutputSchema;

  /** Zod schema for plugin configuration (optional) */
  configSchema?: TConfigSchema;

  /** Credentials required by this plugin */
  credentials?: CredentialSchema[];

  /** Plugin tags for discovery */
  tags?: PluginTag[];

  /** Plugin icon (URL or emoji) */
  icon?: string;

  /** Execute the plugin logic */
  execute: (
    input: z.infer<TInputSchema>,
    config: TConfigSchema extends z.ZodType ? z.infer<TConfigSchema> : unknown,
    context: PluginContext,
  ) => Promise<z.infer<TOutputSchema>>;
}

/**
 * Plugin metadata (for marketplace/registry)
 */
export interface PluginMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  type: PluginType;
  author?: {
    name: string;
    email?: string;
    url?: string;
  };
  tags?: PluginTag[];
  icon?: string;
  credentials?: CredentialSchema[];
  // JSON Schema exports for UI/documentation
  inputSchemaJson?: Record<string, unknown>;
  outputSchemaJson?: Record<string, unknown>;
  configSchemaJson?: Record<string, unknown>;
}
