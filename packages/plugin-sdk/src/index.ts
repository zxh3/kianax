/**
 * Kianax Plugin SDK
 *
 * Utilities for building, testing, and validating Kianax plugins.
 */

// Re-export Zod for plugin developers
export { z } from "zod";

// Export core types
export type {
  Plugin,
  PluginType,
  PluginContext,
  CredentialSchema,
  PluginMetadata,
} from "./types/index.js";

// Export plugin builder
export { definePlugin } from "./types/definePlugin.js";

// Export validation utilities
export {
  validateInput,
  validateOutput,
  validateConfig,
  PluginValidationError,
} from "./validation/index.js";

// Export testing utilities (separate entry point)
// import from "@kianax/plugin-sdk/testing"
