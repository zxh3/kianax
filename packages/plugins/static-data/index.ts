/**
 * Static Data Plugin
 *
 * Outputs predefined data configured at design-time.
 * Use this to inject constants, test data, or hardcoded values into your workflow.
 *
 * Design principles:
 * - Data configured once at design-time (workflow structure)
 * - No runtime inputs (pure data source)
 * - Useful for testing, defaults, and constant values
 */

import { createPlugin, z } from "@kianax/plugin-sdk";
import { StaticDataConfigUI } from "./config-ui";

export const staticDataPlugin = createPlugin("static-data")
  .withMetadata({
    name: "Static Data",
    description:
      "Outputs static data configured at design-time. Useful for constants, test data, and default values.",
    version: "2.0.0",
    author: {
      name: "Kianax",
      url: "https://kianax.com",
    },
    tags: ["data-source"],
    icon: "📌",
  })
  .withInput("data", {
    label: "Data",
    description: "The static data input",
    schema: z.unknown(),
  })
  .withOutput("data", {
    label: "Data",
    description: "The static data output",
    schema: z.unknown(),
  })
  .withConfig(
    z.object({
      data: z
        .unknown()
        .describe("Static data to output (any JSON-serializable value)"),
    }),
  )
  .withConfigUI(StaticDataConfigUI)
  .execute(async ({ config }) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      data: config.data,
    };
  })
  .build();
