/**
 * Stock Price Plugin (Polygon.io)
 *
 * Fetches real-time and historical stock price data.
 */

import { definePlugin, z } from "@kianax/plugin-sdk";

export const stockPrice = definePlugin({
  id: "stock-price-polygon",
  name: "Stock Price (Polygon.io)",
  description:
    "Fetch real-time and historical stock prices, quotes, and market data using Polygon.io API",
  version: "1.0.0",
  type: "input",

  author: {
    name: "Kianax",
    url: "https://kianax.com",
  },

  inputSchema: z.object({
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
  }),

  outputSchema: z.object({
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
  }),

  configSchema: z.object({
    includeRawData: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include raw API response in output"),
  }),

  credentials: [
    {
      key: "polygonApiKey",
      label: "Polygon.io API Key",
      description: "Your Polygon.io API key",
      type: "password",
      required: true,
    },
  ],

  tags: ["stock", "market", "finance", "polygon", "input"],
  icon: "📈",

  async execute(input, config, context) {
    const apiKey = context.credentials?.polygonApiKey;

    if (!apiKey) {
      throw new Error(
        "Polygon.io API key not found. Please configure your credentials.",
      );
    }

    try {
      let data: any;

      switch (input.dataType) {
        case "quote":
          data = await fetchQuote(input.symbol, apiKey);
          break;

        case "previous-close":
          data = await fetchPreviousClose(input.symbol, apiKey);
          break;

        case "aggregates":
          if (!input.timeframe || !input.from || !input.to) {
            throw new Error(
              "timeframe, from, and to are required for aggregates data",
            );
          }
          data = await fetchAggregates(
            input.symbol,
            input.timeframe,
            input.from,
            input.to,
            apiKey,
          );
          break;

        default:
          throw new Error(`Unsupported data type: ${input.dataType}`);
      }

      return {
        symbol: input.symbol,
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
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Stock Price fetch failed: ${error.message}`);
      }
      throw error;
    }
  },
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
