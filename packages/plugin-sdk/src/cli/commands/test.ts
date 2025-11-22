/**
 * Test Plugin Command
 *
 * Runs a plugin with test data.
 */

import { resolve } from "node:path";
import { PluginTester } from "../../testing/PluginTester";

export async function testPlugin(args: string[]) {
  if (args.length === 0) {
    throw new Error("Plugin file is required. Usage: plugin test <file>");
  }

  const filename = args[0];

  if (!filename) {
    throw new Error("Plugin file is required. Usage: plugin test <file>");
  }

  const filepath = resolve(process.cwd(), filename);

  console.log(`Testing plugin: ${filepath}\n`);

  try {
    // Import the plugin
    const module = await import(filepath);

    // Find the plugin export (first export that looks like a plugin)
    const plugin = Object.values(module).find(
      (exp: any) =>
        exp?.id && exp?.execute && typeof exp.execute === "function",
    );

    if (!plugin) {
      throw new Error(
        "No plugin found in file. Make sure to export a plugin defined with createPlugin().",
      );
    }

    // Display plugin metadata
    console.log("📦 Plugin Metadata:");
    console.log(`  ID: ${(plugin as any).id}`);
    console.log(`  Name: ${(plugin as any).name}`);
    console.log(`  Type: ${(plugin as any).type}`);
    console.log(`  Version: ${(plugin as any).version}`);
    console.log();

    // Create tester
    const tester = new PluginTester(plugin as any);

    // Get sample input from user or use defaults
    console.log("🧪 Running test execution...");
    console.log(
      "ℹ️  Using mock data. For custom data, provide test-data.json\n",
    );

    // Default test data based on plugin type
    const testData = getDefaultTestData((plugin as any).type);

    // Execute plugin
    const result = await tester.execute(testData);

    console.log("✅ Test execution successful!\n");
    console.log("📤 Output:");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ Test failed:");
    if (error instanceof Error) {
      console.error(error.message);
      if (error.stack) {
        console.error("\nStack trace:");
        console.error(error.stack);
      }
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

function getDefaultTestData(pluginType: string) {
  switch (pluginType) {
    case "input":
      return {
        input: {},
        config: {},
      };

    case "processor":
      return {
        input: { data: { test: "value" } },
        config: {},
      };

    case "logic":
      return {
        input: { data: true },
        config: { condition: "test condition" },
      };

    case "output":
      return {
        input: { data: { test: "value" } },
        config: {},
      };

    default:
      return {
        input: {},
        config: {},
      };
  }
}
