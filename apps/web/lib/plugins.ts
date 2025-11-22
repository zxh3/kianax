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
 * Categorize plugin by its primary tag
 */
export function categorizePlugin(
  metadata: PluginMetadata,
): "input" | "processor" | "logic" | "action" {
  const tags = metadata.tags || [];

  if (tags.includes("input") || tags.includes("data")) {
    return "input";
  }
  if (tags.includes("logic") || tags.includes("condition")) {
    return "logic";
  }
  if (tags.includes("action") || tags.includes("output")) {
    return "action";
  }
  if (tags.includes("processor") || tags.includes("transform")) {
    return "processor";
  }

  // Default based on I/O characteristics
  const plugin = createPluginInstance(metadata.id);
  if (!plugin) return "processor";

  const schemas = plugin.defineSchemas();
  const hasInputs = Object.keys(schemas.inputs).length > 0;
  const hasOutputs = Object.keys(schemas.outputs).length > 0;

  if (!hasInputs && hasOutputs) return "input";
  if (hasInputs && !hasOutputs) return "action";

  return "processor";
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
