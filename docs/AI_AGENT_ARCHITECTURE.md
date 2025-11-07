# AI Agent Trading Platform - Architecture Design

## Overview

This document extends the [base trading platform architecture](./PLAN.md) with an AI agent layer that enables users to configure intelligent trading agents powered by Large Language Models (LLMs). Agents can work individually or as a multi-agent system, triggered by various events (time, price movements, news, custom webhooks).

**Core Concept:** Users configure AI agents through natural language prompts or visual workflows. The platform monitors market conditions and triggers agents to analyze data and make trading decisions.

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   USER INTERFACE                         │
│  ┌────────────────────┐  ┌────────────────────────┐    │
│  │  Agent Builder     │  │  Workflow Designer     │    │
│  │  (NL Prompts)      │  │  (Visual DAG Editor)   │    │
│  └────────────────────┘  └────────────────────────┘    │
└─────────────────┬────────────────────────────────────────┘
                  │
┌─────────────────▼────────────────────────────────────────┐
│              AI AGENT PLATFORM LAYER                      │
│                                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │          TRIGGER MANAGEMENT SYSTEM                 │  │
│  │  ┌──────────┐ ┌───────────┐ ┌──────────────────┐ │  │
│  │  │Time-Based│ │Price/Vol  │ │News/Sentiment    │ │  │
│  │  │Scheduler │ │Event Mon. │ │Monitor           │ │  │
│  │  └────┬─────┘ └─────┬─────┘ └────────┬─────────┘ │  │
│  │       │             │                 │            │  │
│  │       └─────────────┴────────┬────────┘            │  │
│  └────────────────────────────┬─┴────────────────────┘  │
│                                │                          │
│  ┌────────────────────────────▼──────────────────────┐  │
│  │       AGENT ORCHESTRATION ENGINE                   │  │
│  │  ┌──────────────┐  ┌──────────────────────────┐  │  │
│  │  │ Agent Queue  │  │  Multi-Agent Coordinator │  │  │
│  │  │ & Scheduler  │  │  (Consensus & Allocation)│  │  │
│  │  └──────┬───────┘  └────────────┬──────────────┘  │  │
│  │         │                        │                 │  │
│  │  ┌──────▼────────────────────────▼──────────────┐ │  │
│  │  │         AGENT EXECUTION RUNTIME              │ │  │
│  │  │  ┌─────────────┐    ┌─────────────────────┐ │ │  │
│  │  │  │Workflow Eng.│    │Single Agent Executor│ │ │  │
│  │  │  │(DAG Runner) │    │(Prompt → Decision)  │ │ │  │
│  │  │  └─────────────┘    └─────────────────────┘ │ │  │
│  │  └────────────────────┬──────────────────────┘ │  │
│  └───────────────────────┼────────────────────────┘  │
│                          │                            │
│  ┌───────────────────────▼────────────────────────┐  │
│  │            LLM SERVICE LAYER                    │  │
│  │  ┌──────────────┐  ┌─────────────────────────┐ │  │
│  │  │Context       │  │ LLM Providers           │ │  │
│  │  │Builder       │  │ (GPT-4, Claude, etc.)   │ │  │
│  │  └──────┬───────┘  └──────────┬──────────────┘ │  │
│  │         │                      │                 │  │
│  │  ┌──────▼──────────────────────▼──────────────┐ │  │
│  │  │     Decision Parser & Validator            │ │  │
│  │  │  (Extract actions, validate safety)        │ │  │
│  │  └────────────────────┬───────────────────────┘ │  │
│  └─────────────────────┬─┴─────────────────────────┘  │
└────────────────────────┼───────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────┐
│           TRADING ENGINE (from PLAN.md)                 │
│  - Order validation & execution                         │
│  - Risk management                                      │
│  - Portfolio management                                 │
└────────────────────────┬───────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────┐
│              DATA PIPELINE                              │
│  ┌─────────────┐  ┌────────────┐  ┌────────────────┐  │
│  │Market Data  │  │News Feed   │  │Technical       │  │
│  │(Polygon)    │  │Aggregator  │  │Indicators      │  │
│  └─────────────┘  └────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Agent Management System

### Agent Registry

**Purpose:** Store and manage agent configurations, prompts, and state

```typescript
interface Agent {
  id: string;
  user_id: string;
  name: string;
  description: string;

  // Configuration type
  config_type: 'prompt' | 'workflow';

  // For prompt-based agents
  system_prompt?: string;
  user_prompt_template?: string;

  // For workflow-based agents
  workflow_definition?: WorkflowDAG;

  // Agent behavior settings
  settings: {
    llm_provider: 'openai' | 'anthropic';
    model: 'gpt-4' | 'claude-3-opus' | 'claude-3-sonnet';
    temperature: number;
    max_tokens: number;
  };

  // Risk limits for this agent
  risk_limits: {
    max_position_size: number;      // Max $ per position
    max_daily_trades: number;
    max_portfolio_allocation: number; // % of total portfolio
    allowed_symbols?: string[];      // Whitelist (optional)
    blocked_symbols?: string[];      // Blacklist (optional)
  };

  // Agent status
  status: 'active' | 'paused' | 'archived';

  // Triggers attached to this agent
  triggers: string[];  // Array of trigger IDs

  // Performance tracking
  stats: {
    total_executions: number;
    successful_trades: number;
    failed_trades: number;
    total_pnl: number;
    win_rate: number;
    avg_execution_time_ms: number;
  };

  created_at: Date;
  updated_at: Date;
}
```

### Multi-Agent Setup

Users can create multiple agents that work together:

**Example Multi-Agent Configuration:**
```typescript
{
  "agents": [
    {
      "id": "agent-trend-analyzer",
      "name": "Trend Analyzer",
      "role": "analyzer",
      "prompt": "Analyze market trends and identify potential opportunities based on technical indicators and price action.",
      "outputs": ["trend_direction", "strength", "opportunities"]
    },
    {
      "id": "agent-risk-assessor",
      "name": "Risk Assessor",
      "role": "validator",
      "prompt": "Evaluate the risk of proposed trades. Consider portfolio exposure, volatility, and correlation.",
      "inputs": ["opportunities"],
      "outputs": ["risk_score", "approved_trades"]
    },
    {
      "id": "agent-executor",
      "name": "Trade Executor",
      "role": "executor",
      "prompt": "Execute approved trades with optimal timing and position sizing.",
      "inputs": ["approved_trades"],
      "outputs": ["executed_orders"]
    }
  ],
  "coordination": {
    "type": "sequential", // or "parallel", "voting", "hierarchical"
    "flow": ["agent-trend-analyzer", "agent-risk-assessor", "agent-executor"]
  }
}
```

---

## 2. LLM Integration Layer

### Context Building

The system builds rich context for LLM agents:

```typescript
interface AgentContext {
  // Market data
  current_prices: {
    [symbol: string]: {
      price: number;
      change_percent: number;
      volume: number;
      timestamp: Date;
    };
  };

  // Technical indicators
  indicators: {
    [symbol: string]: {
      rsi: number;
      macd: { value: number; signal: number; histogram: number };
      moving_averages: { ma20: number; ma50: number; ma200: number };
      bollinger_bands: { upper: number; middle: number; lower: number };
    };
  };

  // Portfolio state
  portfolio: {
    cash_balance: number;
    buying_power: number;
    total_value: number;
    positions: Array<{
      symbol: string;
      quantity: number;
      avg_cost: number;
      current_price: number;
      unrealized_pnl: number;
      pnl_percent: number;
    }>;
  };

  // News & sentiment
  news: Array<{
    title: string;
    summary: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    relevance_score: number;
    published_at: Date;
    symbols: string[];
  }>;

  // Recent agent decisions (for multi-agent context)
  previous_decisions?: Array<{
    agent_id: string;
    agent_name: string;
    decision: any;
    timestamp: Date;
  }>;

  // Trigger information
  trigger: {
    type: string;
    reason: string;
    data: any;
  };

  // Historical performance
  agent_performance?: {
    recent_trades: Array<{
      symbol: string;
      side: string;
      pnl: number;
      execution_date: Date;
    }>;
    win_rate_last_30_days: number;
    total_pnl_last_30_days: number;
  };

  // Timestamp
  timestamp: Date;
  market_hours: boolean;
}
```

### Prompt Engineering

**System Prompt Template:**
```typescript
const SYSTEM_PROMPT = `You are an expert trading agent managing a portfolio of stocks. Your goal is to make profitable trading decisions while managing risk.

CURRENT CONTEXT:
- Portfolio Value: ${{portfolio.total_value}}
- Cash Available: ${{portfolio.cash_balance}}
- Open Positions: {{portfolio.positions.length}}
- Market Hours: {{market_hours ? 'OPEN' : 'CLOSED'}}

RISK LIMITS:
- Max position size: ${{risk_limits.max_position_size}}
- Max portfolio allocation per trade: {{risk_limits.max_portfolio_allocation}}%
- Max daily trades: {{risk_limits.max_daily_trades}}

INSTRUCTIONS:
1. Analyze the provided market data, technical indicators, and news
2. Make trading decisions based on your strategy
3. Always consider risk management
4. Provide clear reasoning for your decisions

OUTPUT FORMAT:
You must respond with a valid JSON object containing your decision:
{
  "decision": "buy" | "sell" | "hold",
  "symbol": "AAPL",
  "quantity": 10,
  "order_type": "market" | "limit",
  "limit_price": 150.00,  // only if limit order
  "reasoning": "Detailed explanation of your decision",
  "confidence": 0.85,  // 0-1 scale
  "risk_assessment": "low" | "medium" | "high"
}

If you recommend no action, use:
{
  "decision": "hold",
  "reasoning": "Explanation of why no action is needed"
}`;
```

**User Prompt Template (Natural Language):**
```typescript
// User-defined strategy in plain English
const userPrompt = `
Buy AAPL when:
- RSI is below 30 (oversold)
- Price drops more than 3% in a day
- Trading volume is above average
- No negative news in the last 24 hours

Position size should be 5% of portfolio value.
Only trade during market hours.
`;

// Compiled prompt sent to LLM:
const finalPrompt = `
${SYSTEM_PROMPT}

YOUR STRATEGY:
${userPrompt}

CURRENT MARKET DATA:
${JSON.stringify(context, null, 2)}

What action should you take? Respond with a JSON object as specified above.
`;
```

### LLM Service Implementation

```typescript
// services/llm.service.ts
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

class LLMService {
  private anthropic: Anthropic;
  private openai: OpenAI;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async executeAgent(agent: Agent, context: AgentContext): Promise<AgentDecision> {
    // 1. Build prompt
    const prompt = this.buildPrompt(agent, context);

    // 2. Call LLM
    let response: string;
    if (agent.settings.llm_provider === 'anthropic') {
      response = await this.callClaude(agent, prompt);
    } else {
      response = await this.callGPT(agent, prompt);
    }

    // 3. Parse and validate decision
    const decision = this.parseDecision(response);
    this.validateDecision(decision, agent, context);

    // 4. Log execution
    await this.logExecution(agent.id, context, decision);

    return decision;
  }

  private async callClaude(agent: Agent, prompt: string): Promise<string> {
    const message = await this.anthropic.messages.create({
      model: agent.settings.model,
      max_tokens: agent.settings.max_tokens,
      temperature: agent.settings.temperature,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    return message.content[0].type === 'text'
      ? message.content[0].text
      : '';
  }

  private async callGPT(agent: Agent, prompt: string): Promise<string> {
    const completion = await this.openai.chat.completions.create({
      model: agent.settings.model,
      temperature: agent.settings.temperature,
      max_tokens: agent.settings.max_tokens,
      response_format: { type: "json_object" },
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt(agent)
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    return completion.choices[0].message.content || '';
  }

  private parseDecision(response: string): AgentDecision {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }

      const decision = JSON.parse(jsonMatch[0]);

      // Validate required fields
      if (!decision.decision) {
        throw new Error('Missing "decision" field');
      }

      return decision as AgentDecision;
    } catch (error) {
      throw new Error(`Failed to parse LLM response: ${error.message}`);
    }
  }

  private validateDecision(
    decision: AgentDecision,
    agent: Agent,
    context: AgentContext
  ): void {
    // Validate decision type
    if (!['buy', 'sell', 'hold'].includes(decision.decision)) {
      throw new Error(`Invalid decision type: ${decision.decision}`);
    }

    // If not hold, must have symbol and quantity
    if (decision.decision !== 'hold') {
      if (!decision.symbol || !decision.quantity) {
        throw new Error('Buy/Sell decisions must include symbol and quantity');
      }

      // Check symbol whitelist/blacklist
      if (agent.risk_limits.allowed_symbols &&
          !agent.risk_limits.allowed_symbols.includes(decision.symbol)) {
        throw new Error(`Symbol ${decision.symbol} not in allowed list`);
      }

      if (agent.risk_limits.blocked_symbols?.includes(decision.symbol)) {
        throw new Error(`Symbol ${decision.symbol} is blocked`);
      }

      // Calculate position value
      const price = context.current_prices[decision.symbol]?.price;
      if (!price) {
        throw new Error(`No price available for ${decision.symbol}`);
      }

      const positionValue = decision.quantity * price;

      // Check position size limit
      if (positionValue > agent.risk_limits.max_position_size) {
        throw new Error(
          `Position size $${positionValue} exceeds limit $${agent.risk_limits.max_position_size}`
        );
      }

      // Check portfolio allocation limit
      const allocationPercent = (positionValue / context.portfolio.total_value) * 100;
      if (allocationPercent > agent.risk_limits.max_portfolio_allocation) {
        throw new Error(
          `Allocation ${allocationPercent}% exceeds limit ${agent.risk_limits.max_portfolio_allocation}%`
        );
      }

      // Check buying power (for buys)
      if (decision.decision === 'buy' && positionValue > context.portfolio.buying_power) {
        throw new Error(
          `Insufficient buying power: need $${positionValue}, have $${context.portfolio.buying_power}`
        );
      }

      // Check position exists (for sells)
      if (decision.decision === 'sell') {
        const position = context.portfolio.positions.find(p => p.symbol === decision.symbol);
        if (!position || position.quantity < decision.quantity) {
          throw new Error(
            `Cannot sell ${decision.quantity} shares of ${decision.symbol}: insufficient position`
          );
        }
      }
    }
  }

  private async logExecution(
    agentId: string,
    context: AgentContext,
    decision: AgentDecision
  ): Promise<void> {
    await db.agent_executions.create({
      agent_id: agentId,
      trigger_type: context.trigger.type,
      context: context,
      decision: decision,
      llm_response: decision.reasoning,
      executed_at: new Date()
    });
  }
}

interface AgentDecision {
  decision: 'buy' | 'sell' | 'hold';
  symbol?: string;
  quantity?: number;
  order_type?: 'market' | 'limit';
  limit_price?: number;
  reasoning: string;
  confidence?: number;
  risk_assessment?: 'low' | 'medium' | 'high';
}
```

---

## 3. Trigger Management System

### Trigger Types

```typescript
interface Trigger {
  id: string;
  user_id: string;
  agent_ids: string[];  // Agents to trigger
  name: string;
  enabled: boolean;

  type: 'time' | 'price' | 'volume' | 'indicator' | 'news' | 'webhook';

  // Time-based triggers
  schedule?: {
    cron: string;  // e.g., "0 9 * * 1-5" (9 AM weekdays)
    timezone: string;
  };

  // Price-based triggers
  price_condition?: {
    symbol: string;
    condition: 'above' | 'below' | 'crosses_above' | 'crosses_below' | 'change_percent';
    threshold: number;
    timeframe?: '1m' | '5m' | '15m' | '1h' | '1d';
  };

  // Volume-based triggers
  volume_condition?: {
    symbol: string;
    condition: 'above_average' | 'spike';
    multiplier: number;  // e.g., 2x average volume
  };

  // Technical indicator triggers
  indicator_condition?: {
    symbol: string;
    indicator: 'rsi' | 'macd' | 'ma_cross' | 'bollinger';
    condition: string;  // e.g., "rsi < 30", "macd_cross_up"
    parameters?: any;
  };

  // News-based triggers
  news_condition?: {
    keywords: string[];
    symbols?: string[];
    sentiment?: 'positive' | 'negative' | 'any';
    min_relevance: number;
  };

  // Webhook trigger
  webhook_config?: {
    secret: string;
    validation_rules?: any;
  };

  // Throttling
  throttle?: {
    max_executions_per_hour: number;
    min_interval_seconds: number;
  };

  created_at: Date;
  last_triggered_at?: Date;
}
```

### Trigger Manager Implementation

```typescript
// services/trigger-manager.service.ts
import { CronJob } from 'cron';

class TriggerManager {
  private cronJobs = new Map<string, CronJob>();
  private activeMonitors = new Map<string, NodeJS.Timeout>();

  async initializeTriggers(): Promise<void> {
    const triggers = await db.triggers.findMany({ enabled: true });

    for (const trigger of triggers) {
      switch (trigger.type) {
        case 'time':
          this.setupTimeTrigger(trigger);
          break;
        case 'price':
        case 'volume':
        case 'indicator':
          this.setupMarketDataTrigger(trigger);
          break;
        case 'news':
          this.setupNewsTrigger(trigger);
          break;
        // Webhooks are handled by API endpoints
      }
    }
  }

  private setupTimeTrigger(trigger: Trigger): void {
    if (!trigger.schedule) return;

    const job = new CronJob(
      trigger.schedule.cron,
      async () => {
        await this.fireTrigger(trigger, { type: 'scheduled' });
      },
      null,
      true,
      trigger.schedule.timezone
    );

    this.cronJobs.set(trigger.id, job);
  }

  private setupMarketDataTrigger(trigger: Trigger): void {
    // Subscribe to real-time market data
    const interval = setInterval(async () => {
      const shouldTrigger = await this.evaluateMarketCondition(trigger);

      if (shouldTrigger) {
        await this.fireTrigger(trigger, {
          type: 'market_data',
          condition_met: true
        });
      }
    }, 5000); // Check every 5 seconds

    this.activeMonitors.set(trigger.id, interval);
  }

  private async evaluateMarketCondition(trigger: Trigger): Promise<boolean> {
    // Check if throttled
    if (trigger.last_triggered_at && trigger.throttle) {
      const secondsSinceLastTrigger =
        (Date.now() - trigger.last_triggered_at.getTime()) / 1000;

      if (secondsSinceLastTrigger < trigger.throttle.min_interval_seconds) {
        return false;
      }
    }

    // Evaluate price condition
    if (trigger.price_condition) {
      return this.evaluatePriceCondition(trigger.price_condition);
    }

    // Evaluate volume condition
    if (trigger.volume_condition) {
      return this.evaluateVolumeCondition(trigger.volume_condition);
    }

    // Evaluate indicator condition
    if (trigger.indicator_condition) {
      return this.evaluateIndicatorCondition(trigger.indicator_condition);
    }

    return false;
  }

  private async evaluatePriceCondition(condition: any): Promise<boolean> {
    const currentPrice = await marketDataService.getCurrentPrice(condition.symbol);

    switch (condition.condition) {
      case 'above':
        return currentPrice > condition.threshold;
      case 'below':
        return currentPrice < condition.threshold;
      case 'change_percent':
        const dayOpen = await marketDataService.getDayOpen(condition.symbol);
        const changePercent = ((currentPrice - dayOpen) / dayOpen) * 100;
        return Math.abs(changePercent) >= condition.threshold;
      // ... more conditions
    }

    return false;
  }

  private async fireTrigger(trigger: Trigger, data: any): Promise<void> {
    console.log(`Trigger fired: ${trigger.name}`, data);

    // Update last triggered time
    await db.triggers.update(trigger.id, {
      last_triggered_at: new Date()
    });

    // Queue agents for execution
    for (const agentId of trigger.agent_ids) {
      await agentQueue.add('execute-agent', {
        agent_id: agentId,
        trigger_id: trigger.id,
        trigger_data: data
      });
    }
  }

  private setupNewsTrigger(trigger: Trigger): void {
    // Subscribe to news feed
    newsService.on('article', async (article: NewsArticle) => {
      if (!trigger.news_condition) return;

      // Check if article matches criteria
      const matches = this.matchesNewsCondition(article, trigger.news_condition);

      if (matches) {
        await this.fireTrigger(trigger, {
          type: 'news',
          article: article
        });
      }
    });
  }

  private matchesNewsCondition(article: NewsArticle, condition: any): boolean {
    // Check keywords
    const hasKeyword = condition.keywords.some(keyword =>
      article.title.toLowerCase().includes(keyword.toLowerCase()) ||
      article.summary.toLowerCase().includes(keyword.toLowerCase())
    );

    if (!hasKeyword) return false;

    // Check symbols
    if (condition.symbols && condition.symbols.length > 0) {
      const hasSymbol = condition.symbols.some(symbol =>
        article.symbols.includes(symbol)
      );
      if (!hasSymbol) return false;
    }

    // Check sentiment
    if (condition.sentiment && condition.sentiment !== 'any') {
      if (article.sentiment !== condition.sentiment) return false;
    }

    // Check relevance
    if (article.relevance_score < condition.min_relevance) return false;

    return true;
  }
}
```

---

## 4. Visual Workflow Builder

### Workflow Definition (DAG)

```typescript
interface WorkflowDAG {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  start_node: string;
}

interface WorkflowNode {
  id: string;
  type: 'start' | 'condition' | 'action' | 'llm_agent' | 'data_fetch' | 'end';

  // For condition nodes
  condition?: {
    type: 'price_check' | 'indicator_check' | 'portfolio_check' | 'custom';
    expression: string;  // e.g., "rsi < 30 AND price < moving_average"
  };

  // For action nodes
  action?: {
    type: 'place_order' | 'cancel_order' | 'send_notification' | 'log';
    parameters: any;
  };

  // For LLM agent nodes
  llm_config?: {
    prompt: string;
    output_schema: any;
  };

  // For data fetch nodes
  data_fetch?: {
    source: 'market_data' | 'news' | 'indicators' | 'portfolio';
    parameters: any;
  };

  position: { x: number; y: number };  // For UI rendering
}

interface WorkflowEdge {
  id: string;
  source_node: string;
  target_node: string;
  condition?: string;  // e.g., "if result === 'buy'"
  label?: string;      // For UI display
}
```

### Example Workflow: "Dip Buying Strategy"

```typescript
const dipBuyingWorkflow: WorkflowDAG = {
  start_node: 'start',
  nodes: [
    {
      id: 'start',
      type: 'start',
      position: { x: 0, y: 0 }
    },
    {
      id: 'fetch_price',
      type: 'data_fetch',
      data_fetch: {
        source: 'market_data',
        parameters: { symbols: ['AAPL', 'MSFT', 'GOOGL'] }
      },
      position: { x: 0, y: 100 }
    },
    {
      id: 'check_dip',
      type: 'condition',
      condition: {
        type: 'custom',
        expression: 'price_change_percent < -3 AND volume > average_volume * 1.5'
      },
      position: { x: 0, y: 200 }
    },
    {
      id: 'llm_analysis',
      type: 'llm_agent',
      llm_config: {
        prompt: 'Analyze if this dip is a buying opportunity. Consider: 1) Recent news, 2) Overall market trend, 3) Company fundamentals. Should we buy?',
        output_schema: {
          decision: 'string',
          confidence: 'number',
          reasoning: 'string'
        }
      },
      position: { x: 0, y: 300 }
    },
    {
      id: 'check_llm_decision',
      type: 'condition',
      condition: {
        type: 'custom',
        expression: 'decision === "buy" AND confidence > 0.7'
      },
      position: { x: 0, y: 400 }
    },
    {
      id: 'place_order',
      type: 'action',
      action: {
        type: 'place_order',
        parameters: {
          side: 'buy',
          quantity: '{{calculate_position_size}}',
          order_type: 'limit',
          limit_price: '{{current_price * 0.99}}'  // 1% below current
        }
      },
      position: { x: -100, y: 500 }
    },
    {
      id: 'log_skip',
      type: 'action',
      action: {
        type: 'log',
        parameters: {
          message: 'Dip detected but not confident enough to buy'
        }
      },
      position: { x: 100, y: 500 }
    },
    {
      id: 'end',
      type: 'end',
      position: { x: 0, y: 600 }
    }
  ],
  edges: [
    { id: 'e1', source_node: 'start', target_node: 'fetch_price' },
    { id: 'e2', source_node: 'fetch_price', target_node: 'check_dip' },
    {
      id: 'e3',
      source_node: 'check_dip',
      target_node: 'llm_analysis',
      condition: 'true',
      label: 'Dip detected'
    },
    {
      id: 'e4',
      source_node: 'check_dip',
      target_node: 'end',
      condition: 'false',
      label: 'No dip'
    },
    {
      id: 'e5',
      source_node: 'llm_analysis',
      target_node: 'check_llm_decision'
    },
    {
      id: 'e6',
      source_node: 'check_llm_decision',
      target_node: 'place_order',
      condition: 'true',
      label: 'High confidence buy'
    },
    {
      id: 'e7',
      source_node: 'check_llm_decision',
      target_node: 'log_skip',
      condition: 'false',
      label: 'Low confidence'
    },
    { id: 'e8', source_node: 'place_order', target_node: 'end' },
    { id: 'e9', source_node: 'log_skip', target_node: 'end' }
  ]
};
```

### Workflow Execution Engine

```typescript
// services/workflow-engine.service.ts
class WorkflowEngine {
  async executeWorkflow(
    workflow: WorkflowDAG,
    context: AgentContext
  ): Promise<WorkflowResult> {
    const executionContext = {
      ...context,
      variables: new Map<string, any>(),
      results: new Map<string, any>()
    };

    let currentNode = workflow.nodes.find(n => n.id === workflow.start_node);
    const executionPath: string[] = [];

    while (currentNode) {
      executionPath.push(currentNode.id);

      // Execute current node
      const result = await this.executeNode(currentNode, executionContext);
      executionContext.results.set(currentNode.id, result);

      // If end node, stop
      if (currentNode.type === 'end') {
        break;
      }

      // Find next node
      currentNode = this.getNextNode(currentNode, workflow, result, executionContext);
    }

    return {
      success: true,
      execution_path: executionPath,
      final_result: executionContext.results.get(executionPath[executionPath.length - 1])
    };
  }

  private async executeNode(
    node: WorkflowNode,
    context: any
  ): Promise<any> {
    switch (node.type) {
      case 'start':
        return { started: true };

      case 'data_fetch':
        return this.executDataFetch(node.data_fetch!, context);

      case 'condition':
        return this.evaluateCondition(node.condition!, context);

      case 'llm_agent':
        return this.executeLLMNode(node.llm_config!, context);

      case 'action':
        return this.executeAction(node.action!, context);

      case 'end':
        return { completed: true };

      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  private async executeLLMNode(config: any, context: any): Promise<any> {
    const prompt = this.interpolateTemplate(config.prompt, context);

    // Call LLM (simplified)
    const llmService = new LLMService();
    const response = await llmService.callClaude({
      settings: {
        llm_provider: 'anthropic',
        model: 'claude-3-sonnet',
        temperature: 0.7,
        max_tokens: 1000
      }
    } as Agent, prompt);

    // Parse response according to output schema
    const parsed = JSON.parse(response);

    // Store in variables for downstream nodes
    context.variables.set('llm_result', parsed);

    return parsed;
  }

  private async executeAction(action: any, context: any): Promise<any> {
    switch (action.type) {
      case 'place_order':
        // Interpolate parameters
        const orderParams = {
          symbol: this.interpolateTemplate(action.parameters.symbol, context),
          quantity: this.evaluateExpression(action.parameters.quantity, context),
          side: action.parameters.side,
          order_type: action.parameters.order_type,
          limit_price: action.parameters.limit_price
            ? this.evaluateExpression(action.parameters.limit_price, context)
            : undefined
        };

        // Submit order via trading engine
        const order = await tradingEngine.submitOrder(context.user_id, orderParams);
        return { order_id: order.id };

      case 'send_notification':
        await notificationService.send(context.user_id, action.parameters.message);
        return { sent: true };

      case 'log':
        console.log('[Workflow]', action.parameters.message);
        return { logged: true };

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private getNextNode(
    currentNode: WorkflowNode,
    workflow: WorkflowDAG,
    nodeResult: any,
    context: any
  ): WorkflowNode | null {
    // Find outgoing edges
    const edges = workflow.edges.filter(e => e.source_node === currentNode.id);

    // If no edges, workflow ends
    if (edges.length === 0) return null;

    // Find first edge whose condition is met
    for (const edge of edges) {
      if (!edge.condition) {
        // No condition, always follow
        return workflow.nodes.find(n => n.id === edge.target_node) || null;
      }

      // Evaluate edge condition
      const conditionMet = this.evaluateExpression(edge.condition, {
        ...context,
        result: nodeResult
      });

      if (conditionMet) {
        return workflow.nodes.find(n => n.id === edge.target_node) || null;
      }
    }

    // No condition met, workflow ends
    return null;
  }

  private evaluateExpression(expression: string, context: any): any {
    // Simple expression evaluator (use a proper library in production)
    // This supports basic variable substitution and arithmetic

    // Replace variables like {{variable}}
    let evaluated = this.interpolateTemplate(expression, context);

    // Evaluate simple expressions
    try {
      // SECURITY WARNING: In production, use a safe expression evaluator
      // like expr-eval or mathjs, NOT eval()
      return Function(`"use strict"; return (${evaluated})`)();
    } catch (error) {
      console.error('Expression evaluation error:', error);
      return false;
    }
  }

  private interpolateTemplate(template: string, context: any): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = this.getNestedValue(context, path.trim());
      return value !== undefined ? value : match;
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

interface WorkflowResult {
  success: boolean;
  execution_path: string[];
  final_result: any;
  error?: string;
}
```

---

## 5. Multi-Agent Orchestration

### Coordination Strategies

**1. Sequential (Pipeline)**
```typescript
// Agents run one after another, passing outputs as inputs
async executeSequential(agents: Agent[], context: AgentContext) {
  let currentContext = context;

  for (const agent of agents) {
    const result = await llmService.executeAgent(agent, currentContext);

    // Add result to context for next agent
    currentContext = {
      ...currentContext,
      previous_decisions: [
        ...(currentContext.previous_decisions || []),
        {
          agent_id: agent.id,
          agent_name: agent.name,
          decision: result,
          timestamp: new Date()
        }
      ]
    };

    // If any agent says "hold", stop execution
    if (result.decision === 'hold') {
      break;
    }
  }

  return currentContext.previous_decisions;
}
```

**2. Parallel (Independent Analysis)**
```typescript
// All agents run simultaneously, then aggregate results
async executeParallel(agents: Agent[], context: AgentContext) {
  const results = await Promise.all(
    agents.map(agent => llmService.executeAgent(agent, context))
  );

  // Aggregate decisions (e.g., voting, averaging)
  return this.aggregateDecisions(results);
}

private aggregateDecisions(decisions: AgentDecision[]): AgentDecision {
  // Majority voting
  const votes = {
    buy: decisions.filter(d => d.decision === 'buy').length,
    sell: decisions.filter(d => d.decision === 'sell').length,
    hold: decisions.filter(d => d.decision === 'hold').length
  };

  const winner = Object.entries(votes).reduce((a, b) =>
    a[1] > b[1] ? a : b
  )[0] as 'buy' | 'sell' | 'hold';

  // Average confidence
  const avgConfidence = decisions.reduce((sum, d) =>
    sum + (d.confidence || 0), 0
  ) / decisions.length;

  // Combine reasoning
  const combinedReasoning = decisions.map((d, i) =>
    `Agent ${i + 1}: ${d.reasoning}`
  ).join('\n\n');

  return {
    decision: winner,
    reasoning: combinedReasoning,
    confidence: avgConfidence
  };
}
```

**3. Hierarchical (Supervisor)**
```typescript
// Worker agents propose, supervisor agent approves/rejects
async executeHierarchical(
  workers: Agent[],
  supervisor: Agent,
  context: AgentContext
) {
  // Step 1: Workers analyze and propose
  const proposals = await Promise.all(
    workers.map(agent => llmService.executeAgent(agent, context))
  );

  // Step 2: Supervisor reviews all proposals
  const supervisorContext = {
    ...context,
    proposals: proposals.map((p, i) => ({
      agent: workers[i].name,
      decision: p
    }))
  };

  const finalDecision = await llmService.executeAgent(
    supervisor,
    supervisorContext
  );

  return finalDecision;
}
```

**4. Consensus (Debate)**
```typescript
// Agents debate until consensus is reached
async executeConsensus(
  agents: Agent[],
  context: AgentContext,
  maxRounds: number = 3
) {
  let currentContext = context;
  let round = 0;

  while (round < maxRounds) {
    // All agents provide opinions
    const opinions = await Promise.all(
      agents.map(agent => llmService.executeAgent(agent, currentContext))
    );

    // Check for consensus (e.g., all agree on decision)
    if (this.hasConsensus(opinions)) {
      return opinions[0];
    }

    // Add all opinions to context for next round
    currentContext = {
      ...currentContext,
      debate_history: [
        ...(currentContext.debate_history || []),
        {
          round: round + 1,
          opinions: opinions
        }
      ]
    };

    round++;
  }

  // No consensus reached, use fallback (e.g., voting)
  return this.aggregateDecisions(
    await Promise.all(agents.map(a => llmService.executeAgent(a, currentContext)))
  );
}

private hasConsensus(opinions: AgentDecision[]): boolean {
  const firstDecision = opinions[0].decision;
  return opinions.every(op => op.decision === firstDecision);
}
```

### Portfolio Allocation Between Agents

```typescript
interface AgentAllocation {
  agent_id: string;
  allocation_percent: number;  // % of portfolio this agent can control
  max_position_value: number;
}

class MultiAgentPortfolioManager {
  async allocatePortfolio(
    userId: string,
    agents: Agent[]
  ): Promise<AgentAllocation[]> {
    const portfolio = await portfolioService.getPortfolio(userId);
    const totalValue = portfolio.total_value;

    // Equal allocation by default
    const allocationPercent = 100 / agents.length;

    return agents.map(agent => ({
      agent_id: agent.id,
      allocation_percent: allocationPercent,
      max_position_value: (totalValue * allocationPercent / 100)
    }));
  }

  async checkAllocationLimit(
    agentId: string,
    userId: string,
    proposedTradeValue: number
  ): Promise<boolean> {
    const allocations = await db.agent_allocations.findMany({ user_id: userId });
    const agentAllocation = allocations.find(a => a.agent_id === agentId);

    if (!agentAllocation) return false;

    // Calculate current value controlled by this agent
    const agentPositions = await db.positions.findMany({
      user_id: userId,
      agent_id: agentId
    });

    const currentValue = agentPositions.reduce((sum, pos) =>
      sum + (pos.quantity * pos.current_price), 0
    );

    // Check if proposed trade would exceed allocation
    return (currentValue + proposedTradeValue) <= agentAllocation.max_position_value;
  }
}
```

---

## 6. News & Sentiment Pipeline

### News Aggregation

```typescript
// services/news-aggregator.service.ts
import axios from 'axios';
import { EventEmitter } from 'events';

class NewsAggregatorService extends EventEmitter {
  private sources = [
    { name: 'polygon', url: 'https://api.polygon.io/v2/reference/news' },
    { name: 'finnhub', url: 'https://finnhub.io/api/v1/news' },
    { name: 'newsapi', url: 'https://newsapi.org/v2/everything' }
  ];

  async start(): Promise<void> {
    // Poll for news every 60 seconds
    setInterval(() => this.fetchNews(), 60000);
  }

  private async fetchNews(): Promise<void> {
    for (const source of this.sources) {
      try {
        const articles = await this.fetchFromSource(source);

        for (const article of articles) {
          // Enrich with sentiment analysis
          const enriched = await this.enrichArticle(article);

          // Emit event for triggers
          this.emit('article', enriched);

          // Cache in database
          await db.news_articles.create(enriched);
        }
      } catch (error) {
        console.error(`Failed to fetch from ${source.name}:`, error);
      }
    }
  }

  private async enrichArticle(article: any): Promise<NewsArticle> {
    // Extract symbols mentioned
    const symbols = await this.extractSymbols(article.title, article.summary);

    // Analyze sentiment using LLM
    const sentiment = await this.analyzeSentiment(article);

    // Calculate relevance score
    const relevance = this.calculateRelevance(article, symbols);

    return {
      id: article.id,
      title: article.title,
      summary: article.summary,
      url: article.url,
      source: article.source,
      published_at: new Date(article.published_utc),
      symbols: symbols,
      sentiment: sentiment.label,
      sentiment_score: sentiment.score,
      relevance_score: relevance,
      keywords: this.extractKeywords(article)
    };
  }

  private async analyzeSentiment(article: any): Promise<{ label: string; score: number }> {
    // Use LLM for sentiment analysis
    const prompt = `Analyze the sentiment of this financial news article:

Title: ${article.title}
Summary: ${article.summary}

Is the sentiment positive, negative, or neutral?
Respond with JSON: {"sentiment": "positive|negative|neutral", "confidence": 0.0-1.0}`;

    const response = await llmService.callClaude({
      settings: {
        llm_provider: 'anthropic',
        model: 'claude-3-haiku',  // Use Haiku for fast sentiment analysis
        temperature: 0.3,
        max_tokens: 100
      }
    } as Agent, prompt);

    const parsed = JSON.parse(response);

    return {
      label: parsed.sentiment,
      score: parsed.confidence
    };
  }

  private async extractSymbols(title: string, summary: string): Promise<string[]> {
    const text = `${title} ${summary}`.toUpperCase();

    // Simple regex to find ticker symbols (3-5 caps letters)
    const matches = text.match(/\b[A-Z]{1,5}\b/g) || [];

    // Verify against known symbols
    const validSymbols: string[] = [];
    for (const match of new Set(matches)) {
      const isValid = await polygonService.isValidSymbol(match);
      if (isValid) {
        validSymbols.push(match);
      }
    }

    return validSymbols;
  }

  private extractKeywords(article: any): string[] {
    // Simple keyword extraction (use NLP library in production)
    const text = `${article.title} ${article.summary}`.toLowerCase();

    const importantWords = [
      'earnings', 'profit', 'loss', 'revenue', 'guidance', 'acquisition',
      'merger', 'lawsuit', 'regulation', 'product', 'launch', 'ceo',
      'partnership', 'contract', 'growth', 'decline', 'beat', 'miss'
    ];

    return importantWords.filter(word => text.includes(word));
  }

  private calculateRelevance(article: any, symbols: string[]): number {
    let score = 0;

    // More symbols = more relevant
    score += symbols.length * 0.2;

    // Keywords in title = more relevant
    if (article.title) score += 0.3;

    // Recent = more relevant
    const hoursSincePublished =
      (Date.now() - new Date(article.published_utc).getTime()) / (1000 * 60 * 60);
    if (hoursSincePublished < 1) score += 0.5;
    else if (hoursSincePublished < 24) score += 0.3;

    return Math.min(score, 1.0);
  }
}

interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  published_at: Date;
  symbols: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  sentiment_score: number;
  relevance_score: number;
  keywords: string[];
}
```

---

## 7. Safety & Risk Management

### Decision Validation Layer

```typescript
// services/safety-validator.service.ts
class SafetyValidator {
  async validateAgentDecision(
    decision: AgentDecision,
    agent: Agent,
    context: AgentContext
  ): Promise<ValidationResult> {
    const checks: Check[] = [];

    // 1. Portfolio risk checks
    checks.push(await this.checkPortfolioRisk(decision, agent, context));

    // 2. Market conditions check
    checks.push(await this.checkMarketConditions(decision));

    // 3. Agent performance check
    checks.push(await this.checkAgentPerformance(agent));

    // 4. Correlation check (don't over-concentrate)
    checks.push(await this.checkCorrelation(decision, context));

    // 5. Volatility check
    checks.push(await this.checkVolatility(decision));

    // 6. Liquidity check
    checks.push(await this.checkLiquidity(decision));

    const failed = checks.filter(c => !c.passed);

    return {
      approved: failed.length === 0,
      checks: checks,
      reasons: failed.map(c => c.reason)
    };
  }

  private async checkPortfolioRisk(
    decision: AgentDecision,
    agent: Agent,
    context: AgentContext
  ): Promise<Check> {
    if (decision.decision === 'hold') {
      return { name: 'portfolio_risk', passed: true };
    }

    const currentPrice = context.current_prices[decision.symbol!]?.price;
    const positionValue = decision.quantity! * currentPrice;

    // Check max position size
    if (positionValue > agent.risk_limits.max_position_size) {
      return {
        name: 'portfolio_risk',
        passed: false,
        reason: `Position size $${positionValue} exceeds limit $${agent.risk_limits.max_position_size}`
      };
    }

    // Check portfolio allocation
    const allocationPercent = (positionValue / context.portfolio.total_value) * 100;
    if (allocationPercent > agent.risk_limits.max_portfolio_allocation) {
      return {
        name: 'portfolio_risk',
        passed: false,
        reason: `Allocation ${allocationPercent.toFixed(1)}% exceeds limit ${agent.risk_limits.max_portfolio_allocation}%`
      };
    }

    return { name: 'portfolio_risk', passed: true };
  }

  private async checkMarketConditions(decision: AgentDecision): Promise<Check> {
    // Don't trade during extreme volatility
    const vixLevel = await marketDataService.getVIX();
    if (vixLevel > 40) {
      return {
        name: 'market_conditions',
        passed: false,
        reason: `High market volatility (VIX: ${vixLevel}), trading paused`
      };
    }

    // Check if market is open
    const isMarketOpen = await marketDataService.isMarketOpen();
    if (!isMarketOpen && decision.decision !== 'hold') {
      return {
        name: 'market_conditions',
        passed: false,
        reason: 'Market is closed'
      };
    }

    return { name: 'market_conditions', passed: true };
  }

  private async checkAgentPerformance(agent: Agent): Promise<Check> {
    // Pause agent if recent performance is very poor
    const recentTrades = await db.trades.findMany({
      agent_id: agent.id,
      executed_at: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    });

    if (recentTrades.length < 10) {
      return { name: 'agent_performance', passed: true };  // Not enough data
    }

    const totalPnL = recentTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const avgPnL = totalPnL / recentTrades.length;

    // If agent is losing more than $100 per trade on average, pause
    if (avgPnL < -100) {
      return {
        name: 'agent_performance',
        passed: false,
        reason: `Agent performance is poor (avg loss: $${Math.abs(avgPnL).toFixed(2)} per trade)`
      };
    }

    return { name: 'agent_performance', passed: true };
  }

  private async checkCorrelation(
    decision: AgentDecision,
    context: AgentContext
  ): Promise<Check> {
    if (decision.decision !== 'buy') {
      return { name: 'correlation', passed: true };
    }

    // Don't buy if we already have too many correlated positions
    const currentPositions = context.portfolio.positions.map(p => p.symbol);

    // Check sector exposure
    const newSymbolSector = await this.getSymbolSector(decision.symbol!);
    const sectorPositions = await Promise.all(
      currentPositions.map(async symbol => ({
        symbol,
        sector: await this.getSymbolSector(symbol)
      }))
    );

    const sameSecTorCount = sectorPositions.filter(
      p => p.sector === newSymbolSector
    ).length;

    // Don't exceed 40% in one sector
    const sectorAllocation = (sameSecTorCount + 1) / (currentPositions.length + 1);
    if (sectorAllocation > 0.4) {
      return {
        name: 'correlation',
        passed: false,
        reason: `Too much exposure to ${newSymbolSector} sector (${(sectorAllocation * 100).toFixed(0)}%)`
      };
    }

    return { name: 'correlation', passed: true };
  }

  private async getSymbolSector(symbol: string): Promise<string> {
    const details = await polygonService.getTickerDetails(symbol);
    return details.sic_description || 'Unknown';
  }

  private async checkVolatility(decision: AgentDecision): Promise<Check> {
    if (decision.decision === 'hold') {
      return { name: 'volatility', passed: true };
    }

    // Calculate recent volatility (standard deviation of returns)
    const historicalData = await polygonService.getAggregates(
      decision.symbol!,
      // Last 30 days
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      new Date().toISOString().split('T')[0],
      '1/day'
    );

    const returns = [];
    for (let i = 1; i < historicalData.length; i++) {
      const dayReturn = (historicalData[i].c - historicalData[i - 1].c) / historicalData[i - 1].c;
      returns.push(dayReturn);
    }

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const annualizedVolatility = stdDev * Math.sqrt(252); // Trading days per year

    // Don't trade stocks with > 60% annualized volatility
    if (annualizedVolatility > 0.6) {
      return {
        name: 'volatility',
        passed: false,
        reason: `Stock too volatile (${(annualizedVolatility * 100).toFixed(0)}% annualized)`
      };
    }

    return { name: 'volatility', passed: true };
  }

  private async checkLiquidity(decision: AgentDecision): Promise<Check> {
    if (decision.decision === 'hold') {
      return { name: 'liquidity', passed: true };
    }

    // Check average volume
    const historicalData = await polygonService.getAggregates(
      decision.symbol!,
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      new Date().toISOString().split('T')[0],
      '1/day'
    );

    const avgVolume = historicalData.reduce((sum, d) => sum + d.v, 0) / historicalData.length;

    // Require at least 500k shares average daily volume
    if (avgVolume < 500000) {
      return {
        name: 'liquidity',
        passed: false,
        reason: `Low liquidity (avg volume: ${(avgVolume / 1000).toFixed(0)}k shares)`
      };
    }

    return { name: 'liquidity', passed: true };
  }
}

interface Check {
  name: string;
  passed: boolean;
  reason?: string;
}

interface ValidationResult {
  approved: boolean;
  checks: Check[];
  reasons: string[];
}
```

### Emergency Controls

```typescript
// Emergency stop mechanism
class EmergencyController {
  async pauseAllAgents(userId: string, reason: string): Promise<void> {
    await db.agents.updateMany(
      { user_id: userId },
      { status: 'paused' }
    );

    await notificationService.send(userId, {
      type: 'emergency',
      title: 'All agents paused',
      message: reason
    });

    await db.audit_log.create({
      user_id: userId,
      action: 'emergency_pause',
      reason: reason,
      timestamp: new Date()
    });
  }

  async cancelAllPendingOrders(userId: string): Promise<void> {
    const pendingOrders = await db.orders.findMany({
      user_id: userId,
      status: 'pending'
    });

    for (const order of pendingOrders) {
      await brokerService.cancelOrder(order.broker_order_id);
      await db.orders.update(order.id, { status: 'cancelled' });
    }
  }

  async liquidateAllPositions(userId: string): Promise<void> {
    const positions = await db.positions.findMany({ user_id: userId });

    for (const position of positions) {
      await tradingEngine.submitOrder(userId, {
        symbol: position.symbol,
        quantity: position.quantity,
        side: 'sell',
        type: 'market'
      });
    }
  }
}
```

---

## 8. Database Schema Extensions

```sql
-- Agents table
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  config_type VARCHAR(20) NOT NULL, -- 'prompt' or 'workflow'
  system_prompt TEXT,
  user_prompt_template TEXT,
  workflow_definition JSONB,
  settings JSONB NOT NULL,
  risk_limits JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  stats JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Triggers table
CREATE TABLE triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  type VARCHAR(20) NOT NULL,
  schedule JSONB,
  price_condition JSONB,
  volume_condition JSONB,
  indicator_condition JSONB,
  news_condition JSONB,
  webhook_config JSONB,
  throttle JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  last_triggered_at TIMESTAMP
);

-- Agent-Trigger mapping (many-to-many)
CREATE TABLE agent_triggers (
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  trigger_id UUID REFERENCES triggers(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, trigger_id)
);

-- Agent executions (audit trail)
CREATE TABLE agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id),
  trigger_id UUID REFERENCES triggers(id),
  trigger_type VARCHAR(50),
  context JSONB,
  decision JSONB,
  llm_response TEXT,
  validation_result JSONB,
  execution_time_ms INTEGER,
  status VARCHAR(20), -- 'success', 'failed', 'rejected'
  error_message TEXT,
  executed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agent_executions_agent_id ON agent_executions(agent_id);
CREATE INDEX idx_agent_executions_executed_at ON agent_executions(executed_at DESC);

-- Multi-agent setups
CREATE TABLE multi_agent_setups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  coordination_type VARCHAR(50), -- 'sequential', 'parallel', 'hierarchical', 'consensus'
  agent_config JSONB NOT NULL, -- Array of agent IDs and their roles
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Agent allocations (portfolio split)
CREATE TABLE agent_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  agent_id UUID REFERENCES agents(id),
  allocation_percent DECIMAL(5, 2),
  max_position_value DECIMAL(15, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, agent_id)
);

-- News articles cache
CREATE TABLE news_articles (
  id VARCHAR(255) PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT,
  source VARCHAR(100),
  published_at TIMESTAMP,
  symbols TEXT[], -- Array of ticker symbols
  sentiment VARCHAR(20),
  sentiment_score DECIMAL(3, 2),
  relevance_score DECIMAL(3, 2),
  keywords TEXT[],
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_news_articles_published_at ON news_articles(published_at DESC);
CREATE INDEX idx_news_articles_symbols ON news_articles USING GIN(symbols);

-- Workflow definitions (if stored separately)
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id),
  name VARCHAR(255),
  definition JSONB NOT NULL,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add agent_id to orders and trades for tracking
ALTER TABLE orders ADD COLUMN agent_id UUID REFERENCES agents(id);
ALTER TABLE trades ADD COLUMN agent_id UUID REFERENCES agents(id);
ALTER TABLE positions ADD COLUMN agent_id UUID REFERENCES agents(id);

CREATE INDEX idx_orders_agent_id ON orders(agent_id);
CREATE INDEX idx_trades_agent_id ON trades(agent_id);
```

---

## 9. Implementation Strategy

### How This Layers on Existing Architecture

The AI agent platform extends the base trading platform (from `PLAN.md`):

```
EXISTING LAYER (from PLAN.md)
├── Trading Engine
├── Order Execution
├── Portfolio Management
└── Market Data Pipeline

NEW AI AGENT LAYER (this document)
├── Agent Management
├── Trigger System
├── LLM Integration
├── Workflow Engine
└── Multi-Agent Orchestration
     │
     └──> Calls existing Trading Engine
```

### Integration Points

1. **Agent decisions → Trading Engine**
   ```typescript
   // agents/agent-executor.ts
   const decision = await llmService.executeAgent(agent, context);

   if (decision.decision !== 'hold') {
     // Use existing trading engine from PLAN.md
     await tradingEngine.submitOrder(userId, {
       symbol: decision.symbol,
       quantity: decision.quantity,
       side: decision.decision,
       type: decision.order_type
     });
   }
   ```

2. **Market Data → Agent Context**
   ```typescript
   // The existing WebSocket server feeds data to agents
   polygonWS.on('quote', (quote) => {
     // Update agent context
     agentContextBuilder.updatePrice(quote.symbol, quote.price);

     // Also check if this triggers any agents
     triggerManager.checkPriceTriggers(quote);
   });
   ```

3. **News Service → Triggers**
   ```typescript
   newsAggregator.on('article', (article) => {
     // Check if this triggers any news-based agents
     triggerManager.checkNewsTriggers(article);
   });
   ```

### Phased Implementation

**Phase 1: Basic Agent System (2-3 weeks)**
- [ ] Agent database schema
- [ ] Agent CRUD API
- [ ] Simple prompt-based agent execution
- [ ] LLM integration (Claude/GPT)
- [ ] Decision parsing and validation
- [ ] Manual trigger (user clicks "Run Agent")

**Phase 2: Trigger System (2 weeks)**
- [ ] Time-based triggers (cron)
- [ ] Price-based triggers
- [ ] Volume-based triggers
- [ ] Trigger manager service
- [ ] Webhook endpoints

**Phase 3: Multi-Agent Support (2 weeks)**
- [ ] Multi-agent coordination patterns
- [ ] Portfolio allocation
- [ ] Sequential execution
- [ ] Parallel execution with voting

**Phase 4: Visual Workflow Builder (3-4 weeks)**
- [ ] Workflow data model
- [ ] DAG execution engine
- [ ] Frontend: Visual editor UI
- [ ] Node types (condition, action, LLM, data fetch)
- [ ] Workflow testing interface

**Phase 5: News & Advanced Triggers (2 weeks)**
- [ ] News aggregation service
- [ ] Sentiment analysis
- [ ] News-based triggers
- [ ] Technical indicator triggers
- [ ] Custom indicator support

**Phase 6: Safety & Monitoring (2 weeks)**
- [ ] Advanced validation rules
- [ ] Emergency controls
- [ ] Agent performance tracking
- [ ] Alerting system
- [ ] Audit logging dashboard

**Phase 7: Frontend & UX (3 weeks)**
- [ ] Agent configuration UI
- [ ] Trigger setup interface
- [ ] Agent performance dashboard
- [ ] Execution history viewer
- [ ] Visual workflow builder UI

**Total: ~16-18 weeks**

---

## 10. Example Use Cases

### Use Case 1: "Dip Buyer Agent"

**Strategy:** Buy quality stocks when they dip unexpectedly on no bad news

**Configuration:**
```json
{
  "name": "Dip Buyer",
  "config_type": "prompt",
  "user_prompt_template": "You are a dip-buying agent. Look for stocks that have dropped 3%+ today but have:\n- Strong fundamentals\n- No negative news\n- RSI below 35\n- Above-average volume\n\nIf you find a good opportunity, buy up to 5% of portfolio value.",
  "triggers": [
    {
      "type": "price",
      "price_condition": {
        "symbols": ["AAPL", "MSFT", "GOOGL", "AMZN", "META"],
        "condition": "change_percent",
        "threshold": -3.0,
        "timeframe": "1d"
      }
    }
  ],
  "risk_limits": {
    "max_position_size": 10000,
    "max_portfolio_allocation": 5,
    "max_daily_trades": 2
  }
}
```

### Use Case 2: "Earnings Play Multi-Agent"

**Strategy:** Multiple agents analyze earnings, one proposes, supervisor approves

**Setup:**
```json
{
  "type": "multi_agent",
  "name": "Earnings Play",
  "coordination": "hierarchical",
  "agents": [
    {
      "id": "earnings-analyzer",
      "role": "analyst",
      "prompt": "Analyze upcoming earnings reports. Look for companies likely to beat estimates based on recent trends, guidance, and sector performance."
    },
    {
      "id": "risk-assessor",
      "role": "validator",
      "prompt": "Review the proposed earnings play. Consider: IV levels (don't overpay for options), historical earnings volatility, position size appropriateness."
    },
    {
      "id": "supervisor",
      "role": "approver",
      "prompt": "Review both analyses. Approve only if: 1) Strong beat likelihood (>70% confidence), 2) Reasonable risk, 3) Good risk/reward ratio. Final decision: approve or reject."
    }
  ],
  "triggers": [
    {
      "type": "time",
      "schedule": {
        "cron": "0 16 * * 1-5", // 4 PM weekdays (after market close)
        "timezone": "America/New_York"
      }
    }
  ]
}
```

### Use Case 3: "News Reaction Workflow"

**Strategy:** Visual workflow that reacts to breaking news

**Workflow:**
```
[Start]
  → [News Detected]
  → [Check Sentiment]
      ├─ Positive → [Check if we own stock]
      │                ├─ Yes → [Hold]
      │                └─ No → [LLM: Should we buy?]
      │                           ├─ Yes → [Place Buy Order]
      │                           └─ No → [End]
      └─ Negative → [Check if we own stock]
                       ├─ Yes → [LLM: Should we sell?]
                       │           ├─ Yes → [Place Sell Order]
                       │           └─ No → [End]
                       └─ No → [End]
```

### Use Case 4: "Momentum Rider with Stop Loss"

**Strategy:** Agent that rides momentum but has strict stop losses

**Configuration:**
```json
{
  "name": "Momentum Rider",
  "config_type": "prompt",
  "user_prompt_template": "You ride momentum. Buy stocks with:\n- Price above 20 MA and 50 MA\n- Strong relative strength (outperforming SPY by 5%+)\n- Increasing volume\n- Positive news sentiment\n\nAlways set stop loss at -7% from entry.\n\nSell when:\n- Stop loss hit\n- Momentum weakens (RSI drops below 50)\n- Negative news",
  "triggers": [
    {
      "type": "time",
      "schedule": {
        "cron": "*/15 9-16 * * 1-5", // Every 15 min during market hours
        "timezone": "America/New_York"
      }
    },
    {
      "type": "price",
      "price_condition": {
        "condition": "stop_loss_check",
        "threshold": -7.0
      }
    }
  ],
  "risk_limits": {
    "max_position_size": 15000,
    "max_portfolio_allocation": 10,
    "max_daily_trades": 5
  }
}
```

---

## 11. Frontend UI Components

### Agent Builder Interface

```typescript
// components/AgentBuilder.tsx
interface AgentBuilderProps {
  onSave: (agent: Agent) => void;
}

export function AgentBuilder({ onSave }: AgentBuilderProps) {
  return (
    <div className="agent-builder">
      <h2>Create AI Trading Agent</h2>

      {/* Agent Name & Description */}
      <section>
        <input placeholder="Agent Name" />
        <textarea placeholder="Description" />
      </section>

      {/* Configuration Type Selector */}
      <section>
        <label>Configuration Type</label>
        <select>
          <option value="prompt">Natural Language Prompt</option>
          <option value="workflow">Visual Workflow</option>
        </select>
      </section>

      {/* Prompt Editor (if prompt type) */}
      <section>
        <label>Trading Strategy</label>
        <textarea
          className="strategy-prompt"
          placeholder="Describe your trading strategy in plain English..."
          rows={10}
        />
        <p className="help-text">
          Example: "Buy stocks when RSI drops below 30 and price is above 200-day MA. Sell when RSI reaches 70 or price drops 5% from entry."
        </p>
      </section>

      {/* LLM Settings */}
      <section>
        <label>AI Model</label>
        <select>
          <option value="claude-3-opus">Claude 3 Opus (Most Capable)</option>
          <option value="claude-3-sonnet">Claude 3 Sonnet (Balanced)</option>
          <option value="gpt-4">GPT-4</option>
        </select>

        <label>Temperature: <span>{temperature}</span></label>
        <input type="range" min="0" max="1" step="0.1" />
      </section>

      {/* Risk Limits */}
      <section>
        <h3>Risk Limits</h3>
        <div className="risk-limits">
          <div>
            <label>Max Position Size</label>
            <input type="number" placeholder="$10,000" />
          </div>
          <div>
            <label>Max Portfolio Allocation (%)</label>
            <input type="number" placeholder="5" />
          </div>
          <div>
            <label>Max Daily Trades</label>
            <input type="number" placeholder="3" />
          </div>
        </div>
      </section>

      {/* Symbol Filters */}
      <section>
        <h3>Symbol Filters (Optional)</h3>
        <label>Only trade these symbols:</label>
        <input placeholder="AAPL, MSFT, GOOGL (comma separated)" />

        <label>Never trade these symbols:</label>
        <input placeholder="GME, AMC (comma separated)" />
      </section>

      {/* Triggers */}
      <section>
        <h3>Triggers</h3>
        <button onClick={() => setShowTriggerModal(true)}>
          + Add Trigger
        </button>

        <div className="triggers-list">
          {triggers.map(trigger => (
            <TriggerCard key={trigger.id} trigger={trigger} />
          ))}
        </div>
      </section>

      <div className="actions">
        <button onClick={handleTest}>Test Agent</button>
        <button onClick={handleSave}>Save & Activate</button>
      </div>
    </div>
  );
}
```

### Workflow Builder Interface (Simplified)

```typescript
// components/WorkflowBuilder.tsx
import ReactFlow, { Node, Edge } from 'reactflow';

export function WorkflowBuilder() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const nodeTypes = {
    start: StartNode,
    condition: ConditionNode,
    llm_agent: LLMNode,
    action: ActionNode,
    data_fetch: DataFetchNode,
    end: EndNode
  };

  return (
    <div className="workflow-builder">
      {/* Toolbar */}
      <div className="toolbar">
        <h3>Add Nodes:</h3>
        <button onClick={() => addNode('condition')}>Condition</button>
        <button onClick={() => addNode('llm_agent')}>LLM Agent</button>
        <button onClick={() => addNode('action')}>Action</button>
        <button onClick={() => addNode('data_fetch')}>Data Fetch</button>
      </div>

      {/* Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
      />

      {/* Node Inspector (when node selected) */}
      {selectedNode && (
        <NodeInspector node={selectedNode} onChange={updateNode} />
      )}
    </div>
  );
}
```

### Agent Dashboard

```typescript
// components/AgentDashboard.tsx
export function AgentDashboard() {
  const agents = useAgents();

  return (
    <div className="agent-dashboard">
      <header>
        <h1>AI Trading Agents</h1>
        <button>+ Create Agent</button>
      </header>

      <div className="agents-grid">
        {agents.map(agent => (
          <AgentCard key={agent.id} agent={agent}>
            <div className="agent-status">
              <span className={`badge ${agent.status}`}>
                {agent.status}
              </span>

              {agent.status === 'active' && (
                <button onClick={() => pauseAgent(agent.id)}>
                  Pause
                </button>
              )}
            </div>

            <div className="agent-stats">
              <div className="stat">
                <label>Win Rate</label>
                <value>{agent.stats.win_rate}%</value>
              </div>
              <div className="stat">
                <label>Total P&L</label>
                <value className={agent.stats.total_pnl > 0 ? 'positive' : 'negative'}>
                  ${agent.stats.total_pnl.toFixed(2)}
                </value>
              </div>
              <div className="stat">
                <label>Executions</label>
                <value>{agent.stats.total_executions}</value>
              </div>
            </div>

            <div className="agent-triggers">
              <label>Triggers ({agent.triggers.length})</label>
              {agent.triggers.slice(0, 2).map(t => (
                <span className="trigger-badge">{t.name}</span>
              ))}
            </div>

            <div className="actions">
              <button onClick={() => viewAgent(agent.id)}>View</button>
              <button onClick={() => editAgent(agent.id)}>Edit</button>
              <button onClick={() => testAgent(agent.id)}>Test</button>
            </div>
          </AgentCard>
        ))}
      </div>

      {/* Execution History */}
      <section className="execution-history">
        <h2>Recent Executions</h2>
        <ExecutionLog />
      </section>
    </div>
  );
}
```

---

## 12. API Endpoints

### Agent Management
```
POST   /api/agents              Create agent
GET    /api/agents              List user's agents
GET    /api/agents/:id          Get agent details
PUT    /api/agents/:id          Update agent
DELETE /api/agents/:id          Delete agent
POST   /api/agents/:id/activate Activate agent
POST   /api/agents/:id/pause    Pause agent
POST   /api/agents/:id/test     Test agent execution
```

### Triggers
```
POST   /api/triggers            Create trigger
GET    /api/triggers            List triggers
PUT    /api/triggers/:id        Update trigger
DELETE /api/triggers/:id        Delete trigger
POST   /api/triggers/:id/test   Test trigger
POST   /api/webhooks/:secret    Webhook trigger endpoint
```

### Multi-Agent
```
POST   /api/multi-agent-setups  Create multi-agent setup
GET    /api/multi-agent-setups  List setups
POST   /api/multi-agent-setups/:id/execute  Execute multi-agent
```

### Agent Executions
```
GET    /api/executions          List executions (with filters)
GET    /api/executions/:id      Get execution details
GET    /api/agents/:id/performance  Get agent performance metrics
```

### Workflows
```
POST   /api/workflows           Create/save workflow
GET    /api/workflows/:id       Get workflow
PUT    /api/workflows/:id       Update workflow
POST   /api/workflows/:id/test  Test workflow execution
```

---

## Summary

This AI agent trading platform architecture provides:

✅ **LLM-Powered Decision Making** - Agents use Claude/GPT to analyze markets and make trading decisions

✅ **Flexible Configuration** - Natural language prompts + visual workflow builder

✅ **Comprehensive Triggers** - Time-based, price/volume, news/sentiment, webhooks

✅ **Multi-Agent Coordination** - Sequential, parallel, hierarchical, consensus patterns

✅ **Safety & Risk Management** - Validation layers, position limits, emergency controls

✅ **Full Integration** - Extends existing trading platform seamlessly

✅ **Scalable Architecture** - Modular design, queue-based execution, monitoring

The system enables users to create sophisticated AI trading strategies without writing code, while maintaining safety controls and integration with real broker APIs for live trading.

**Next Steps:**
1. Review and approve this architecture
2. Decide on implementation priorities
3. Set up development environment
4. Begin Phase 1 implementation

Ready to start building! 🚀
