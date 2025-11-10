/**
 * Plugin Registry
 *
 * Central registry for all available plugins in the platform.
 */

import type { Plugin, PluginMetadata } from "@kianax/plugin-sdk";

// Import all plugins
import { aiTransform } from "./transformers/ai";
import { stockPrice } from "./data-sources/stock-price";
import { mockWeather } from "./data-sources/mock-weather";
import { staticData } from "./data-sources/static-data";
import { httpRequest } from "./actions/http";
import { email } from "./actions/email";
import { ifElse } from "./conditions/if-else";

/**
 * Plugin registry - all available plugins
 */
export const pluginRegistry = new Map<string, Plugin<any, any, any>>([
  // Transformers / Processors
  [aiTransform.id, aiTransform],

  // Data Sources / Inputs
  [stockPrice.id, stockPrice],
  [mockWeather.id, mockWeather],
  [staticData.id, staticData],

  // Actions / Outputs
  [httpRequest.id, httpRequest],
  [email.id, email],

  // Conditions / Logic
  [ifElse.id, ifElse],
]);

/**
 * Get a plugin by ID
 */
export function getPlugin(pluginId: string): Plugin<any, any, any> | undefined {
  return pluginRegistry.get(pluginId);
}

/**
 * Get all plugins
 */
export function getAllPlugins(): Plugin<any, any, any>[] {
  return Array.from(pluginRegistry.values());
}

/**
 * Get plugins by type
 */
export function getPluginsByType(
  type: "input" | "processor" | "logic" | "output",
): Plugin<any, any, any>[] {
  return getAllPlugins().filter((plugin) => plugin.type === type);
}

/**
 * Get plugins by tag
 */
export function getPluginsByTag(tag: string): Plugin<any, any, any>[] {
  return getAllPlugins().filter((plugin) => plugin.tags?.includes(tag));
}

/**
 * Search plugins by name or description
 */
export function searchPlugins(query: string): Plugin<any, any, any>[] {
  const lowerQuery = query.toLowerCase();

  return getAllPlugins().filter(
    (plugin) =>
      plugin.name.toLowerCase().includes(lowerQuery) ||
      plugin.description.toLowerCase().includes(lowerQuery) ||
      plugin.id.toLowerCase().includes(lowerQuery),
  );
}

/**
 * Validate that a plugin ID exists
 */
export function isValidPluginId(pluginId: string): boolean {
  return pluginRegistry.has(pluginId);
}

/**
 * Get plugin metadata (without execute function)
 */
export function getPluginMetadata(pluginId: string): PluginMetadata | undefined {
  const plugin = getPlugin(pluginId);

  if (!plugin) {
    return undefined;
  }

  return {
    id: plugin.id,
    name: plugin.name,
    description: plugin.description,
    version: plugin.version,
    type: plugin.type,
    author: plugin.author,
    tags: plugin.tags,
    icon: plugin.icon,
    credentials: plugin.credentials,
    // Note: schemas are Zod objects, would need zodToJsonSchema to export
  };
}

/**
 * Get all plugin metadata
 */
export function getAllPluginMetadata(): PluginMetadata[] {
  return getAllPlugins()
    .map((plugin) => getPluginMetadata(plugin.id))
    .filter((metadata): metadata is PluginMetadata => metadata !== undefined);
}
