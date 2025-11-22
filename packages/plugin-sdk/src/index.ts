/**
 * Kianax Plugin SDK
 *
 * Utilities for building, testing, and validating Kianax plugins.
 */

// Re-export Zod for plugin developers
export { z } from "zod";

// Export types
export type {
  CredentialSchema,
  PluginTag,
} from "./types/common";

// Export Plugin base class and core types
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
