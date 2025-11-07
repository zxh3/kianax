# Kianax - AI Trading Platform Architecture

## Overview

Kianax is a **multi-tenant AI-powered trading platform** where users can create, configure, and deploy autonomous trading agents. Each user builds their own agent workflows using natural language prompts or visual drag-and-drop interfaces.

### Core Vision

**"Democratize algorithmic trading through AI agents"**

- Regular users describe trading strategies in plain English
- AI agents execute strategies autonomously 24/7
- Each user has complete control and isolation
- Real money trading with broker integration
- Visual workflow builder for advanced users

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      PUBLIC USERS                            │
│  - Create accounts                                           │
│  - Connect broker accounts (Alpaca, IBKR)                   │
│  - Build AI agents (prompts or workflows)                   │
│  - Monitor portfolios and performance                        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ HTTPS/WSS (authenticated)
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                   WEB APPLICATION                            │
│  Next.js + React + Tailwind                                  │
│  - Authentication UI (login/register)                       │
│  - Agent Builder (natural language)                         │
│  - Workflow Designer (visual DAG editor)                    │
│  - Portfolio Dashboard                                       │
│  - Trading Terminal                                          │
│  - Real-time charts and data                                │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  │ REST API + WebSocket
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                  BACKEND SERVER                              │
│  Fastify + TypeScript + Bun                                  │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │          AUTHENTICATION & AUTHORIZATION             │    │
│  │  - JWT tokens with user_id                         │    │
│  │  - Row-level security (all data has user_id)      │    │
│  │  - API key management per user                     │    │
│  │  - Session management                              │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │            AI AGENT PLATFORM                        │    │
│  │                                                     │    │
│  │  Per-User Agent Management:                        │    │
│  │  - Each user creates multiple agents               │    │
│  │  - Each agent has own configuration                │    │
│  │  - Agents isolated by user_id                      │    │
│  │  - Portfolio allocation per agent                  │    │
│  │                                                     │    │
│  │  Agent Types:                                      │    │
│  │  1. Prompt-Based (natural language)               │    │
│  │  2. Workflow-Based (visual DAG)                   │    │
│  │  3. Multi-Agent (coordinated)                     │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │            TRIGGER SYSTEM                           │    │
│  │  - Time-based (schedule agent runs)                │    │
│  │  - Price-based (react to market moves)             │    │
│  │  - News-based (trade on news events)               │    │
│  │  - Webhook-based (custom events)                   │    │
│  │  ⚠️  All triggers scoped to user                   │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         TRADING ENGINE                              │    │
│  │  - Order validation (per-user balance)             │    │
│  │  - Risk management (per-user limits)               │    │
│  │  - Position tracking (per-user portfolio)          │    │
│  │  - P&L calculation                                  │    │
│  │  ⚠️  All trading logic server-side only           │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         BROKER INTEGRATION                          │    │
│  │  - Per-user broker accounts                        │    │
│  │  - Encrypted API key storage                       │    │
│  │  - Order execution                                  │    │
│  │  - Real-time position sync                         │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         MARKET DATA SERVICE                         │    │
│  │  - Polygon.io integration                          │    │
│  │  - Real-time quotes via WebSocket                  │    │
│  │  - Historical data                                  │    │
│  │  - News aggregation & sentiment                    │    │
│  │  - Shared across all users (cached)                │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                   DATA LAYER                                 │
│                                                              │
│  PostgreSQL (Multi-tenant data):                            │
│  - users, sessions                                          │
│  - agents (user_id), triggers (user_id)                    │
│  - portfolios (user_id), positions (user_id)               │
│  - orders (user_id), trades (user_id)                      │
│  - agent_executions (user_id, agent_id)                    │
│                                                              │
│  Redis (Caching & Sessions):                                │
│  - Market data cache (shared)                               │
│  - User sessions                                             │
│  - Rate limiting (per user)                                 │
│  - Real-time pub/sub                                        │
│                                                              │
│  TimescaleDB (Time-series):                                 │
│  - Market data history (shared)                             │
│  - Performance metrics (per user)                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### 1. Multi-Tenancy

**Every resource is scoped to a user:**

- ✅ Each user has their own account and authentication
- ✅ Each user connects their own broker account
- ✅ Each user creates their own agents
- ✅ Each user's portfolio is completely isolated
- ✅ Agent executions never cross user boundaries
- ✅ Data is filtered by `user_id` in all queries

**Resource Isolation:**
```
User A:
  ├── Agent "Dip Buyer" → Trades User A's account
  ├── Agent "Momentum" → Trades User A's account
  └── Portfolio → User A's positions only

User B:
  ├── Agent "News Trader" → Trades User B's account
  └── Portfolio → User B's positions only

⚠️ User A cannot see or affect User B's data
```

### 2. User Journey

**New User Flow:**

1. **Sign Up** → Create account with email/password
2. **Connect Broker** → Add Alpaca API keys (encrypted storage)
3. **Create Agent** → Describe strategy in natural language OR build workflow
4. **Set Triggers** → When should the agent run?
5. **Monitor** → Watch agent execute trades automatically
6. **Manage** → Pause, edit, delete agents anytime

### 3. AI Agents (User-Created)

**What is an Agent?**

An agent is a user-configurable autonomous trader that:
- Analyzes market data
- Makes trading decisions
- Executes orders automatically
- Operates within user-defined risk limits

**Two Ways to Create Agents:**

**A. Natural Language Prompt (Simple)**
```
User writes in plain English:
"Buy AAPL when RSI < 30 and price drops 3%+ in a day.
Sell when RSI > 70 or profit reaches 5%.
Max position size: $5,000"

→ AI agent interprets and executes this strategy
```

**B. Visual Workflow (Advanced)**
```
User drags and drops nodes:
[Start] → [Check RSI < 30?] → [Check Price Drop?]
→ [AI Analysis] → [Place Order] → [End]

→ Agent follows this exact flow
```

**Agent Configuration:**

Each agent has:
- **Name & Description**: "Dip Buyer - Buys quality stocks on dips"
- **Strategy**: Natural language prompt OR workflow definition
- **Risk Limits**: Max position size, daily trade limit, allocation %
- **LLM Settings**: Model choice (GPT-4, Claude), temperature
- **Triggers**: When to run (schedule, price alerts, news, webhooks)
- **Status**: Active or Paused

### 4. Triggers (Event System)

**What triggers an agent?**

Users configure when their agents should wake up and analyze markets:

1. **Time-Based**: "Run every weekday at 9:30 AM"
2. **Price-Based**: "Run when AAPL drops 3%"
3. **Volume-Based**: "Run when volume spikes 2x average"
4. **News-Based**: "Run when news mentions 'earnings beat'"
5. **Webhook-Based**: "Run when I send a custom signal"

**Example:**
```
User creates "Dip Buyer" agent with trigger:
"Run when any of [AAPL, MSFT, GOOGL] drops 3%+ in a day"

Market Event:
→ AAPL drops 4% at 10:30 AM

Platform:
→ Triggers "Dip Buyer" agent
→ Agent analyzes AAPL
→ Agent decides: "Buy 10 shares"
→ Platform validates and executes
→ User sees notification
```

### 5. Multi-Agent Workflows

**Why multiple agents?**

Users can create specialized agents that work together:

**Example: "Investment Team"**

```
User creates 3 agents:

1. "Analyst" Agent
   - Scans market for opportunities
   - Outputs: List of potential trades

2. "Risk Manager" Agent
   - Reviews Analyst's suggestions
   - Checks portfolio exposure
   - Outputs: Approved trades

3. "Executor" Agent
   - Takes approved trades
   - Determines position sizing
   - Executes orders

Coordination: Sequential (1 → 2 → 3)
```

**Coordination Patterns:**
- **Sequential**: Agents run one after another (pipeline)
- **Parallel**: Agents analyze simultaneously, then vote
- **Hierarchical**: Worker agents propose, supervisor approves

### 6. Portfolio & Risk Management

**Per-User Portfolio Tracking:**

Each user has:
- Total portfolio value
- Cash balance
- Buying power
- Open positions with P&L
- Trade history
- Performance metrics

**Risk Controls (Per User):**
- Maximum position size per trade
- Maximum portfolio allocation per agent
- Daily trade limits
- Stop-loss rules
- Pattern day trading compliance

**Per-Agent Allocation:**
```
User with $50,000 portfolio:
  - Agent "Dip Buyer": 20% allocation ($10,000)
  - Agent "Momentum": 30% allocation ($15,000)
  - Cash reserve: 50% ($25,000)

Each agent only trades within its allocation.
```

---

## Key Architectural Principles

### 1. Security First

**Authentication:**
- JWT tokens for API access
- Refresh token rotation
- 2FA/MFA for sensitive operations

**Authorization:**
- All database queries filter by `user_id`
- No cross-user data access
- Broker API keys encrypted at rest

**Trading Security:**
- All trading logic on backend (never trust frontend)
- Order validation on every trade
- Balance checks before execution
- Audit logs for all trades

### 2. Real-Time Communication

**WebSocket Connections (Per User):**
- Real-time price updates
- Order fill notifications
- Portfolio value changes
- Agent execution updates

**Message Types:**
- `quote` - Stock price updates
- `order_filled` - Trade confirmation
- `portfolio_update` - Balance changes
- `agent_execution` - Agent ran and decided X

### 3. Scalability

**Horizontal Scaling:**
- Stateless backend servers
- Queue-based agent execution (Bull/BullMQ)
- Database connection pooling
- Redis for distributed caching

**Fair Scheduling:**
- Agent execution queue prevents one user from hogging resources
- Rate limiting per user
- Resource quotas (max agents, max triggers)

### 4. Broker Agnostic

**Supported Brokers:**
- Alpaca (primary, easy setup)
- Interactive Brokers (advanced users)
- TD Ameritrade (optional)

**Per-User Broker Accounts:**
- Each user connects their own broker
- Encrypted API key storage
- Order execution through user's broker
- Real-time sync with broker positions

### 5. Data Isolation

**User Data Separation:**

```sql
-- Every user-specific table has user_id
agents (id, user_id, name, config, ...)
portfolios (id, user_id, cash, value, ...)
orders (id, user_id, symbol, quantity, ...)
trades (id, user_id, symbol, price, ...)
```

**Shared Data:**
```sql
-- Market data is shared across all users
market_data (symbol, timestamp, price, volume, ...)
news_articles (id, title, summary, sentiment, ...)
```

**Query Pattern:**
```typescript
// Always filter by authenticated user
const agents = await db.agents.findMany({
  where: { user_id: req.user.id }
});
```

---

## System Flows

### Flow 1: User Creates an Agent

```
1. User navigates to "Create Agent" page
2. User writes strategy prompt:
   "Buy stocks with RSI < 30, sell at RSI > 70"
3. User sets risk limits:
   - Max position: $5,000
   - Max daily trades: 3
   - Allocation: 10% of portfolio
4. User configures trigger:
   - Type: Time-based
   - Schedule: Every weekday at 10:00 AM
5. User clicks "Activate"

Backend:
→ Validates user authentication
→ Creates agent record (user_id, config, risk_limits)
→ Creates trigger record (user_id, agent_id, schedule)
→ Starts cron job for this trigger

Result:
→ Agent is now active
→ Will run automatically at 10 AM weekdays
→ User sees agent in dashboard
```

### Flow 2: Agent Executes a Trade

```
Trigger fires:
→ 10:00 AM on Tuesday
→ Trigger manager identifies agent belongs to User A
→ Queues agent execution job with user_id

Agent Execution:
1. Load agent config (belongs to User A)
2. Build context:
   - Fetch User A's portfolio
   - Fetch current market data
   - Fetch technical indicators
   - Fetch recent news
3. Send to LLM (GPT-4/Claude):
   - System prompt + user's strategy
   - Current context
4. LLM responds:
   {
     "decision": "buy",
     "symbol": "AAPL",
     "quantity": 10,
     "reasoning": "RSI is 28, oversold condition"
   }
5. Validate decision:
   - Check User A's buying power
   - Check agent's risk limits
   - Check position size limits
6. If valid, submit order:
   - Create order record (user_id, agent_id, symbol)
   - Send to User A's broker via their API keys
   - Track broker order ID
7. Log execution:
   - Save to agent_executions table
   - Include decision, reasoning, outcome

Real-time Updates:
→ Push notification to User A via WebSocket
→ "Agent 'Dip Buyer' bought 10 shares of AAPL at $150.23"
→ Update portfolio display
```

### Flow 3: User Monitors Performance

```
User opens Dashboard:
→ Backend fetches all data filtered by user_id

Display:
- Portfolio Summary (User's total value, P&L)
- Active Agents (User's agents, status, performance)
- Recent Trades (User's trades from all agents)
- Open Positions (User's current holdings)
- Performance Chart (User's equity curve)

Real-time:
→ WebSocket streams live updates
→ Price changes → Portfolio value updates
→ Order fills → Trade list updates
→ Agent executions → Activity log updates
```

---

## Agent Creation - Two Approaches

### Approach 1: Natural Language Prompt

**User Experience:**
```
Simple text box with instructions:

"Describe your trading strategy in plain English.
Example: Buy AAPL when it drops 3% and RSI is below 30"

[Large textarea for strategy]

[Risk Limits Section]
Max position size: [$5,000]
Max daily trades: [3]
Portfolio allocation: [10%]

[Trigger Section]
When should this agent run?
○ Time-based (schedule)
○ Price-based (market moves)
○ News-based (headlines)

[Create Agent Button]
```

**How It Works:**
- User writes natural language strategy
- Platform stores prompt as-is
- When triggered, entire prompt sent to LLM
- LLM interprets and makes decision
- Platform validates and executes

**Best For:** Beginners, simple strategies

### Approach 2: Visual Workflow Builder

**User Experience:**
```
Drag-and-drop canvas (like n8n, Zapier):

Toolbox:
- Start/End nodes
- Condition nodes (if/else)
- Data fetch nodes (get price, get news)
- LLM nodes (AI analysis)
- Action nodes (buy, sell, notify)

User builds flow:
[Start] → [Fetch Price] → [Check: Price < MA50?]
    ├─ Yes → [AI: Should we buy?] → [Buy Order]
    └─ No → [End]

Each node has configuration panel.
```

**How It Works:**
- User builds directed graph (DAG)
- Platform stores workflow definition (JSON)
- When triggered, workflow engine executes nodes
- Conditional branching based on data
- LLM nodes for intelligent decisions

**Best For:** Advanced users, complex multi-step strategies

---

## Technical Stack Summary

### Frontend
- **Framework**: Next.js 16 with App Router
- **UI**: React 19 + Tailwind CSS v4
- **Components**: shadcn/ui (Radix UI primitives)
- **State**: Zustand
- **Charts**: TradingView Lightweight Charts or Recharts
- **WebSocket**: Native WebSocket API

### Backend
- **Runtime**: Bun (fast TypeScript runtime)
- **Framework**: Fastify (high-performance API)
- **Language**: TypeScript
- **Job Queue**: Bull or BullMQ
- **WebSocket**: ws or socket.io
- **Validation**: Zod
- **Logging**: Pino

### Database
- **Primary**: PostgreSQL 16
- **Time-series**: TimescaleDB (PostgreSQL extension)
- **Cache**: Redis 7
- **ORM**: Prisma

### External Services
- **Market Data**: Polygon.io (REST + WebSocket)
- **Broker**: Alpaca (primary), IBKR (optional)
- **LLM**: OpenAI (GPT-4), Anthropic (Claude)
- **News**: Polygon.io News API

### Infrastructure
- **Hosting**: Vercel (frontend), Railway/Fly.io (backend)
- **Monitoring**: Sentry (errors), Betterstack (uptime)
- **CI/CD**: GitHub Actions

---

## Pricing Model (Future Consideration)

### Free Tier
- 1 active agent
- 100 agent executions/month
- Basic market data
- Paper trading only

### Pro Tier ($19/mo)
- 5 active agents
- 1,000 executions/month
- Real-time market data
- Live trading enabled
- Email support

### Premium Tier ($49/mo)
- Unlimited agents
- Unlimited executions
- Multi-agent workflows
- News & sentiment data
- Priority support

---

## Security & Compliance

### Data Security
- All data encrypted at rest (database encryption)
- TLS 1.3 for data in transit
- Broker API keys encrypted with AES-256
- No storing of plaintext passwords (argon2)

### Trading Security
- All order validation server-side
- Balance checks before every trade
- Position size limits enforced
- Pattern day trading rules checked
- Audit log of all trades (immutable)

### User Privacy
- Each user sees only their own data
- No cross-user data sharing
- Anonymized analytics only
- GDPR compliant (data export, deletion)

### Compliance Considerations
- Not providing investment advice (users control strategies)
- Clear disclaimers about risks
- Age verification (18+)
- Terms of service for trading
- Broker handles actual trade execution (licensed)

---

## Monitoring & Observability

### Application Metrics
- User registration rate
- Active agents per user
- Agent execution success rate
- Order execution latency
- WebSocket connection count
- Database query performance
- Cache hit rates

### Business Metrics
- Daily/Monthly active users
- Agent creation rate
- Trade volume per user
- Most popular agent strategies
- User retention rate
- Revenue (if paid tiers)

### Alerting
- High error rate → Page on-call
- Database slow queries → Auto-scale
- Queue backlog → Add workers
- High memory usage → Investigate leak

---

## Future Enhancements

### Phase 2 Features
- **Agent Marketplace**: Users share/sell strategies
- **Backtesting**: Test agents on historical data
- **Social Trading**: Follow top-performing agents
- **Mobile Apps**: iOS/Android with push notifications
- **Advanced Charts**: Custom indicators, drawing tools

### Phase 3 Features
- **Options Trading**: Expand beyond stocks
- **Crypto Trading**: Bitcoin, Ethereum, etc.
- **Forex Trading**: Currency pairs
- **Agent Templates**: Pre-built strategies for beginners
- **AI Recommendations**: "Suggested agents for your portfolio"

### Technical Improvements
- **GraphQL**: More flexible API queries
- **Event Sourcing**: Complete audit trail
- **Machine Learning**: Predictive models
- **A/B Testing**: Test agent variations
- **White Label**: Platform for broker partners

---

## Success Metrics

### User Success
- ✅ Users can create an agent in < 5 minutes
- ✅ Agents execute trades without user intervention
- ✅ Clear visibility into why agent made decisions
- ✅ Users feel in control (can pause/modify anytime)

### Platform Success
- ✅ 99.9% uptime
- ✅ < 100ms API response time (p95)
- ✅ < 1 second order execution time
- ✅ Zero security incidents
- ✅ Positive user reviews

### Business Success
- ✅ Growing user base (target: 10K users in year 1)
- ✅ High user retention (> 60% after 3 months)
- ✅ Active engagement (users check daily)
- ✅ Positive word-of-mouth growth
- ✅ Path to profitability

---

**Last Updated:** 2025-01-06
