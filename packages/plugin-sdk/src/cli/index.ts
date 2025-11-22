#!/usr/bin/env node

/**
 * Kianax Plugin CLI
 *
 * Commands:
 * - plugin create <name> - Create a new plugin from template
 * - plugin test <file> - Test a plugin locally
 * - plugin validate <file> - Validate plugin structure
 */

import { createPlugin } from "./commands/create";
import { testPlugin } from "./commands/test";
import { validatePlugin } from "./commands/validate";

const USAGE = `
Kianax Plugin CLI

Usage:
  plugin create <name> [--template <template>]   Create a new plugin from template
  plugin test <file>                             Test a plugin locally
  plugin validate <file>                         Validate plugin structure
  plugin help                                    Show this help message

Options:
  --template <template>    Plugin template (input, processor, logic, output)

Examples:
  plugin create my-plugin --template input
  plugin test ./src/plugins/my-plugin.ts
  plugin validate ./src/plugins/my-plugin.ts
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "help" || args[0] === "--help") {
    console.log(USAGE);
    process.exit(0);
  }

  const command = args[0];
  const commandArgs = args.slice(1);

  try {
    switch (command) {
      case "create":
        await createPlugin(commandArgs);
        break;

      case "test":
        await testPlugin(commandArgs);
        break;

      case "validate":
        await validatePlugin(commandArgs);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log(USAGE);
        process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
