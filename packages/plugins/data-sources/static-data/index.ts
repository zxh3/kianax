/**
 * Static Data Plugin
 *
 * Outputs constant/static data values.
 * Use this as a data source to provide hardcoded inputs to downstream nodes.
 */

import { definePlugin, z } from "@kianax/plugin-sdk";

export const staticData = definePlugin({
  id: "static-data",
  name: "Static Data",
  description:
    "Outputs constant data values. Use as a data source for testing or providing hardcoded inputs.",
  version: "1.0.0",
  type: "input",

  author: {
    name: "Kianax",
    url: "https://kianax.com",
  },

  // Static data plugin doesn't need inputs - it just outputs what's configured
  inputSchema: z.object({}),

  // Output is dynamic - whatever the user configures
  outputSchema: z.any(),

  configSchema: z.object({
    data: z.any().describe("The static data to output"),
  }),

  credentials: [],

  tags: ["data", "static", "constant", "testing", "input"],
  icon: "📊",

  async execute(_input, config, _context) {
    // Simply return the configured static data
    return config.data;
  },
});
