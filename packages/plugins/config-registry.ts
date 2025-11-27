/**
 * Plugin Configuration UI Registry
 *
 * Gets configuration UI components from plugin classes.
 * This allows the web app to dynamically load and render plugin config UIs.
 */

import type { ComponentType } from "react";
import { createPluginInstance } from "./registry";

/**
 * Expression context for autocomplete suggestions in plugin config UIs.
 * Provided by the routine editor when the node is being configured.
 */
export interface ExpressionContext {
  /** Available routine variables */
  variables?: Array<{
    name: string;
    type: "string" | "number" | "boolean" | "json";
    value?: unknown;
    description?: string;
  }>;

  /** Upstream nodes with their output ports */
  upstreamNodes?: Array<{
    id: string;
    label: string;
    pluginId: string;
    outputs: string[];
  }>;

  /** Whether trigger context is available */
  hasTrigger?: boolean;
}

/**
 * Generic plugin config component props
 */
export interface PluginConfigProps<T = any> {
  value?: T;
  onChange: (value: T) => void;
  /** Expression context for autocomplete (optional, provided by routine editor) */
  expressionContext?: ExpressionContext;
}

/**
 * Get config component for a plugin
 *
 * This function gets the config UI component from the plugin class's getConfigUI() method.
 * Plugin authors define their config UI in the plugin class, so no manual registry needed.
 *
 * @param pluginId - The unique plugin identifier
 * @returns The config component, or null if none exists
 */
export function getPluginConfigComponent(
  pluginId: string,
): ComponentType<PluginConfigProps<any>> | null {
  const plugin = createPluginInstance(pluginId);
  if (!plugin) return null;

  return plugin.getConfigUI();
}

/**
 * Check if a plugin has a config UI
 */
export function hasPluginConfigUI(pluginId: string): boolean {
  const plugin = createPluginInstance(pluginId);
  if (!plugin) return false;

  return plugin.getConfigUI() !== null;
}
