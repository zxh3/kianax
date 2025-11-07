# Kianax Implementation Roadmap

**Timeline:** 12-16 weeks | **Approach:** Incremental delivery with working software at each milestone

---

## Phase 1: Multi-User Foundation (Weeks 1-2)

**Goal:** Users can create accounts and authenticate

### What We're Building
- User registration and login system
- Secure authentication (JWT tokens)
- Session management
- Basic user profile management

### Key Multi-Tenant Features
- Each user has isolated account
- Password security (hashing, salting)
- Rate limiting per user
- Email verification (optional for MVP)

### Technical Setup
- PostgreSQL database with users table
- Redis for sessions and caching
- Fastify backend with auth middleware
- Development environment (Docker Compose)

**Deliverable:** Users can sign up, log in, and access protected routes

---

## Phase 2: Real-Time Market Data (Weeks 2-3)

**Goal:** All users see live market data

### What We're Building
- Integration with Polygon.io for market data
- Real-time price streaming via WebSocket
- Symbol search and company information
- Historical price charts

### Key Multi-Tenant Features
- Market data is **shared** across all users (not per-user)
- Each user has their own WebSocket connection
- Per-user subscription management
- Cached data to reduce API costs

### User Experience
- User searches for "AAPL"
- User sees real-time price updates
- User views historical price charts
- User browses company information

**Deliverable:** Users can view real-time stock data

---

## Phase 3: Trading System - Per User (Weeks 3-5)

**Goal:** Each user has their own portfolio and can place trades

### What We're Building
- Per-user portfolio tracking (cash, positions, P&L)
- Order placement system (buy/sell stocks)
- Position management (track holdings)
- Trade history (all executed trades)
- Risk management (balance checks, position limits)

### Key Multi-Tenant Features
- **Each user has completely isolated portfolio**
- Orders are scoped to `user_id`
- Positions are scoped to `user_id`
- Trades are scoped to `user_id`
- Cannot see or affect other users' portfolios

### Database Schema (Key Tables)
```
users (id, email, password_hash, created_at)
portfolios (id, user_id, cash_balance, total_value)
positions (id, user_id, symbol, quantity, avg_cost)
orders (id, user_id, symbol, side, quantity, status)
trades (id, user_id, order_id, executed_price, executed_at)
```

### User Experience
- User sees their portfolio: "$50,000 total value"
- User places order: "Buy 10 shares of AAPL"
- System checks user's buying power
- Order executes → User's portfolio updates
- User sees trade in history

**Deliverable:** Users can trade stocks with virtual/paper money

---

## Phase 4: Broker Integration - Per User (Weeks 5-6)

**Goal:** Each user connects their own real broker account

### What We're Building
- Broker API integration (start with Alpaca)
- Encrypted storage of **per-user API keys**
- Real order execution to broker
- Position synchronization from broker
- Real-time order status updates

### Key Multi-Tenant Features
- **Each user connects their own broker account**
- User's Alpaca API keys stored encrypted
- Orders routed to correct user's broker
- Positions synced from user's broker account
- Complete isolation: User A's orders never hit User B's account

### User Flow
```
1. User goes to "Connect Broker" settings page
2. User enters their Alpaca API key & secret
3. Platform stores encrypted (AES-256)
4. Platform verifies connection
5. User's trades now execute on their real broker account
```

### Security Considerations
- API keys never sent to frontend
- Keys encrypted at rest in database
- TLS for all broker API calls
- Audit log of all broker operations

**Deliverable:** Users can trade with real money through their own broker accounts

---

## Phase 5: Web Application UI (Weeks 6-8)

**Goal:** Beautiful, responsive web interface

### What We're Building

#### Authentication Pages
- Login / Register / Password Reset
- Email verification
- Profile settings

#### Dashboard Page
- Portfolio summary (value, cash, P&L)
- Quick stats (today's gain/loss, positions count)
- Recent activity feed
- Quick trade widget

#### Trading Terminal
- Real-time price chart
- Order entry form (buy/sell, market/limit)
- Current positions list
- Open orders (with cancel button)
- Order history
- Real-time WebSocket updates

#### Portfolio Page
- Detailed positions with P&L
- Asset allocation chart (pie/donut)
- Performance chart (equity curve over time)
- Export data (CSV)

#### Settings Page
- User profile
- Broker connection (add/edit API keys)
- Notification preferences
- Security settings (change password, 2FA)

### Key Multi-Tenant UI Features
- User only sees their own data (enforced by backend)
- Real-time updates via WebSocket (per-user channel)
- Responsive design (mobile + desktop)
- Loading states, error handling, empty states

**Deliverable:** Fully functional web trading application

---

## Phase 6: AI Agents - User-Created (Weeks 9-12)

**Goal:** Each user can create their own AI trading agents

### What We're Building

#### Agent Creation (Prompt-Based)
- Simple UI: textarea for strategy description
- Risk limits configuration per agent
- LLM model selection (GPT-4, Claude)
- Agent activation/pause controls

Example:
```
User writes:
"Buy AAPL when RSI < 30 and price drops 3%+.
Sell when RSI > 70 or profit reaches 5%.
Max position size: $5,000"

→ Agent interprets this and trades autonomously
```

#### Agent Management
- Create, edit, delete agents (CRUD)
- Each agent belongs to one user
- Each agent has own risk limits
- Each agent can be paused/activated
- Performance tracking per agent

#### Agent Execution System
- Trigger system (when to run agents)
  - Time-based: "Run every day at 9:30 AM"
  - Price-based: "Run when AAPL drops 3%"
  - News-based: "Run on earnings news"
  - Manual: "Run now" button
- Agent executor service
  - Builds context (market data, portfolio, news)
  - Calls LLM (GPT-4 or Claude)
  - Parses decision (buy/sell/hold)
  - Validates against risk limits
  - Executes via trading engine
- Execution logging (audit trail)

### Key Multi-Tenant Features for Agents

**Complete User Isolation:**
```
User A:
  agents: ["Dip Buyer", "Momentum Trader"]
    → Trade using User A's portfolio
    → Use User A's risk limits
    → Execute on User A's broker account

User B:
  agents: ["News Trader"]
    → Trade using User B's portfolio
    → Use User B's risk limits
    → Execute on User B's broker account
```

**Database Schema:**
```
agents (
  id,
  user_id,  ← Owner of this agent
  name,
  description,
  config_type (prompt|workflow),
  prompt_template,
  risk_limits (json),
  status (active|paused)
)

triggers (
  id,
  user_id,  ← Owner of this trigger
  agent_id,
  type (time|price|news),
  config (json)
)

agent_executions (
  id,
  agent_id,
  user_id,  ← Whose agent ran
  context (json),
  decision (json),
  outcome,
  executed_at
)
```

### User Experience

**Creating an Agent:**
```
1. User clicks "Create Agent"
2. User writes strategy in natural language
3. User sets risk limits:
   - Max position: $5,000
   - Max daily trades: 3
   - Allocation: 10% of portfolio
4. User sets trigger: "Run every weekday at 10 AM"
5. User clicks "Activate"
```

**Agent Running:**
```
Trigger fires (10 AM):
→ Agent wakes up
→ Fetches user's portfolio & market data
→ Asks LLM: "What should I do based on my strategy?"
→ LLM responds: "Buy 10 shares of AAPL (RSI is 28)"
→ System validates against user's balance & limits
→ If valid: Execute trade on user's broker account
→ User gets notification: "Agent bought 10 AAPL @ $150"
```

**Agent Dashboard:**
```
User sees list of their agents:

┌─────────────────────────────────────────┐
│ Dip Buyer                      [Active] │
│ Buys quality stocks on dips             │
│ ────────────────────────────────────    │
│ Trades: 23  |  Win Rate: 65%  |  P&L: +$1,234 │
│ Last Run: 2 hours ago → Bought MSFT     │
│ [Pause] [Edit] [View Details]           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Momentum Trader                [Paused] │
│ Follows strong upward trends            │
│ ────────────────────────────────────    │
│ Trades: 45  |  Win Rate: 58%  |  P&L: +$892 │
│ Last Run: 1 day ago → Hold (no signal) │
│ [Activate] [Edit] [View Details]        │
└─────────────────────────────────────────┘
```

### Portfolio Allocation Per Agent

Users can allocate capital to each agent:

```
User's Portfolio: $50,000

Allocation:
  Agent "Dip Buyer": $10,000 (20%)
  Agent "Momentum": $15,000 (30%)
  Cash Reserve: $25,000 (50%)

Rules:
- Dip Buyer can only use $10,000 for trades
- Momentum can only use $15,000 for trades
- Agents cannot exceed their allocation
```

**Deliverable:** Users can create AI agents that trade autonomously

---

## Phase 7: Multi-Agent Workflows (Weeks 12-13)

**Goal:** Users create teams of agents that work together

### What We're Building

#### Coordination Patterns

**Sequential (Pipeline):**
```
User creates 3 agents that run in order:
1. "Analyst" → Finds opportunities
2. "Risk Checker" → Validates safety
3. "Executor" → Places trades

Flow: Agent 1 output → Agent 2 input → Agent 3 decision
```

**Parallel (Voting):**
```
User creates 3 agents that run simultaneously:
All analyze same stock, then vote:
- Agent A: Buy
- Agent B: Buy
- Agent C: Hold
Result: Majority says Buy → Execute
```

**Hierarchical (Approval):**
```
Worker agents propose trades
Supervisor agent approves/rejects
Only approved trades execute
```

#### Visual Workflow Builder

Drag-and-drop interface (like n8n, Zapier):

```
[Start] → [Fetch Price] → [If RSI < 30?]
            ├─ Yes → [AI Analysis] → [Buy Order]
            └─ No → [End]
```

Each node configurable:
- Condition nodes: Price checks, indicator checks
- Action nodes: Buy, sell, notify, log
- LLM nodes: AI decision points
- Data nodes: Fetch market data, news

### Key Multi-Tenant Features

**Workflows are per-user:**
- Each user creates their own workflows
- Workflows use user's portfolio
- Workflows execute on user's broker
- Cannot affect other users

**Database Schema:**
```
workflows (
  id,
  user_id,  ← Owner
  name,
  dag_definition (json),
  status
)

workflow_executions (
  id,
  workflow_id,
  user_id,
  execution_path,
  result,
  executed_at
)
```

**Deliverable:** Users can build complex multi-agent strategies

---

## Phase 8: News & Advanced Triggers (Week 14)

**Goal:** Agents react to news and market events

### What We're Building

#### News Aggregation
- Fetch from Polygon.io News API
- Fetch from Finnhub (optional)
- Store in shared database (all users access same news)
- Real-time news stream

#### Sentiment Analysis
- Use LLM (Claude Haiku for speed/cost)
- Classify: Positive, Negative, Neutral
- Extract mentioned symbols from article
- Calculate relevance score

#### News Triggers
Users configure:
```
"Run my agent when:
- Keyword: 'earnings beat'
- Symbols: AAPL, MSFT
- Sentiment: Positive
- Min relevance: 0.7"

When matching news appears:
→ Trigger user's agent
→ Agent analyzes and decides
→ Trade executes if validated
```

#### Advanced Triggers
- Technical indicators: "Run when MACD crosses"
- Volume spikes: "Run when volume > 2x average"
- Sector movements: "Run when tech sector drops 2%"

**Deliverable:** Agents react to news and technical signals

---

## Phase 9: Safety & Monitoring (Week 15)

**Goal:** Ensure safe, auditable trading for all users

### What We're Building

#### Safety Validations
- Market condition checks (VIX > 40? Pause)
- Agent performance checks (losing streak? Pause)
- Position concentration limits (max 40% in one sector)
- Volatility checks (don't trade stocks with >60% volatility)
- Liquidity checks (require >500K avg daily volume)

#### Emergency Controls (Per User)
- Pause all my agents
- Cancel all my pending orders
- Liquidate all my positions (emergency exit)

#### Audit Logging
- Every order (who, what, when, why)
- Every trade execution
- Every agent decision (with reasoning)
- Every trigger fire
- Immutable log (cannot be deleted)

#### Performance Tracking
- Per-agent stats (win rate, P&L, trades)
- Per-user overall performance
- Agent leaderboard (top performers)
- Execution analytics (latency, success rate)

**Deliverable:** Production-ready safety & compliance

---

## Phase 10: Polish & Launch (Week 16)

**Goal:** Production-ready platform for public users

### Final Checklist

#### Security Audit
- Penetration testing
- Vulnerability scan
- Code review for auth/security
- API key encryption verified
- No secrets in code

#### Performance Optimization
- Database query optimization
- Index all user_id foreign keys
- Redis cache tuning
- WebSocket connection limits
- Load testing (1000 concurrent users)

#### Monitoring Setup
- Error tracking (Sentry)
- Uptime monitoring
- Performance metrics
- Alerting rules
- Logging aggregation

#### Documentation
- User onboarding guide
- API documentation
- Agent creation tutorial
- FAQ and troubleshooting
- Video tutorials

#### Legal & Compliance
- Terms of Service
- Privacy Policy
- Risk disclaimers
- Age verification (18+)
- GDPR compliance (data export/deletion)

**Deliverable:** Platform ready for public launch

---

## Post-Launch Roadmap (Future)

### Short Term (Months 1-3)
- Mobile app (iOS/Android)
- Agent marketplace (users share strategies)
- Backtesting (test agents on historical data)
- More broker integrations (IBKR, TD Ameritrade)
- Social features (follow top traders)

### Medium Term (Months 4-6)
- Options trading support
- Crypto trading integration
- Advanced charting tools
- Custom technical indicators
- Agent templates library

### Long Term (Months 7-12)
- White-label solution for brokers
- Institutional features (team accounts)
- API for developers
- Mobile SDK for third-party apps
- International expansion

---

## Development Principles

### Throughout All Phases

1. **Multi-Tenancy First**
   - Every feature must respect user boundaries
   - All queries filter by user_id
   - No cross-user data leakage

2. **Security by Default**
   - Never trust frontend input
   - Always validate on backend
   - Encrypt sensitive data
   - Audit all critical operations

3. **Incremental Delivery**
   - Ship working software every 2 weeks
   - Each phase has clear deliverable
   - Test with real users early

4. **User-Centric Design**
   - Simple onboarding flow
   - Clear error messages
   - Responsive design (mobile-first)
   - Fast load times

5. **Testing & Quality**
   - Unit tests for business logic
   - Integration tests for APIs
   - End-to-end tests for critical flows
   - Code reviews required

---

## Success Criteria

### MVP Success (Phase 1-6)
- ✅ Users can register and trade manually
- ✅ Real-time market data working
- ✅ Orders execute on real broker
- ✅ Clear portfolio tracking
- ✅ Mobile-responsive web UI

### AI Agent Success (Phase 6-8)
- ✅ Users can create agents in < 5 min
- ✅ Agents execute trades automatically
- ✅ Users can understand agent decisions
- ✅ Multi-agent coordination working
- ✅ News-based triggers functional

### Production Success (Phase 9-10)
- ✅ 99.9% uptime
- ✅ Zero security incidents
- ✅ Fast performance (< 100ms p95 latency)
- ✅ Positive user feedback
- ✅ Growing user base

---

## Prerequisites

Before starting development:

### Required Accounts
- [ ] Polygon.io API key (market data)
- [ ] Alpaca Paper Trading account (free)
- [ ] Anthropic API key (Claude for agents)
- [ ] OpenAI API key (GPT-4 for agents)

### Development Environment
- [ ] Bun 1.2+ installed
- [ ] PostgreSQL 16 installed
- [ ] Redis 7 installed
- [ ] Docker & Docker Compose installed
- [ ] Git repository set up

### Team Requirements
- [ ] TypeScript developer(s)
- [ ] React/Next.js developer(s)
- [ ] DevOps engineer (for deployment)
- [ ] Designer (UI/UX)

---

## Budget Estimate (MVP - First 16 Weeks)

### Development Costs
- Developer time: $80-120K (1-2 devs for 4 months)
- Designer time: $10-15K (part-time)

### Infrastructure Costs (Monthly)
- Hosting (Vercel + Railway): ~$100-200/mo
- Database (managed PostgreSQL): ~$50-100/mo
- Redis (managed): ~$30-50/mo
- Market Data (Polygon.io): ~$200/mo (Starter plan)
- LLM APIs (OpenAI/Anthropic): ~$100-500/mo (depends on usage)
- Monitoring tools: ~$50/mo

**Total MVP Infrastructure:** ~$500-1,000/month

### Post-Launch Ongoing
- Server costs scale with users
- Consider revenue from paid tiers to offset costs
- LLM costs are per-agent-execution (watch carefully)

---

**Last Updated:** 2025-01-06

**Next Steps:**
1. Secure API keys and accounts
2. Set up development environment
3. Begin Phase 1: Multi-User Foundation
