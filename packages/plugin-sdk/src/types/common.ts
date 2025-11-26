/**
 * Core Plugin Types
 *
 * Fundamental types shared across the plugin system.
 */

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
  | "transform";

/**
 * Plugin execution context passed to the execute method
 *
 * Note: Loop state is managed by individual loop nodes via nodeState,
 * not by the execution engine. See loop-control plugin for example.
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

  /** Credentials required by this plugin */
  credentials?: CredentialSchema[];

  /** JSON Schema exports for UI/documentation (optional, usually generated) */
  inputSchemaJson?: Record<string, unknown>;
  outputSchemaJson?: Record<string, unknown>;
  configSchemaJson?: Record<string, unknown>;
}
