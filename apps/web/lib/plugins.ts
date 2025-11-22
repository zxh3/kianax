/**
 * Plugin utilities for web app
 *
 * Provides helpers to interact with the plugin system
 */

import { getAllPluginMetadata, createPluginInstance } from "@kianax/plugins";
import type { PluginMetadata, PluginTag } from "@kianax/plugin-sdk";

/**
 * Get all available plugins
 */
export function getAllPlugins(): PluginMetadata[] {
  return getAllPluginMetadata();
}

/**
 * Get plugins by tag
 */
export function getPluginsByTag(tag: PluginTag): PluginMetadata[] {
  return getAllPluginMetadata().filter((p) => p.tags?.includes(tag));
}

/**
 * Get plugin input port definitions
 */
export function getPluginInputs(
  pluginId: string,
): Record<string, { name: string; label: string; description?: string }> {
  const plugin = createPluginInstance(pluginId);
  if (!plugin) return {};

  const schemas = plugin.defineSchemas();
  return schemas.inputs;
}

/**
 * Get plugin output port definitions
 */
export function getPluginOutputs(
  pluginId: string,
): Record<string, { name: string; label: string; description?: string }> {
  const plugin = createPluginInstance(pluginId);
  if (!plugin) return {};

  const schemas = plugin.defineSchemas();
  return schemas.outputs;
}

/**
 * Get plugin metadata
 */
export function getPluginMetadata(
  pluginId: string,
): PluginMetadata | undefined {
  const allPlugins = getAllPluginMetadata();
  return allPlugins.find((p) => p.id === pluginId);
}

/**
 * Check if plugin has multiple outputs (e.g., conditional branches)
 */
export function hasMultipleOutputs(pluginId: string): boolean {
  const outputs = getPluginOutputs(pluginId);
  return Object.keys(outputs).length > 1;
}

/**
 * Check if plugin has no inputs (data source)
 */
export function isDataSource(pluginId: string): boolean {
  const inputs = getPluginInputs(pluginId);
  return Object.keys(inputs).length === 0;
}
