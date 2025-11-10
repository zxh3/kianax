/**
 * Validate Plugin Command
 *
 * Validates plugin structure and schemas.
 */

import { resolve } from "node:path";
import type { Plugin } from "../../types/index.js";

export async function validatePlugin(args: string[]) {
  if (args.length === 0) {
    throw new Error("Plugin file is required. Usage: plugin validate <file>");
  }

  const filename = args[0];

  if (!filename) {
    throw new Error("Plugin file is required. Usage: plugin validate <file>");
  }

  const filepath = resolve(process.cwd(), filename);

  console.log(`Validating plugin: ${filepath}\n`);

  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Import the plugin
    const module = await import(filepath);

    // Find the plugin export
    const plugin = Object.values(module).find(
      (exp: any) =>
        exp?.id && exp?.execute && typeof exp.execute === "function",
    ) as Plugin | undefined;

    if (!plugin) {
      throw new Error(
        "No plugin found in file. Make sure to export a plugin defined with definePlugin().",
      );
    }

    console.log("📦 Validating plugin structure...\n");

    // Validate required fields
    if (!plugin.id) errors.push("Missing required field: id");
    if (!plugin.name) errors.push("Missing required field: name");
    if (!plugin.version) errors.push("Missing required field: version");
    if (!plugin.type) errors.push("Missing required field: type");
    if (!plugin.description)
      warnings.push("Missing recommended field: description");

    // Validate ID format
    if (plugin.id && !/^[a-z0-9-]+$/.test(plugin.id)) {
      errors.push(
        `Invalid ID format: "${plugin.id}". Must be lowercase alphanumeric with hyphens.`,
      );
    }

    // Validate version format
    if (plugin.version && !/^\d+\.\d+\.\d+$/.test(plugin.version)) {
      errors.push(
        `Invalid version format: "${plugin.version}". Must be semver (X.Y.Z).`,
      );
    }

    // Validate type
    const validTypes = ["input", "processor", "logic", "output"];
    if (plugin.type && !validTypes.includes(plugin.type)) {
      errors.push(
        `Invalid type: "${plugin.type}". Must be one of: ${validTypes.join(", ")}`,
      );
    }

    // Validate schemas exist
    if (!plugin.inputSchema) errors.push("Missing required field: inputSchema");
    if (!plugin.outputSchema)
      errors.push("Missing required field: outputSchema");

    // Validate execute function
    if (!plugin.execute) {
      errors.push("Missing required field: execute");
    } else if (typeof plugin.execute !== "function") {
      errors.push("execute must be a function");
    }

    // Recommended fields
    if (!plugin.author) warnings.push("Missing recommended field: author");
    if (!plugin.tags || plugin.tags.length === 0) {
      warnings.push("Missing recommended field: tags");
    }
    if (!plugin.icon) warnings.push("Missing recommended field: icon");

    // Print results
    if (errors.length > 0) {
      console.log("❌ Validation failed:\n");
      errors.forEach((err) => {
        console.log(`  • ${err}`);
      });
      console.log();
    }

    if (warnings.length > 0) {
      console.log("⚠️  Warnings:\n");
      warnings.forEach((warn) => {
        console.log(`  • ${warn}`);
      });
      console.log();
    }

    if (errors.length === 0) {
      console.log("✅ Plugin validation passed!\n");

      console.log("📦 Plugin Summary:");
      console.log(`  ID: ${plugin.id}`);
      console.log(`  Name: ${plugin.name}`);
      console.log(`  Type: ${plugin.type}`);
      console.log(`  Version: ${plugin.version}`);
      if (plugin.description) {
        console.log(`  Description: ${plugin.description}`);
      }
      if (plugin.author) {
        console.log(`  Author: ${plugin.author.name}`);
      }
      if (plugin.tags && plugin.tags.length > 0) {
        console.log(`  Tags: ${plugin.tags.join(", ")}`);
      }
      console.log();

      console.log("✅ All checks passed! Your plugin is ready to use.");
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Validation failed:");
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}
