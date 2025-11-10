/**
 * Kianax Plugins
 *
 * Core platform plugins for routine execution.
 */

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
} from "./registry.js";

// Export individual plugins
export { aiTransform } from "./transformers/ai/index.js";
export { stockPrice } from "./data-sources/stock-price/index.js";
export { httpRequest } from "./actions/http/index.js";
export { email } from "./actions/email/index.js";
export { ifElse } from "./conditions/if-else/index.js";
