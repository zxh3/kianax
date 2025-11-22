/**
 * Validate Plugin Command
 *
 * Validates plugin structure and schemas.
 */

import { resolve } from "node:path";
import type { Plugin } from "../../index";

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
        exp &&
        typeof exp.getId === "function" &&
        typeof exp.execute === "function",
    ) as Plugin | undefined;

    if (!plugin) {
      throw new Error(
        "No plugin found in file. Make sure to export a plugin defined with createPlugin().",
      );
    }

    console.log("📦 Validating plugin structure...\n");

    const metadata = plugin.getMetadata();
    const schemas = plugin.defineSchemas();

    // Validate required fields
    if (!metadata.id) errors.push("Missing required field: id");
    if (!metadata.name) errors.push("Missing required field: name");
    if (!metadata.version) errors.push("Missing required field: version");
    if (!metadata.description)
      warnings.push("Missing recommended field: description");

    // Validate ID format
    if (metadata.id && !/^[a-z0-9-]+$/.test(metadata.id)) {
      errors.push(
        `Invalid ID format: "${metadata.id}". Must be lowercase alphanumeric with hyphens.`,
      );
    }

    // Validate version format
    if (metadata.version && !/^\d+\.\d+\.\d+$/.test(metadata.version)) {
      errors.push(
        `Invalid version format: "${metadata.version}". Must be semver (X.Y.Z).`,
      );
    }

    // Validate schemas exist
    if (!schemas.inputs) errors.push("Missing required field: inputs (schema)");
    if (!schemas.outputs)
      errors.push("Missing required field: outputs (schema)");

    // Recommended fields
    if (!metadata.author) warnings.push("Missing recommended field: author");
    if (!metadata.tags || metadata.tags.length === 0) {
      warnings.push("Missing recommended field: tags");
    }
    if (!metadata.icon) warnings.push("Missing recommended field: icon");

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
      console.log(`  ID: ${metadata.id}`);
      console.log(`  Name: ${metadata.name}`);
      console.log(`  Version: ${metadata.version}`);
      if (metadata.description) {
        console.log(`  Description: ${metadata.description}`);
      }
      if (metadata.author) {
        console.log(`  Author: ${metadata.author.name}`);
      }
      if (metadata.tags && metadata.tags.length > 0) {
        console.log(`  Tags: ${metadata.tags.join(", ")}`);
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
