/**
 * Core Plugin Types
 *
 * Fundamental types shared across the plugin system.
 */

import type { CredentialRequest } from "./credentials";
import type { z } from "zod";

/**
 * Plugin tags for categorization and filtering
 */
export type PluginTag =
  | "logic"
  | "data-source"
  | "action"
  | "transformer"
  | "input"
  | "output"
  | "processor"
  | "data"
  | "condition"
  | "transform"
  | "llm"
  | "ai"
  | "text"
  | "openai"
  | "api"
  | "google"
  | "sheets";

/**
 * A record mapping credential keys (alias or ID) to their Zod schemas.
 */
export type CredentialSchemasRecord = Record<string, z.ZodType>;

/**
 * Infers the data type for a given CredentialSchemasRecord.
 */
export type InferCredentialsData<TSchemas extends CredentialSchemasRecord> = {
  [K in keyof TSchemas]: z.infer<TSchemas[K]>;
};

/**
 * Plugin execution context passed to the execute method
 *
 * Note: Loop state is managed by individual loop nodes via nodeState,
 * not by the execution engine. See loop-control plugin for example.
 */
export interface PluginContext<
  TCredentialsData extends Record<string, unknown> = Record<string, unknown>,
> {
  userId: string;
  routineId: string;
  executionId: string;
  nodeId: string;
  /**
   * Resolved credentials.
   * Keys are the credential ID (or alias), values are the decrypted credential objects.
   */
  credentials?: TCredentialsData;
  triggerData?: unknown;
}

/**
 * Plugin metadata (static properties)
 */
export interface PluginMetadata {
  /** Unique plugin identifier (e.g., 'if-else', 'http-request') */
  id: string;

  /** Human-readable plugin name */
  name: string;

  /** Plugin description */
  description: string;

  /** Semantic version */
  version: string;

  /** Plugin icon (emoji or URL) */
  icon?: string;

  /** Tags for discovery, search, and categorization */
  tags: PluginTag[];

  /** Author/publisher information */
  author?: {
    name: string;
    email?: string;
    url?: string;
  };

  /**
   * Credentials required by this plugin.
   * Defines which Credential Types this plugin needs.
   */
  credentialRequirements?: CredentialRequest[];

  /** JSON Schema exports for UI/documentation (optional, usually generated) */
  inputSchemaJson?: Record<string, unknown>;
  outputSchemaJson?: Record<string, unknown>;
  configSchemaJson?: Record<string, unknown>;
}
