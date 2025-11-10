/**
 * Plugin Definition Helper
 *
 * Type-safe helper for defining plugins with full TypeScript inference using Zod.
 */

import type { z } from "zod";
import type { Plugin } from "./index.js";

/**
 * Define a plugin with full type safety
 *
 * @example
 * ```typescript
 * import { definePlugin, z } from '@kianax/plugin-sdk';
 *
 * export const myPlugin = definePlugin({
 *   id: 'my-plugin',
 *   name: 'My Plugin',
 *   type: 'input',
 *   version: '1.0.0',
 *   inputSchema: z.object({
 *     query: z.string()
 *   }),
 *   outputSchema: z.object({
 *     results: z.array(z.string())
 *   }),
 *   execute: async (input, config, context) => {
 *     // input is typed as { query: string }
 *     // return type must be { results: string[] }
 *     return { results: [] };
 *   }
 * });
 * ```
 */
export function definePlugin<
  TInputSchema extends z.ZodType,
  TOutputSchema extends z.ZodType,
  TConfigSchema extends z.ZodType = z.ZodUnknown,
>(
  plugin: Plugin<TInputSchema, TOutputSchema, TConfigSchema>,
): Plugin<TInputSchema, TOutputSchema, TConfigSchema> {
  // Validate required fields
  if (!plugin.id) throw new Error("Plugin must have an 'id'");
  if (!plugin.name) throw new Error("Plugin must have a 'name'");
  if (!plugin.version) throw new Error("Plugin must have a 'version'");
  if (!plugin.type) throw new Error("Plugin must have a 'type'");
  if (!plugin.inputSchema) throw new Error("Plugin must have an 'inputSchema'");
  if (!plugin.outputSchema)
    throw new Error("Plugin must have an 'outputSchema'");
  if (typeof plugin.execute !== "function")
    throw new Error("Plugin must have an 'execute' function");

  // Validate version format (simple semver check)
  if (!/^\d+\.\d+\.\d+$/.test(plugin.version)) {
    throw new Error(
      `Plugin version must be in semver format (X.Y.Z), got: ${plugin.version}`,
    );
  }

  // Validate plugin ID format (lowercase, alphanumeric, hyphens)
  if (!/^[a-z0-9-]+$/.test(plugin.id)) {
    throw new Error(
      `Plugin ID must be lowercase alphanumeric with hyphens, got: ${plugin.id}`,
    );
  }

  return plugin;
}
