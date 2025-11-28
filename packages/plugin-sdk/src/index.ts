/**
 * Kianax Plugin SDK
 *
 * Utilities for building, testing, and validating Kianax plugins.
 */

// Re-export Zod for plugin developers
export { z } from "zod";

// Export types
export type {
  PluginTag,
  CredentialSchemasRecord,
  InferCredentialsData,
  OutputHandle,
} from "./types/common";

export type {
  CredentialType,
  CredentialRequest,
} from "./types/credentials";

// Export enhanced port system
export {
  PortType,
  definePort,
  portToMetadata,
  isPortType,
  type PortDefinition,
  type PortMetadata,
} from "./types/ports";

// Export declarative parameter system
export {
  ParameterType,
  defineParameter,
  parameterToMetadata,
  isParameterType,
  shouldShowParameter,
  type ParameterDefinition,
  type ParameterMetadata,
  type ParameterOption,
  type ParameterTypeOptions,
  type DisplayCondition,
} from "./types/parameters";

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
