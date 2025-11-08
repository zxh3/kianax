# Kianax - AI Trading Platform Architecture

High-level system architecture and design principles for the Kianax multi-tenant AI trading platform.

## Overview

Kianax is a **multi-tenant AI-powered trading platform** where users create and deploy autonomous trading agents. Each user has complete data isolation with their own portfolio, agents, and trading history.

### Core Vision

**"Democratize algorithmic trading through AI agents"**

- Users describe trading strategies in plain English
- AI agents execute strategies autonomously 24/7
- Complete user control and data isolation
- Real money trading with broker integration
- Visual workflow builder for advanced strategies

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      PUBLIC USERS                            │
│  - Create accounts and connect broker accounts              │
│  - Build AI agents (prompts or workflows)                   │
│  - Monitor portfolios and performance                        │
└─────────────────┬───────────────────────────────────────────┘
                  │ HTTPS/WSS (authenticated)
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   WEB APPLICATION                            │
│  Next.js + React + Tailwind                                  │
│  - Authentication UI                                         │
│  - Agent Builder (natural language)                         │
│  - Workflow Designer (visual DAG editor)                    │
│  - Portfolio Dashboard                                       │
│  - Trading Terminal                                          │
│  - Real-time charts                                          │
└─────────────────┬───────────────────────────────────────────┘
                  │ REST API + WebSocket
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  BACKEND SERVER                              │
│  Fastify + TypeScript + Bun                                  │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │     AUTHENTICATION & AUTHORIZATION                  │    │
│  │  - JWT tokens with user_id                         │    │
│  │  - Row-level security (all data has user_id)      │    │
│  │  - Session management                              │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │          AI AGENT PLATFORM                          │    │
│  │  - Per-user agent management                       │    │
│  │  - Agent types: Prompt-based, Workflow, Multi-agent│    │
│  │  - Portfolio allocation per agent                  │    │
│  │  - Complete user isolation                         │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │          TRIGGER SYSTEM                             │    │
│  │  - Time-based, Price-based, News-based             │    │
│  │  - Webhook-based for custom events                 │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │          TRADING ENGINE                             │    │
│  │  - Order validation (per-user balance)             │    │
│  │  - Risk management (per-user limits)               │    │
│  │  - Position tracking and P&L                       │    │
│  │  - All trading logic server-side only              │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │          BROKER INTEGRATION                         │    │
│  │  - Per-user broker accounts                        │    │
│  │  - Encrypted API key storage                       │    │
│  │  - Order execution and position sync               │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │          MARKET DATA SERVICE                        │    │
│  │  - Real-time quotes via WebSocket                  │    │
│  │  - Historical data and news aggregation            │    │
│  │  - Shared across all users (cached)                │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────┬───────────────────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   DATA LAYER                                 │
│                                                              │
│  PostgreSQL (Multi-tenant):                                 │
│  - All tables scoped by user_id                             │
│  - agents, portfolios, orders, trades                       │
│  - agent_executions with reasoning logs                     │
│                                                              │
│  Redis (Caching):                                           │
│  - Market data cache (shared)                               │
│  - User sessions and rate limiting                          │
│  - Real-time pub/sub                                        │
└─────────────────────────────────────────────────────────────┘
```

## Core Architectural Principles

### 1. Multi-Tenancy & User Isolation

**Every resource is scoped to a user:**

- Each user has their own account and broker connection
- Each user creates their own agents
- Complete portfolio isolation
- All database queries filter by `user_id`
- Agent executions never cross user boundaries

**Example:**
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

1. **Sign Up** → Create account with authentication
2. **Connect Broker** → Add broker API keys (encrypted)
3. **Create Agent** → Natural language OR visual workflow
4. **Set Triggers** → When should the agent run?
5. **Monitor** → Watch agent execute automatically
6. **Manage** → Pause, edit, delete agents anytime

### 3. AI Agents

**What is an Agent?**

An agent is a user-configurable autonomous trader that:
- Analyzes market data
- Makes trading decisions based on strategy
- Executes orders automatically
- Operates within user-defined risk limits

**Two Creation Methods:**

**A. Natural Language Prompt (Simple)**
- User writes strategy in plain English
- AI interprets and executes the strategy
- Best for beginners and simple strategies

**B. Visual Workflow (Advanced)**
- Drag-and-drop node-based editor
- Conditional logic and multi-step flows
- Best for complex multi-agent strategies

**Agent Configuration:**
- Name & description
- Strategy (prompt OR workflow definition)
- Risk limits (position size, daily trades, allocation)
- LLM settings (model, temperature)
- Triggers (when to run)
- Status (active/paused)

### 4. Triggers

**What triggers an agent?**

Users configure when their agents should analyze markets:

1. **Time-Based**: "Run every weekday at 9:30 AM"
2. **Price-Based**: "Run when AAPL drops 3%"
3. **Volume-Based**: "Run when volume spikes 2x"
4. **News-Based**: "Run when news mentions earnings"
5. **Webhook-Based**: "Run on custom signal"

### 5. Multi-Agent Workflows

**Why multiple agents?**

Users create specialized agents that work together:

**Example: "Investment Team"**
```
1. "Analyst" Agent → Scans for opportunities
2. "Risk Manager" Agent → Reviews and approves
3. "Executor" Agent → Sizes and executes trades
```

**Coordination Patterns:**
- **Sequential**: Pipeline (1 → 2 → 3)
- **Parallel**: Simultaneous analysis with voting
- **Hierarchical**: Workers propose, supervisor approves

### 6. Portfolio & Risk Management

**Per-User Portfolio Tracking:**
- Total portfolio value and cash balance
- Open positions with real-time P&L
- Trade history and performance metrics
- Buying power calculations

**Risk Controls (Per User):**
- Maximum position size per trade
- Maximum portfolio allocation per agent
- Daily trade limits
- Stop-loss rules
- Pattern day trading compliance

**Per-Agent Allocation:**
- Each agent allocated percentage of portfolio
- Agents only trade within their allocation
- Prevents single agent from using all capital

## Key Technical Decisions

### Security First

**Authentication:**
- JWT tokens for API access
- Refresh token rotation
- 2FA/MFA for sensitive operations

**Authorization:**
- All queries filter by `user_id`
- No cross-user data access
- Broker API keys encrypted (AES-256)

**Trading Security:**
- All logic server-side (never trust frontend)
- Order validation before execution
- Balance checks and audit logging

### Real-Time Communication

**WebSocket Connections (Per User):**
- Real-time price updates
- Order fill notifications
- Portfolio value changes
- Agent execution updates

**Message Types:**
- `quote` - Stock price updates
- `order_filled` - Trade confirmations
- `portfolio_update` - Balance changes
- `agent_execution` - Agent decisions

### Scalability

**Horizontal Scaling:**
- Stateless backend servers
- Queue-based agent execution
- Database connection pooling
- Redis for distributed caching

**Fair Scheduling:**
- Agent execution queue prevents resource hogging
- Rate limiting per user
- Resource quotas (max agents, max triggers)

### Broker Agnostic

**Supported Brokers:**
- Alpaca (primary, easy setup)
- Interactive Brokers (advanced users)
- TD Ameritrade (optional)

**Per-User Broker Accounts:**
- Each user connects their own broker
- Encrypted API key storage
- Orders executed through user's broker
- Real-time position sync

### Data Organization

**User Data (Isolated):**
- All user-specific tables include `user_id`
- agents, portfolios, orders, trades
- Filtered by authenticated user in all queries

**Shared Data (Global):**
- Market data cached and shared
- News articles and sentiment
- Technical indicators

## Technology Stack

### Frontend
- Next.js 16 with App Router
- React 19 + Tailwind CSS v4
- shadcn/ui components (Radix UI)
- TradingView charts
- Native WebSocket

### Backend
- Bun runtime (TypeScript)
- Fastify framework
- Bull/BullMQ for job queues
- Zod validation
- Pino logging

### Database
- PostgreSQL 16 (primary)
- TimescaleDB (time-series)
- Redis 7 (cache/sessions)
- Drizzle ORM

### External Services
- **Market Data**: Polygon.io (REST + WebSocket)
- **Broker**: Alpaca (primary), IBKR (optional)
- **LLM**: OpenAI (GPT-4), Anthropic (Claude)
- **Auth**: Better Auth
- **Feature Flags**: Statsig

### Infrastructure
- AWS EKS (Kubernetes)
- RDS PostgreSQL, ElastiCache Redis
- Application Load Balancer
- GitOps with ArgoCD

## Security & Compliance

### Data Security
- All data encrypted at rest
- TLS 1.3 for data in transit
- Broker API keys encrypted (AES-256)
- Password hashing (scrypt)

### Trading Security
- Server-side order validation
- Balance checks before every trade
- Position size limits enforced
- Audit log of all trades (immutable)

### User Privacy
- Each user sees only their own data
- No cross-user data sharing
- GDPR compliant (export, deletion)
- Anonymized analytics only

### Compliance Considerations
- Platform doesn't provide investment advice
- Clear risk disclaimers
- Age verification (18+)
- Broker handles actual execution (licensed)

## Monitoring & Observability

### Application Metrics
- Agent execution success rate
- Order execution latency
- WebSocket connection count
- Database query performance
- Cache hit rates

### Business Metrics
- Daily/Monthly active users
- Agent creation rate
- Trade volume per user
- User retention rate

### Alerting
- High error rate → Page on-call
- Queue backlog → Add workers
- Database slow queries → Auto-scale

## Future Vision

### Phase 2 Features
- Agent Marketplace (share/sell strategies)
- Backtesting on historical data
- Social trading (follow top agents)
- Mobile apps with push notifications

### Phase 3 Features
- Options, crypto, forex trading
- Agent templates for beginners
- AI-recommended strategies
- White-label platform for brokers

### Technical Improvements
- GraphQL for flexible queries
- Event sourcing for audit trail
- Machine learning predictive models
- A/B testing for agent variations

## Success Metrics

### User Success
- Create agent in < 5 minutes
- Agents execute without intervention
- Clear visibility into agent decisions
- Users feel in control

### Platform Success
- 99.9% uptime
- < 100ms API response time (p95)
- < 1 second order execution
- Zero security incidents

### Business Success
- Growing user base (10K users year 1)
- High retention (> 60% after 3 months)
- Active engagement (daily checks)
- Positive word-of-mouth growth

---

**For detailed implementation:**
- Phase-by-phase roadmap → [TODO.md](./TODO.md)
- Microservices architecture → [MICROSERVICES.md](./MICROSERVICES.md)
- Deployment strategy → [DEPLOYMENT.md](./DEPLOYMENT.md)
- Kubernetes operations → [KUBERNETES.md](./KUBERNETES.md)
