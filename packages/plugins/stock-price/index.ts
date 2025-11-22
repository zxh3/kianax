/**
 * Stock Price Plugin (Polygon.io) - Builder Pattern
 *
 * Fetches real-time and historical stock price data using Polygon.io API.
 */

import { createPlugin, z } from "@kianax/plugin-sdk";

const requestSchema = z.object({
  symbol: z
    .string()
    .toUpperCase()
    .describe("Stock ticker symbol (e.g., AAPL, TSLA)"),
  dataType: z
    .enum(["quote", "previous-close", "aggregates"])
    .optional()
    .default("quote")
    .describe("Type of data to fetch"),
  timeframe: z
    .enum(["minute", "hour", "day", "week", "month"])
    .optional()
    .describe(
      "Timeframe for aggregates (required when dataType is 'aggregates')",
    ),
  from: z
    .string()
    .optional()
    .describe("Start date for aggregates (YYYY-MM-DD)"),
  to: z.string().optional().describe("End date for aggregates (YYYY-MM-DD)"),
});

const stockDataSchema = z.object({
  symbol: z.string().describe("Stock ticker symbol"),
  price: z.number().describe("Current or closing price"),
  timestamp: z.string().describe("ISO 8601 timestamp"),
  change: z.number().optional().describe("Price change"),
  changePercent: z.number().optional().describe("Price change percentage"),
  volume: z.number().optional().describe("Trading volume"),
  open: z.number().optional().describe("Opening price"),
  high: z.number().optional().describe("High price"),
  low: z.number().optional().describe("Low price"),
  previousClose: z.number().optional().describe("Previous closing price"),
  data: z.unknown().optional().describe("Raw API response data"),
});

// Helper functions for different data types

async function fetchQuote(symbol: string, apiKey: string) {
  const url = `https://api.polygon.io/v2/last/trade/${symbol}?apiKey=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Polygon API error: ${response.statusText}`);
  }

  const json = (await response.json()) as any;

  if (json.status === "ERROR") {
    throw new Error(`Polygon API error: ${json.error || "Unknown error"}`);
  }

  const result = json.results;

  return {
    price: result.p || 0,
    timestamp: new Date(result.t).toISOString(),
    volume: result.s,
    raw: json,
  };
}

async function fetchPreviousClose(symbol: string, apiKey: string) {
  const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?apiKey=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Polygon API error: ${response.statusText}`);
  }

  const json = (await response.json()) as any;

  if (json.status === "ERROR") {
    throw new Error(`Polygon API error: ${json.error || "Unknown error"}`);
  }

  const result = json.results[0];

  return {
    price: result.c,
    timestamp: new Date(result.t).toISOString(),
    open: result.o,
    high: result.h,
    low: result.l,
    volume: result.v,
    change: result.c - result.o,
    changePercent: ((result.c - result.o) / result.o) * 100,
    previousClose: result.c,
    raw: json,
  };
}

async function fetchAggregates(
  symbol: string,
  timeframe: string,
  from: string,
  to: string,
  apiKey: string,
) {
  const multiplier = 1;
  const timespan = timeframe;
  const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}?apiKey=${apiKey}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Polygon API error: ${response.statusText}`);
  }

  const json = (await response.json()) as any;

  if (json.status === "ERROR") {
    throw new Error(`Polygon API error: ${json.error || "Unknown error"}`);
  }

  // Return the most recent data point
  const result = json.results[json.results.length - 1];

  return {
    price: result.c,
    timestamp: new Date(result.t).toISOString(),
    open: result.o,
    high: result.h,
    low: result.l,
    volume: result.v,
    change: result.c - result.o,
    changePercent: ((result.c - result.o) / result.o) * 100,
    raw: json,
  };
}

export const stockPricePlugin = createPlugin("stock-price-polygon")
  .withMetadata({
    name: "Stock Price (Polygon.io)",
    description:
      "Fetch real-time and historical stock prices, quotes, and market data using Polygon.io API",
    version: "1.0.0",
    author: {
      name: "Kianax",
      url: "https://kianax.com",
    },
    tags: ["data-source"],
    icon: "📈",
  })
  .withCredentials([
    {
      key: "polygonApiKey",
      label: "Polygon.io API Key",
      description: "Your Polygon.io API key",
      type: "password",
      required: true,
    },
  ])
  .withInput("request", {
    label: "Request",
    description: "Stock price request parameters",
    schema: requestSchema,
  })
  .withOutput("stock", {
    label: "Stock Data",
    description: "Stock price and market data",
    schema: stockDataSchema,
  })
  .withConfig(
    z.object({
      includeRawData: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include raw API response in output"),
    }),
  )
  .execute(async ({ inputs, config, context }) => {
    // Fully typed!
    const { symbol, dataType, timeframe, from, to } = inputs.request;
    const apiKey = context.credentials?.polygonApiKey;

    if (!apiKey) {
      throw new Error(
        "Polygon.io API key not found. Please configure your credentials.",
      );
    }

    try {
      let data: any;

      switch (dataType) {
        case "quote":
          data = await fetchQuote(symbol, apiKey);
          break;

        case "previous-close":
          data = await fetchPreviousClose(symbol, apiKey);
          break;

        case "aggregates":
          if (!timeframe || !from || !to) {
            throw new Error(
              "timeframe, from, and to are required for aggregates data",
            );
          }
          data = await fetchAggregates(symbol, timeframe, from, to, apiKey);
          break;

        default:
          throw new Error(`Unsupported data type: ${dataType}`);
      }

      return {
        stock: {
          symbol,
          price: data.price,
          timestamp: data.timestamp,
          change: data.change,
          changePercent: data.changePercent,
          volume: data.volume,
          open: data.open,
          high: data.high,
          low: data.low,
          previousClose: data.previousClose,
          ...(config.includeRawData && { data: data.raw }),
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Stock Price fetch failed: ${error.message}`);
      }
      throw error;
    }
  })
  .build();
