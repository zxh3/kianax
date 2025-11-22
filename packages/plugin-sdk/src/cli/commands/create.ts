/**
 * Create Plugin Command
 *
 * Generates a new plugin from template.
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

const TEMPLATES = {
  input: `import { createPlugin, z } from "@kianax/plugin-sdk";

export const {{name}} = createPlugin("{{id}}")
  .withMetadata({
    name: "{{displayName}}",
    description: "TODO: Add description",
    version: "1.0.0",
    tags: ["input"],
    icon: "📥",
  })
  .withOutput("data", {
    label: "Output Data",
    schema: z.unknown(),
  })
  .withConfig(z.object({
    // TODO: Define config schema (optional)
  }))
  .execute(async ({ inputs, config, context }) => {
    // TODO: Implement plugin logic
    console.log("Config:", config);
    console.log("Context:", context);

    return {
      data: "TODO: Return output matching outputSchema",
    };
  })
  .build();
`,

  processor: `import { createPlugin, z } from "@kianax/plugin-sdk";

export const {{name}} = createPlugin("{{id}}")
  .withMetadata({
    name: "{{displayName}}",
    description: "TODO: Add description",
    version: "1.0.0",
    tags: ["transform"],
    icon: "⚙️",
  })
  .withInput("data", {
    label: "Input Data",
    schema: z.unknown(),
  })
  .withOutput("data", {
    label: "Output Data",
    schema: z.unknown(),
  })
  .withConfig(z.object({
    // TODO: Define config schema (optional)
  }))
  .execute(async ({ inputs, config, context }) => {
    // TODO: Transform/process input data
    console.log("Processing:", inputs.data);

    return {
      data: inputs.data, // TODO: Return transformed data
    };
  })
  .build();
`,

  logic: `import { createPlugin, z } from "@kianax/plugin-sdk";

export const {{name}} = createPlugin("{{id}}")
  .withMetadata({
    name: "{{displayName}}",
    description: "TODO: Add description",
    version: "1.0.0",
    tags: ["logic", "condition"],
    icon: "🔀",
  })
  .withInput("data", {
    label: "Input Data",
    schema: z.unknown(),
  })
  .withOutput("result", {
    label: "Result",
    schema: z.boolean(),
  })
  .withOutput("branch", {
    label: "Branch",
    schema: z.enum(["true", "false"]),
  })
  .withConfig(z.object({
    condition: z.string(),
  }))
  .execute(async ({ inputs, config, context }) => {
    // TODO: Evaluate condition and return boolean
    const result = true; // TODO: Replace with actual logic

    return {
      result,
      branch: result ? "true" : "false",
    };
  })
  .build();
`,

  output: `import { createPlugin, z } from "@kianax/plugin-sdk";

export const {{name}} = createPlugin("{{id}}")
  .withMetadata({
    name: "{{displayName}}",
    description: "TODO: Add description",
    version: "1.0.0",
    tags: ["output"],
    icon: "📤",
  })
  .withInput("data", {
    label: "Data",
    schema: z.unknown(),
  })
  .withOutput("success", {
    label: "Success",
    schema: z.boolean(),
  })
  .withOutput("message", {
    label: "Message",
    schema: z.string().optional(),
  })
  .withConfig(z.object({
    // TODO: Define config schema (optional)
  }))
  .execute(async ({ inputs, config, context }) => {
    // TODO: Send data to external service
    console.log("Sending:", inputs.data);

    return {
      success: true,
      message: "TODO: Return success status",
    };
  })
  .build();
`,
};

export async function createPlugin(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      template: {
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

  const templateName = values.template as keyof typeof TEMPLATES;

  if (!TEMPLATES[templateName]) {
    throw new Error(
      `Invalid plugin template: ${templateName}. Must be one of: input, processor, logic, output`,
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
  const code = TEMPLATES[templateName]
    .replace(/\{\{name\}\}/g, camelCase)
    .replace(/\{\{id\}\}/g, id)
    .replace(/\{\{displayName\}\}/g, displayName);

  // Write plugin file
  const filename = `${id}.ts`;
  const filepath = join(process.cwd(), filename);

  await writeFile(filepath, code, "utf-8");

  console.log(`✅ Created ${templateName} plugin: ${filename}`);
  console.log(`\nNext steps:`);
  console.log(`1. Edit ${filename} to implement your plugin logic`);
  console.log(`2. Test your plugin: plugin test ${filename}`);
  console.log(`3. Validate your plugin: plugin validate ${filename}`);
}
