/**
 * Plugin Type Definitions
 *
 * Defines the structure and types for the Kianax plugin system.
 * Plugins are the building blocks of routines.
 */

import type { JSONSchema7 } from "json-schema";

/**
 * Plugin execution context passed to the execute function
 */
export interface PluginContext {
  userId: string;
  routineId: string;
  executionId: string;
  credentials?: Record<string, string>;
  triggerData?: unknown;
}

/**
 * Base plugin interface that all plugins must implement
 */
export interface Plugin<
  TInput = unknown,
  TOutput = unknown,
  TConfig = unknown,
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

  /** JSON Schema for input validation */
  inputSchema: JSONSchema7;

  /** JSON Schema for output validation */
  outputSchema: JSONSchema7;

  /** JSON Schema for plugin configuration */
  configSchema?: JSONSchema7;

  /** Credentials required by this plugin */
  credentials?: CredentialSchema[];

  /** Plugin tags for discovery */
  tags?: string[];

  /** Plugin icon (URL or emoji) */
  icon?: string;

  /** Execute the plugin logic */
  execute: (
    input: TInput,
    config: TConfig,
    context: PluginContext,
  ) => Promise<TOutput>;
}

/**
 * Credential schema for plugins that require API keys, tokens, etc.
 */
export interface CredentialSchema {
  /** Credential identifier */
  key: string;

  /** Display label */
  label: string;

  /** Field description */
  description?: string;

  /** Input type (password, text, etc.) */
  type: "password" | "text" | "oauth";

  /** Whether this credential is required */
  required: boolean;

  /** Validation regex pattern */
  pattern?: string;

  /** OAuth configuration (if type is 'oauth') */
  oauth?: {
    provider: string;
    scopes: string[];
  };
}

/**
 * Plugin metadata stored in the marketplace
 */
export interface PluginMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  author: {
    name: string;
    email?: string;
    url?: string;
  };
  tags: string[];
  icon?: string;
  downloads: number;
  rating: number;
  reviewCount: number;
  createdAt: number;
  updatedAt: number;
  inputSchema: JSONSchema7;
  outputSchema: JSONSchema7;
  configSchema?: JSONSchema7;
  credentials?: CredentialSchema[];
}

/**
 * Installed plugin instance for a user
 */
export interface InstalledPlugin {
  id: string;
  userId: string;
  pluginId: string;
  version: string;
  installedAt: number;
  enabled: boolean;
  config?: Record<string, unknown>;
  credentialsSet: boolean;
}

/**
 * Plugin credential storage (encrypted in database)
 */
export interface PluginCredentials {
  id: string;
  userId: string;
  pluginId: string;
  credentials: Record<string, string>; // Encrypted in Convex
  createdAt: number;
  updatedAt: number;
}
