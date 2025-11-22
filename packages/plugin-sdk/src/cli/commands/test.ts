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

    // Find the plugin export (instance of Plugin or something with getId/execute)
    const plugin = Object.values(module).find(
      (exp: any) =>
        exp &&
        typeof exp.getId === "function" &&
        typeof exp.execute === "function",
    );

    if (!plugin) {
      throw new Error(
        "No plugin found in file. Make sure to export a plugin defined with createPlugin().",
      );
    }

    // Display plugin metadata
    console.log("📦 Plugin Metadata:");
    console.log(`  ID: ${(plugin as any).getId()}`);
    console.log(`  Name: ${(plugin as any).getName()}`);
    console.log(`  Tags: ${(plugin as any).getTags()?.join(", ")}`);
    // Version isn't directly exposed as method on Plugin base unless added, but getMetadata() has it
    const metadata = (plugin as any).getMetadata();
    console.log(`  Version: ${metadata.version}`);
    console.log();

    // Create tester
    const tester = new PluginTester(plugin as any);

    // Get sample input from user or use defaults
    console.log("🧪 Running test execution...");
    console.log(
      "ℹ️  Using mock data. For custom data, provide test-data.json\n",
    );

    // Default test data based on plugin tags
    const tags = (plugin as any).getTags() || [];
    const testData = getDefaultTestData(tags);

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

function getDefaultTestData(tags: string[]) {
  if (tags.includes("input")) {
    return {
      inputs: {
        // Default request for input plugins (e.g. weather, stock) usually needs something
        // Trying to be generic is hard here without schema inspection
        request: {},
      },
      config: {},
    };
  }

  if (tags.includes("transform") || tags.includes("processor")) {
    return {
      inputs: { data: { test: "value" } },
      config: {},
    };
  }

  if (tags.includes("logic") || tags.includes("condition")) {
    return {
      inputs: { data: true },
      config: { condition: "test condition" },
    };
  }

  if (tags.includes("output")) {
    return {
      inputs: { data: { test: "value" } },
      config: {},
    };
  }

  return {
    inputs: {},
    config: {},
  };
}
