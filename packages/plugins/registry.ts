/**
 * Plugin Registry
 *
 * Central registry for all available plugins in the platform.
 * Flat structure - all plugins in root level folders.
 */

import {
  Plugin,
  type PluginMetadata,
  type PluginTag,
} from "@kianax/plugin-sdk";

// Type for plugin class constructor OR plugin instance
type PluginClass = new () => Plugin;
type PluginEntry = PluginClass | Plugin;

// Import all builder-based plugins
import { mockWeatherPlugin } from "./mock-weather";
import { staticDataPlugin } from "./static-data";
import { ifElsePlugin } from "./if-else";
import { stockPricePlugin } from "./stock-price";
import { httpRequestPlugin } from "./http";
import { emailPlugin } from "./email";
import { aiTransformPlugin } from "./ai-transformer";
import { loopControlPlugin } from "./loop-control";

const PLUGINS = [
  mockWeatherPlugin,
  staticDataPlugin,
  ifElsePlugin,
  stockPricePlugin,
  httpRequestPlugin,
  emailPlugin,
  aiTransformPlugin,
  loopControlPlugin,
];

/**
 * Plugin registry - maps plugin IDs to plugin classes or instances
 * Supports both class-based plugins and builder-created plugins
 */
export const pluginRegistry = new Map<string, PluginEntry>(
  PLUGINS.map((plugin) => [plugin.getId(), plugin]),
);

/**
 * Get a plugin by ID
 * Returns the plugin class or instance
 */
export function getPlugin(pluginId: string): PluginEntry | undefined {
  return pluginRegistry.get(pluginId);
}

/**
 * Get plugin metadata
 */
export function getPluginMetadata(
  pluginId: string,
): PluginMetadata | undefined {
  const plugin = getPlugin(pluginId);
  if (!plugin) return undefined;

  // Handle both class-based plugins and builder-created instances
  if (typeof plugin === "function") {
    // It's a class - access static metadata
    return (plugin as any).metadata;
  } else {
    // It's an instance - call getMetadata()
    return plugin.getMetadata();
  }
}

/**
 * Get all plugins
 */
export function getAllPlugins(): PluginEntry[] {
  return Array.from(pluginRegistry.values());
}

/**
 * Get all plugin metadata
 */
export function getAllPluginMetadata(): PluginMetadata[] {
  return getAllPlugins()
    .map((plugin) => {
      // Handle both class-based plugins and builder-created instances
      if (typeof plugin === "function") {
        // It's a class - access static metadata
        return (plugin as any).metadata;
      } else {
        // It's an instance - call getMetadata()
        return plugin.getMetadata();
      }
    })
    .filter((metadata): metadata is PluginMetadata => metadata !== undefined);
}

/**
 * Get plugins by tag
 */
export function getPluginsByTag(tag: PluginTag): PluginMetadata[] {
  return getAllPluginMetadata().filter((plugin) => plugin.tags?.includes(tag));
}

/**
 * Search plugins by name or description
 */
export function searchPlugins(query: string): PluginMetadata[] {
  const lowerQuery = query.toLowerCase();

  return getAllPluginMetadata().filter(
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
 * Create an instance of a plugin
 * Handles both class-based plugins and builder-created instances
 */
export function createPluginInstance(pluginId: string): Plugin | undefined {
  const entry = getPlugin(pluginId);
  if (!entry) return undefined;

  // Check if it's a class (has constructor) or an instance
  if (typeof entry === "function") {
    // It's a class, instantiate it
    return new entry();
  } else {
    // It's already an instance (from builder), return it
    return entry;
  }
}
