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

// Import all builder-based plugins
import { staticDataPlugin } from "./static-data";
import { ifElsePlugin } from "./if-else";
import { httpRequestPlugin } from "./http";
import { openaiMessagePlugin } from "./openai";
import { googleSheetsPlugin } from "./google-sheets";

const PLUGINS: Plugin<any, any>[] = [
  staticDataPlugin,
  ifElsePlugin,
  httpRequestPlugin,
  openaiMessagePlugin,
  googleSheetsPlugin,
];

/**
 * Plugin registry - maps plugin IDs to plugin classes or instances
 * Supports both class-based plugins and builder-created plugins
 */
export const pluginRegistry = new Map<string, Plugin<any, any>>(
  PLUGINS.map((plugin) => [plugin.getId(), plugin]),
);

/**
 * Get a plugin by ID
 * Returns the plugin class or instance
 */
export function getPlugin(pluginId: string): Plugin<any, any> | undefined {
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
export function getAllPlugins(): Plugin<any, any>[] {
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
export function createPluginInstance(
  pluginId: string,
): Plugin<any, any> | undefined {
  return getPlugin(pluginId);
}

/**
 * Get output port names for a plugin
 */
export function getPluginOutputs(pluginId: string): string[] {
  const plugin = getPlugin(pluginId);
  if (!plugin) return ["data"]; // Default fallback

  try {
    const schemas = plugin.defineSchemas();
    return Object.keys(schemas.outputs);
  } catch {
    return ["data"]; // Default fallback if defineSchemas fails
  }
}

/**
 * Output schema field for expression autocomplete
 */
export interface OutputSchemaField {
  name: string;
  type: "str" | "num" | "bool" | "obj" | "arr" | "null" | "unknown";
  description?: string;
  children?: OutputSchemaField[];
}

/**
 * Get output schema fields for a plugin's output port.
 * Used for expression autocomplete to show available fields.
 *
 * @param pluginId - Plugin identifier
 * @param outputPortName - Output port name (optional, defaults to "output" for flow-based plugins)
 * @returns Array of schema fields for autocomplete
 */
export function getPluginOutputSchemaFields(
  pluginId: string,
  outputPortName?: string,
): OutputSchemaField[] {
  const plugin = getPlugin(pluginId);
  if (!plugin) return [];

  try {
    const schemas = plugin.defineSchemas();

    // If no output port specified, try "output" (flow-based) then first available
    let targetPort = outputPortName;
    if (!targetPort) {
      const portNames = Object.keys(schemas.outputs);
      targetPort = portNames.includes("output") ? "output" : portNames[0];
    }

    if (!targetPort) return [];

    const portDef = schemas.outputs[targetPort];
    if (!portDef?.schema) return [];

    // Extract fields from the Zod schema
    return extractSchemaFields(portDef.schema);
  } catch {
    return [];
  }
}

/**
 * Extract field information from a Zod schema for autocomplete.
 * Recursively traverses object schemas to build the completion tree.
 */
function extractSchemaFields(schema: any): OutputSchemaField[] {
  if (!schema || !schema._def) return [];

  const def = schema._def;
  const typeName = def.typeName;

  // Handle ZodObject - extract shape keys
  if (typeName === "ZodObject" && def.shape) {
    const shape = typeof def.shape === "function" ? def.shape() : def.shape;
    return Object.entries(shape).map(([key, value]) => {
      const fieldSchema = value as any;
      const fieldType = getZodTypeSimple(fieldSchema);
      const description = fieldSchema._def?.description;

      // Recursively get children for nested objects
      let children: OutputSchemaField[] | undefined;
      if (fieldType === "obj") {
        children = extractSchemaFields(fieldSchema);
        if (children.length === 0) children = undefined;
      } else if (fieldType === "arr") {
        // For arrays, try to get the element type
        const elementType = fieldSchema._def?.type;
        if (elementType && getZodTypeSimple(elementType) === "obj") {
          children = extractSchemaFields(elementType);
          if (children.length === 0) children = undefined;
        }
      }

      return {
        name: key,
        type: fieldType,
        description,
        children,
      };
    });
  }

  // Handle ZodRecord - generic key-value
  if (typeName === "ZodRecord") {
    return [
      {
        name: "[key]",
        type: getZodTypeSimple(def.valueType),
        description: "Dynamic key",
      },
    ];
  }

  return [];
}

/**
 * Get a simple type string from a Zod schema
 */
function getZodTypeSimple(
  schema: any,
): "str" | "num" | "bool" | "obj" | "arr" | "null" | "unknown" {
  if (!schema || !schema._def) return "unknown";

  const typeName = schema._def.typeName;

  switch (typeName) {
    case "ZodString":
      return "str";
    case "ZodNumber":
      return "num";
    case "ZodBoolean":
      return "bool";
    case "ZodObject":
    case "ZodRecord":
      return "obj";
    case "ZodArray":
      return "arr";
    case "ZodNull":
      return "null";
    case "ZodOptional":
    case "ZodNullable":
      return getZodTypeSimple(schema._def.innerType);
    case "ZodUnknown":
    case "ZodAny":
      return "unknown";
    default:
      return "unknown";
  }
}
