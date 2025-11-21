/**
 * Mock Weather Plugin (Builder Pattern)
 *
 * Returns mock weather data for testing without external API calls.
 * This plugin is useful for local development and testing workflows.
 *
 * This is the builder-pattern version of the mock-weather plugin,
 * demonstrating the new fluent API with full type inference.
 */

import { createPlugin, z } from "@kianax/plugin-sdk";

const inputDataSchema = z.object({
  city: z
    .string()
    .optional()
    .default("San Francisco")
    .describe("City name (e.g., San Francisco, New York)"),
  units: z
    .enum(["celsius", "fahrenheit"])
    .optional()
    .default("fahrenheit")
    .describe("Temperature units"),
});

const weatherDataSchema = z.object({
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
});

export const mockWeatherPlugin = createPlugin("mock-weather")
  .withMetadata({
    name: "Mock Weather",
    description:
      "Returns mock weather data for testing. No external API calls required.",
    version: "1.0.0",
    author: {
      name: "Kianax",
      url: "https://kianax.com",
    },
    tags: ["input", "data", "weather", "mock", "testing"],
    icon: "☀️",
  })
  .withInput("request", {
    label: "Request",
    description: "Weather data request parameters",
    schema: inputDataSchema,
  })
  .withOutput("weather", {
    label: "Weather Data",
    description: "Mock weather information",
    schema: weatherDataSchema,
  })
  .withConfig(
    z.object({
      includeForecast: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include 5-day forecast in output"),
    }),
  )
  .execute(async ({ inputs, config }) => {
    // Full type safety! inputs.request is typed as z.infer<typeof inputDataSchema>
    const { city, units } = inputs.request;

    // Simulate a slight delay to mimic real API call
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Generate deterministic mock data based on city name
    const cityHash = city
      .split("")
      .reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
    const baseTemp = 60 + (cityHash % 40); // Temperature between 60-100°F

    // Convert to Celsius if needed
    const temperature =
      units === "celsius" ? Math.round(((baseTemp - 32) * 5) / 9) : baseTemp;

    // Array of weather conditions
    const conditions = ["Sunny", "Partly Cloudy", "Cloudy", "Rainy", "Windy"];
    const condition = conditions[cityHash % conditions.length]!;

    const unitsFinal = units as "celsius" | "fahrenheit"; // Already has default value

    const result: z.infer<typeof weatherDataSchema> = {
      city,
      temperature,
      units: unitsFinal,
      condition,
      humidity: 40 + (cityHash % 50), // Humidity between 40-90%
      windSpeed: 5 + (cityHash % 20), // Wind speed between 5-25 mph
      timestamp: new Date().toISOString(),
    };

    // Add forecast if requested (config.includeForecast is typed as boolean!)
    if (config.includeForecast) {
      const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
      result.forecast = days.map((day, index) => {
        const variation = ((cityHash + index * 7) % 20) - 10; // +/- 10 degrees
        const forecastCondition =
          conditions[(cityHash + index) % conditions.length]!;
        return {
          day,
          high: temperature + 10 + variation,
          low: temperature - 5 + variation,
          condition: forecastCondition,
        };
      });
    }

    console.log(
      `Mock weather data generated for ${city}: ${temperature}°${units === "celsius" ? "C" : "F"}, ${condition}`,
    );

    // Return is type-checked against weatherDataSchema!
    return {
      weather: result,
    };
  })
  .build();
