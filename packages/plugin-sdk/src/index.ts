/**
 * Kianax Plugin SDK
 *
 * Utilities for building, testing, and validating Kianax plugins.
 */

// Re-export Zod for plugin developers
export { z } from "zod";

// Export core types (legacy)
export type {
  Plugin as PluginInterface,
  PluginType,
  PluginContext as LegacyPluginContext,
  CredentialSchema,
  PluginMetadata as LegacyPluginMetadata,
} from "./types";

// Export plugin builder (legacy - prefer Plugin class)
export { definePlugin } from "./types/definePlugin";

// Export Plugin base class (recommended approach)
export {
  Plugin,
  type PluginMetadata,
  type PluginContext,
  type PluginConfigUIProps,
  type PluginPort,
  type PluginSchemas,
  type PluginConfig,
  isSchemasCompatible,
} from "./types/plugin-base";

// Export Plugin Builder (NEW - recommended for new plugins)
export {
  createPlugin,
  PluginBuilder,
  type BuilderPortDefinition,
  type ExecuteFunction,
} from "./builder";

// Export validation utilities
export {
  validateInput,
  validateOutput,
  validateConfig,
  PluginValidationError,
} from "./validation";

// Export testing utilities (separate entry point)
// import from "@kianax/plugin-sdk/testing"
