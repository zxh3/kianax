/**
 * Static Data Plugin (Builder Pattern)
 *
 * Outputs constant/static data values.
 * Use this as a data source to provide hardcoded inputs to downstream nodes.
 *
 * This is the builder-pattern version demonstrating:
 * - Minimal plugin with no inputs
 * - Configuration-based output
 * - Type safety with z.any() (accepts any data type)
 */

import { createPlugin, z } from "@kianax/plugin-sdk";
import { StaticDataConfigUI } from "./config-ui";

export const staticDataPlugin = createPlugin("static-data")
  .withMetadata({
    name: "Static Data",
    description:
      "Outputs constant data values. Use as a data source for testing or providing hardcoded inputs.",
    version: "1.0.0",
    author: {
      name: "Kianax",
      url: "https://kianax.com",
    },
    tags: ["input", "data", "static", "constant", "testing"],
    icon: "📊",
  })
  // No inputs needed - this is a pure data source
  .withOutput("data", {
    label: "Data",
    description: "The static data output",
    schema: z.any(),
  })
  .withConfig(
    z.object({
      data: z.any().describe("The static data to output"),
    }),
  )
  .withConfigUI(StaticDataConfigUI)
  .execute(async ({ config }) => {
    // Simply return the configured static data
    // config.data is typed, though as z.any() it accepts anything
    return {
      data: config.data,
    };
  })
  .build();
