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
} from "./registry";

// Export config registry
export {
  getPluginConfigComponent,
  hasPluginConfigUI,
} from "./config-registry";

// Export all builder-based plugins
export { staticDataPlugin } from "./static-data";
export { ifElsePlugin } from "./if-else";
export { httpRequestPlugin } from "./http";
