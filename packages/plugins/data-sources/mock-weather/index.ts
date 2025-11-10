/**
 * Mock Weather Plugin
 *
 * Returns mock weather data for testing without external API calls.
 * This plugin is useful for local development and testing workflows.
 */

import { definePlugin, z } from "@kianax/plugin-sdk";

export const mockWeather = definePlugin({
  id: "mock-weather",
  name: "Mock Weather",
  description:
    "Returns mock weather data for testing. No external API calls required.",
  version: "1.0.0",
  type: "input",

  author: {
    name: "Kianax",
    url: "https://kianax.com",
  },

  inputSchema: z.object({
    city: z.string().describe("City name (e.g., San Francisco, New York)"),
    units: z
      .enum(["celsius", "fahrenheit"])
      .optional()
      .default("fahrenheit")
      .describe("Temperature units"),
  }),

  outputSchema: z.object({
    city: z.string().describe("City name"),
    temperature: z.number().describe("Current temperature"),
    units: z.string().describe("Temperature units"),
    condition: z.string().describe("Weather condition"),
    humidity: z.number().describe("Humidity percentage"),
    windSpeed: z.number().describe("Wind speed in mph"),
    timestamp: z.string().describe("ISO 8601 timestamp"),
    forecast: z
      .array(
        z.object({
          day: z.string().describe("Day of week"),
          high: z.number().describe("High temperature"),
          low: z.number().describe("Low temperature"),
          condition: z.string().describe("Weather condition"),
        }),
      )
      .optional()
      .describe("5-day forecast"),
  }),

  configSchema: z.object({
    includeForecast: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include 5-day forecast in output"),
  }),

  // No credentials required for mock plugin
  credentials: [],

  tags: ["weather", "mock", "testing", "input"],
  icon: "☀️",

  async execute(input, config, _context) {
    // Simulate a slight delay to mimic real API call
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Generate deterministic mock data based on city name
    const cityHash = input.city
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const baseTemp = 60 + (cityHash % 40); // Temperature between 60-100°F

    // Convert to Celsius if needed
    const temperature =
      input.units === "celsius"
        ? Math.round(((baseTemp - 32) * 5) / 9)
        : baseTemp;

    // Array of weather conditions
    const conditions = ["Sunny", "Partly Cloudy", "Cloudy", "Rainy", "Windy"];
    const condition = conditions[cityHash % conditions.length];

    const result: any = {
      city: input.city,
      temperature,
      units: input.units,
      condition,
      humidity: 40 + (cityHash % 50), // Humidity between 40-90%
      windSpeed: 5 + (cityHash % 20), // Wind speed between 5-25 mph
      timestamp: new Date().toISOString(),
    };

    // Add forecast if requested
    if (config.includeForecast) {
      const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
      result.forecast = days.map((day, index) => {
        const variation = ((cityHash + index * 7) % 20) - 10; // +/- 10 degrees
        return {
          day,
          high: temperature + 10 + variation,
          low: temperature - 5 + variation,
          condition: conditions[(cityHash + index) % conditions.length],
        };
      });
    }

    console.log(
      `Mock weather data generated for ${input.city}: ${temperature}°${input.units === "celsius" ? "C" : "F"}, ${condition}`,
    );

    return result;
  },
});
