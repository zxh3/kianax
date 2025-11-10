/**
 * Kianax Plugins
 *
 * Core platform plugins for routine execution.
 */

// Export types
export type { PluginMetadata, PluginType, Plugin } from "@kianax/plugin-sdk";

// Export plugin registry
export {
  pluginRegistry,
  getPlugin,
  getAllPlugins,
  getPluginsByType,
  getPluginsByTag,
  searchPlugins,
  isValidPluginId,
  getPluginMetadata,
  getAllPluginMetadata,
} from "./registry";

// Export individual plugins
export { aiTransform } from "./transformers/ai";
export { stockPrice } from "./data-sources/stock-price";
export { httpRequest } from "./actions/http";
export { email } from "./actions/email";
export { ifElse } from "./conditions/if-else";
