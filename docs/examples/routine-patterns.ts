/**
 * Routine Pattern Examples
 *
 * Demonstrates various routine patterns with the dynamic executor:
 * - Linear flow
 * - Conditional branching (if-else)
 * - Parallel execution
 * - Complex nested patterns
 */

import type { RoutineInput } from "@kianax/shared/temporal";

/**
 * Example 1: Simple Linear Flow
 *
 * Stock Price → AI Analysis → Email Report
 */
export const linearFlow: RoutineInput = {
  routineId: "routine-1",
  userId: "user-123",
  nodes: [
    {
      id: "1",
      pluginId: "stock-price-polygon",
      type: "input",
      config: { symbol: "AAPL" },
      enabled: true,
    },
    {
      id: "2",
      pluginId: "ai-transform",
      type: "processor",
      config: {
        instruction: "Analyze if this is a good buying opportunity",
      },
      enabled: true,
    },
    {
      id: "3",
      pluginId: "email-sendgrid",
      type: "output",
      config: { to: "user@example.com" },
      enabled: true,
    },
  ],
  connections: [
    {
      id: "c1",
      sourceNodeId: "1",
      targetNodeId: "2",
      sourceHandle: "price",
      targetHandle: "data",
    },
    {
      id: "c2",
      sourceNodeId: "2",
      targetNodeId: "3",
      sourceHandle: "result",
      targetHandle: "data",
    },
  ],
};

/**
 * Example 2: Conditional Branching (If-Else)
 *
 * Stock Price → Check if dropped 5%
 *              ├─ TRUE → Buy stock
 *              └─ FALSE → Send wait alert
 */
export const conditionalBranch: RoutineInput = {
  routineId: "routine-2",
  userId: "user-123",
  nodes: [
    {
      id: "1",
      pluginId: "stock-price-polygon",
      type: "input",
      config: { symbol: "AAPL" },
      enabled: true,
    },
    {
      id: "2",
      pluginId: "if-else",
      type: "logic",
      config: {},
      enabled: true,
    },
    {
      id: "3",
      pluginId: "http-request",
      type: "output",
      config: {
        url: "https://api.trading.com/buy",
        method: "POST",
      },
      enabled: true,
    },
    {
      id: "4",
      pluginId: "email-sendgrid",
      type: "output",
      config: {
        to: "user@example.com",
        subject: "Stock not ready to buy",
      },
      enabled: true,
    },
  ],
  connections: [
    // Stock price → If-Else condition
    {
      id: "c1",
      sourceNodeId: "1",
      targetNodeId: "2",
      sourceHandle: "price",
      targetHandle: "value",
    },

    // If-Else TRUE branch → Buy
    {
      id: "c2",
      sourceNodeId: "2",
      targetNodeId: "3",
      sourceHandle: "result",
      targetHandle: "data",
      condition: {
        type: "branch",
        value: "true",
      },
    },

    // If-Else FALSE branch → Alert
    {
      id: "c3",
      sourceNodeId: "2",
      targetNodeId: "4",
      sourceHandle: "result",
      targetHandle: "data",
      condition: {
        type: "branch",
        value: "false",
      },
    },
  ],
  triggerData: {
    previousPrice: 150,
    dropThreshold: 0.05,
  },
};

/**
 * Example 3: Parallel Execution
 *
 *        ┌─ Stock Price ─┐
 * Start ─┤              ├─ Merge → AI Analysis → Report
 *        └─ News Fetch ─┘
 */
export const parallelExecution: RoutineInput = {
  routineId: "routine-3",
  userId: "user-123",
  nodes: [
    {
      id: "1",
      pluginId: "stock-price-polygon",
      type: "input",
      config: { symbol: "AAPL" },
      enabled: true,
    },
    {
      id: "2",
      pluginId: "http-request",
      type: "input",
      config: {
        url: "https://newsapi.org/v2/everything?q=AAPL",
        method: "GET",
      },
      enabled: true,
    },
    {
      id: "3",
      pluginId: "ai-transform",
      type: "processor",
      config: {
        instruction:
          "Merge stock price and news sentiment to provide investment advice",
      },
      enabled: true,
    },
    {
      id: "4",
      pluginId: "email-sendgrid",
      type: "output",
      config: { to: "user@example.com" },
      enabled: true,
    },
  ],
  connections: [
    // Both input nodes feed into AI processor
    {
      id: "c1",
      sourceNodeId: "1",
      targetNodeId: "3",
      sourceHandle: "price",
      targetHandle: "stockData",
    },
    {
      id: "c2",
      sourceNodeId: "2",
      targetNodeId: "3",
      sourceHandle: "data",
      targetHandle: "newsData",
    },
    {
      id: "c3",
      sourceNodeId: "3",
      targetNodeId: "4",
      sourceHandle: "result",
      targetHandle: "data",
    },
  ],
};

/**
 * Example 4: Complex Nested Branching
 *
 * Stock Price → Check price drop
 *              ├─ TRUE → Fetch news → Analyze sentiment
 *              │                      ├─ Positive → Buy
 *              │                      └─ Negative → Wait
 *              └─ FALSE → Email "No action needed"
 */
export const nestedBranching: RoutineInput = {
  routineId: "routine-4",
  userId: "user-123",
  nodes: [
    // Input
    {
      id: "1",
      pluginId: "stock-price-polygon",
      type: "input",
      config: { symbol: "AAPL" },
      enabled: true,
    },

    // First if-else: Check if price dropped
    {
      id: "2",
      pluginId: "if-else",
      type: "logic",
      config: {},
      enabled: true,
    },

    // True branch: Fetch news
    {
      id: "3",
      pluginId: "http-request",
      type: "input",
      config: { url: "https://newsapi.org/..." },
      enabled: true,
    },

    // Analyze sentiment
    {
      id: "4",
      pluginId: "ai-transform",
      type: "processor",
      config: { instruction: "Analyze sentiment (positive/negative)" },
      enabled: true,
    },

    // Second if-else: Check sentiment
    {
      id: "5",
      pluginId: "if-else",
      type: "logic",
      config: {},
      enabled: true,
    },

    // Positive sentiment → Buy
    {
      id: "6",
      pluginId: "http-request",
      type: "output",
      config: { url: "https://api.trading.com/buy", method: "POST" },
      enabled: true,
    },

    // Negative sentiment → Wait
    {
      id: "7",
      pluginId: "email-sendgrid",
      type: "output",
      config: { subject: "Wait for better conditions" },
      enabled: true,
    },

    // False branch: No action needed
    {
      id: "8",
      pluginId: "email-sendgrid",
      type: "output",
      config: { subject: "No price drop detected" },
      enabled: true,
    },
  ],
  connections: [
    // Stock price → First if-else
    {
      id: "c1",
      sourceNodeId: "1",
      targetNodeId: "2",
      sourceHandle: "price",
      targetHandle: "value",
    },

    // First if-else TRUE → Fetch news
    {
      id: "c2",
      sourceNodeId: "2",
      targetNodeId: "3",
      condition: { type: "branch", value: "true" },
    },

    // First if-else FALSE → Email "no action"
    {
      id: "c3",
      sourceNodeId: "2",
      targetNodeId: "8",
      condition: { type: "branch", value: "false" },
    },

    // News → AI sentiment analysis
    {
      id: "c4",
      sourceNodeId: "3",
      targetNodeId: "4",
      sourceHandle: "data",
      targetHandle: "data",
    },

    // AI analysis → Second if-else
    {
      id: "c5",
      sourceNodeId: "4",
      targetNodeId: "5",
      sourceHandle: "result",
      targetHandle: "value",
    },

    // Second if-else TRUE (positive) → Buy
    {
      id: "c6",
      sourceNodeId: "5",
      targetNodeId: "6",
      condition: { type: "branch", value: "true" },
    },

    // Second if-else FALSE (negative) → Wait
    {
      id: "c7",
      sourceNodeId: "5",
      targetNodeId: "7",
      condition: { type: "branch", value: "false" },
    },
  ],
};

/**
 * Example 5: Diamond Pattern (Merge after Branch)
 *
 * Stock Price → Check price
 *              ├─ Up → Log gain
 *              └─ Down → Log loss
 *                       ↓
 *                    Email Report (waits for whichever branch executed)
 */
export const diamondPattern: RoutineInput = {
  routineId: "routine-5",
  userId: "user-123",
  nodes: [
    {
      id: "1",
      pluginId: "stock-price-polygon",
      type: "input",
      config: { symbol: "AAPL" },
      enabled: true,
    },
    {
      id: "2",
      pluginId: "if-else",
      type: "logic",
      config: {},
      enabled: true,
    },
    {
      id: "3",
      pluginId: "ai-transform",
      type: "processor",
      config: { instruction: "Format as gain message" },
      enabled: true,
    },
    {
      id: "4",
      pluginId: "ai-transform",
      type: "processor",
      config: { instruction: "Format as loss message" },
      enabled: true,
    },
    {
      id: "5",
      pluginId: "email-sendgrid",
      type: "output",
      config: { to: "user@example.com" },
      enabled: true,
    },
  ],
  connections: [
    {
      id: "c1",
      sourceNodeId: "1",
      targetNodeId: "2",
      sourceHandle: "price",
      targetHandle: "value",
    },

    // TRUE branch → Gain formatter
    {
      id: "c2",
      sourceNodeId: "2",
      targetNodeId: "3",
      condition: { type: "branch", value: "true" },
    },

    // FALSE branch → Loss formatter
    {
      id: "c3",
      sourceNodeId: "2",
      targetNodeId: "4",
      condition: { type: "branch", value: "false" },
    },

    // Both branches merge into email
    {
      id: "c4",
      sourceNodeId: "3",
      targetNodeId: "5",
      sourceHandle: "result",
      targetHandle: "data",
    },
    {
      id: "c5",
      sourceNodeId: "4",
      targetNodeId: "5",
      sourceHandle: "result",
      targetHandle: "data",
    },
  ],
};

/**
 * Execution behavior explanation:
 *
 * Example 1 (Linear): Execute sequentially: 1 → 2 → 3
 *
 * Example 2 (Branch):
 * - If price dropped 5%: 1 → 2 → 3 (buy), node 4 never executes
 * - If price stable: 1 → 2 → 4 (alert), node 3 never executes
 *
 * Example 3 (Parallel):
 * - Nodes 1 and 2 execute in parallel (no dependencies)
 * - Node 3 waits for BOTH 1 and 2 to complete
 * - Node 4 executes after 3 completes
 *
 * Example 4 (Nested):
 * - Path 1 (drop + positive): 1 → 2 → 3 → 4 → 5 → 6
 * - Path 2 (drop + negative): 1 → 2 → 3 → 4 → 5 → 7
 * - Path 3 (no drop): 1 → 2 → 8
 *
 * Example 5 (Diamond):
 * - If up: 1 → 2 → 3 → 5
 * - If down: 1 → 2 → 4 → 5
 * - Node 5 executes in both cases but receives different input
 */
