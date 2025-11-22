/**
 * Plugin Type Definitions (Zod-based) - LEGACY
 *
 * Uses Zod for runtime validation and TypeScript type inference.
 */

import type { z } from "zod";
import type {
  PluginTag,
  PluginContext,
  CredentialSchema,
  PluginMetadata,
} from "./common";

export type { PluginTag, PluginContext, CredentialSchema, PluginMetadata };

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
