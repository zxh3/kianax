/**
 * Create Plugin Command
 *
 * Generates a new plugin from template.
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

const TEMPLATES = {
  input: `import { definePlugin, z } from "@kianax/plugin-sdk";

export const {{name}} = definePlugin({
  id: "{{id}}",
  name: "{{displayName}}",
  description: "TODO: Add description",
  version: "1.0.0",
  type: "input",

  inputSchema: z.object({
    // TODO: Define input schema
  }),

  outputSchema: z.object({
    // TODO: Define output schema
    data: z.unknown(),
  }),

  configSchema: z.object({
    // TODO: Define config schema (optional)
  }),

  credentials: [
    // TODO: Define required credentials (optional)
    // {
    //   key: "apiKey",
    //   label: "API Key",
    //   type: "password",
    //   required: true,
    // }
  ],

  tags: ["TODO"],
  icon: "📥",

  async execute(input, config, context) {
    // TODO: Implement plugin logic
    console.log("Input:", input);
    console.log("Config:", config);
    console.log("Context:", context);

    return {
      data: "TODO: Return output matching outputSchema",
    };
  },
});
`,

  processor: `import { definePlugin, z } from "@kianax/plugin-sdk";

export const {{name}} = definePlugin({
  id: "{{id}}",
  name: "{{displayName}}",
  description: "TODO: Add description",
  version: "1.0.0",
  type: "processor",

  inputSchema: z.object({
    data: z.unknown(),
  }),

  outputSchema: z.object({
    data: z.unknown(),
  }),

  configSchema: z.object({
    // TODO: Define config schema (optional)
  }),

  tags: ["TODO"],
  icon: "⚙️",

  async execute(input, config, context) {
    // TODO: Transform/process input data
    console.log("Processing:", input.data);

    return {
      data: input.data, // TODO: Return transformed data
    };
  },
});
`,

  logic: `import { definePlugin, z } from "@kianax/plugin-sdk";

export const {{name}} = definePlugin({
  id: "{{id}}",
  name: "{{displayName}}",
  description: "TODO: Add description",
  version: "1.0.0",
  type: "logic",

  inputSchema: z.object({
    data: z.unknown(),
  }),

  outputSchema: z.object({
    result: z.boolean(),
    branch: z.enum(["true", "false"]),
  }),

  configSchema: z.object({
    condition: z.string(),
  }),

  tags: ["TODO"],
  icon: "🔀",

  async execute(input, config, context) {
    // TODO: Evaluate condition and return boolean
    const result = true; // TODO: Replace with actual logic

    return {
      result,
      branch: result ? "true" : "false",
    };
  },
});
`,

  output: `import { definePlugin, z } from "@kianax/plugin-sdk";

export const {{name}} = definePlugin({
  id: "{{id}}",
  name: "{{displayName}}",
  description: "TODO: Add description",
  version: "1.0.0",
  type: "output",

  inputSchema: z.object({
    data: z.unknown(),
  }),

  outputSchema: z.object({
    success: z.boolean(),
    message: z.string().optional(),
  }),

  configSchema: z.object({
    // TODO: Define config schema (optional)
  }),

  credentials: [
    // TODO: Define required credentials (optional)
    // {
    //   key: "apiKey",
    //   label: "API Key",
    //   type: "password",
    //   required: true,
    // }
  ],

  tags: ["TODO"],
  icon: "📤",

  async execute(input, config, context) {
    // TODO: Send data to external service
    console.log("Sending:", input.data);

    return {
      success: true,
      message: "TODO: Return success status",
    };
  },
});
`,
};

export async function createPlugin(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      type: {
        type: "string",
        short: "t",
        default: "input",
      },
    },
    allowPositionals: true,
  });

  if (positionals.length === 0) {
    throw new Error("Plugin name is required. Usage: plugin create <name>");
  }

  const pluginName = positionals[0];

  if (!pluginName) {
    throw new Error("Plugin name is required. Usage: plugin create <name>");
  }

  const pluginType = values.type as keyof typeof TEMPLATES;

  if (!TEMPLATES[pluginType]) {
    throw new Error(
      `Invalid plugin type: ${pluginType}. Must be one of: input, processor, logic, output`,
    );
  }

  // Convert plugin name to different formats
  const id = pluginName.toLowerCase().replace(/\s+/g, "-");
  const camelCase = pluginName
    .replace(/-./g, (x) => (x[1] ? x[1].toUpperCase() : ""))
    .replace(/^./, (x) => x.toLowerCase());
  const displayName = pluginName
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  // Generate plugin code from template
  const code = TEMPLATES[pluginType]
    .replace(/\{\{name\}\}/g, camelCase)
    .replace(/\{\{id\}\}/g, id)
    .replace(/\{\{displayName\}\}/g, displayName);

  // Write plugin file
  const filename = `${id}.ts`;
  const filepath = join(process.cwd(), filename);

  await writeFile(filepath, code, "utf-8");

  console.log(`✅ Created ${pluginType} plugin: ${filename}`);
  console.log(`\nNext steps:`);
  console.log(`1. Edit ${filename} to implement your plugin logic`);
  console.log(`2. Test your plugin: plugin test ${filename}`);
  console.log(`3. Validate your plugin: plugin validate ${filename}`);
}
