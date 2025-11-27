/**
 * Kianax Plugins
 *
 * Core platform plugins for routine execution.
 * Flat structure - all plugins in root level folders.
 */

// Export plugin registry
export {
  pluginRegistry,
  getPlugin,
  getAllPlugins,
  getPluginsByTag,
  searchPlugins,
  isValidPluginId,
  getPluginMetadata,
  getAllPluginMetadata,
  createPluginInstance,
  getPluginOutputs,
} from "./registry";

// Export config registry
export {
  getPluginConfigComponent,
  hasPluginConfigUI,
  type PluginConfigProps,
  type ExpressionContext as PluginExpressionContext,
} from "./config-registry";

// Export credential registry
export {
  registerCredential,
  getCredentialType,
  getAllCredentialTypes,
} from "./credentials/registry";

// Re-export types
export type { CredentialType } from "@kianax/plugin-sdk";

// Export all builder-based plugins
export { staticDataPlugin } from "./static-data";
export { openaiMessagePlugin } from "./openai";
export { googleSheetsPlugin } from "./google-sheets";
export { ifElsePlugin } from "./if-else";
export { httpRequestPlugin } from "./http";
