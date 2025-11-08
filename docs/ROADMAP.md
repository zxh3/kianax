# Kianax Development Roadmap

> **Note:** This is the long-term product vision. For current sprint tasks, see [TODO.md](./TODO.md)

**Last Updated:** 2025-01-07

---

## 🎯 Current Status

### ✅ What Actually Exists

**Infrastructure & Setup:**
- Monorepo with Turborepo + Bun
- Docker Compose (PostgreSQL 16, Redis 7)
- TypeScript configuration
- Biome for linting/formatting

**Backend (apps/server):**
- Basic Fastify server with CORS, Helmet, Rate Limiting
- Health endpoint (`/health`)
- Example route (`/api/example`)
- Error handling & logging
- ❌ NO authentication yet
- ❌ NO database connection yet
- ❌ NO business logic yet

**Frontend (apps/web):**
- Next.js 16 app with React 19
- Tailwind CSS v4
- Basic page with shadcn/ui Button component
- ❌ NO pages beyond homepage
- ❌ NO authentication UI
- ❌ NO trading interface

**Database (packages/db):**
- Drizzle ORM setup
- Basic user schema and example todo schema
- ❌ NO trading-related schemas yet
- ❌ NO multi-tenant patterns implemented yet

**UI Package (packages/ui):**
- shadcn/ui component library with Radix UI primitives
- Tailwind CSS v4 with PostCSS

**Documentation:**
- Comprehensive high-level docs (ARCHITECTURE, DEPLOYMENT, KUBERNETES, etc.)

**Reality:** We have a well-organized skeleton. **We're at Phase 0, not Phase 1.**

---

## 📅 Development Philosophy

**Solo Developer Reality:**
- Timeline estimates are for reference only
- Actual time: multiply by 2-3x for solo development
- Better to under-promise and over-deliver
- Focus on small, frequent wins
- Adjust based on reality, not wishful thinking

**Principles:**
1. **Multi-Tenancy First** - Every feature respects user boundaries
2. **Security by Default** - Never trust frontend input
3. **Incremental Delivery** - Ship working software frequently
4. **User-Centric Design** - Simple, fast, responsive
5. **Testing & Quality** - Test business logic and critical flows

---

## 🛤️ Phase 0: Foundation (CURRENT)

**Status:** 🚧 In Progress
**Timeline:** 1-2 weeks
**Goal:** Get core infrastructure working end-to-end

**Tasks:**
- Database connection from server to PostgreSQL
- User schema with multi-tenant pattern (user_id everywhere)
- Basic CRUD operations working
- API endpoint connected to database
- Frontend calling backend API
- Development workflow documented

**Deliverable:** Can create a user record via API and display it on frontend

---

## 🛤️ Phase 1: Authentication

**Timeline:** 2-3 weeks
**Goal:** Users can sign up and log in

**Key Features:**
- Implement Better Auth
- User registration endpoint
- Login endpoint with JWT tokens
- Protected route middleware
- Login/Register pages in UI
- Session management
- Environment variables setup

**Security:**
- Password hashing (scrypt)
- JWT token validation
- Secure session storage
- Rate limiting per user

**Deliverable:** Working auth system - users can sign up, log in, access protected routes

---

## 🛤️ Phase 2: Database Schema

**Timeline:** 1-2 weeks
**Goal:** Core multi-tenant database structure

**Tables to Create:**
- Users (complete with profile fields)
- Portfolios (user_id, cash_balance, total_value)
- Positions (user_id, symbol, quantity, avg_cost)
- Orders (user_id, symbol, side, quantity, status)
- Trades (user_id, order_id, executed_price, timestamp)
- Agents (user_id, name, prompt, config)

**Multi-Tenant Pattern:**
- Every table has `user_id` foreign key
- All queries filter by authenticated user_id
- Row-level security enforced
- Seed data for development

**Deliverable:** Full database schema with migrations

---

## 🛤️ Phase 3: Paper Trading

**Timeline:** 3-4 weeks
**Goal:** Users can simulate trading with fake money

**Backend Services:**
- Portfolio service (CRUD operations)
- Order service (create, cancel orders)
- Order execution simulator (fake fills with realistic delays)
- Balance and risk validation

**Frontend UI:**
- Portfolio dashboard (holdings, P&L, cash)
- Order entry form (buy/sell, market/limit)
- Positions list with current prices
- Order history and trade log
- Real-time updates (polling first, WebSocket later)

**User Experience:**
- User starts with $50,000 virtual cash
- Places orders → simulated execution
- Sees portfolio update in real-time
- Track win rate and P&L

**Deliverable:** Working paper trading interface

---

## 🛤️ Phase 4: Market Data Integration

**Timeline:** 2-3 weeks
**Goal:** Real-time stock data from Polygon.io

**Features:**
- Polygon.io REST API integration
- WebSocket for real-time quotes
- Symbol search and autocomplete
- Historical price data
- Price charts (TradingView widget or Recharts)
- Caching layer with Redis (1-second TTL for quotes)

**API Endpoints:**
- GET `/api/market/search?q=AAPL` - Symbol search
- GET `/api/market/quote/:symbol` - Latest quote
- GET `/api/market/history/:symbol` - Historical data
- WebSocket `/ws/quotes` - Real-time updates

**Deliverable:** Live market data in the application

---

## 🛤️ Phase 5: Simple AI Agent

**Timeline:** 2-3 weeks
**Goal:** Most basic AI agent that can trade

**Core Features:**
- Agent schema (user_id, name, prompt, risk_limits)
- LLM integration (OpenAI GPT-4 or Anthropic Claude)
- Agent execution service
- Manual trigger (button to run agent)
- Agent creation form with prompt textarea
- Agent dashboard showing active agents
- Execution logs with reasoning

**Agent Flow:**
1. User creates agent with natural language strategy
2. User clicks "Run Agent" button
3. System fetches user's portfolio and market data
4. Calls LLM with context + strategy prompt
5. Parses LLM response (buy/sell/hold decision)
6. Validates against user's balance and risk limits
7. Executes order if valid
8. Logs execution with reasoning

**Example Agent:**
```
Strategy: "Buy AAPL when RSI < 30 and price drops 3%+.
Sell when RSI > 70 or profit reaches 5%.
Max position size: $5,000"
```

**Multi-Tenant:**
- Agent belongs to specific user (user_id)
- Agent trades only user's portfolio
- Agent execution isolated per user

**Deliverable:** Can create an agent, run it manually, and see it place trades

---

## 🛤️ Phase 6: Scheduled Triggers

**Timeline:** 1-2 weeks
**Goal:** Agents run automatically on schedule

**Trigger Types:**
- **Time-based:** "Run every weekday at 9:35 AM"
- **Price-based:** "Run when AAPL drops 3%"
- **Manual:** "Run now" button (from Phase 5)

**Implementation:**
- Scheduler service (cron jobs)
- Trigger configuration per agent
- Queue-based execution (Bull/BullMQ with Redis)
- Prevent duplicate executions

**Deliverable:** Agents run automatically based on triggers

---

## 🛤️ Phase 7: Broker Integration (Real Money)

**Timeline:** 2-3 weeks
**Goal:** Users connect real broker accounts

**Features:**
- Alpaca API integration
- Per-user encrypted API key storage (AES-256)
- Real order execution to broker
- Position synchronization from broker
- Real-time order status updates

**Security:**
- API keys never sent to frontend
- Keys encrypted at rest in database
- TLS for all broker API calls
- Audit log of all broker operations

**User Flow:**
1. User goes to Settings → Connect Broker
2. Enters Alpaca API key and secret
3. System verifies connection
4. User's trades now execute on real broker account

**Multi-Tenant:**
- Each user connects their own broker account
- Orders routed to correct user's broker
- Complete isolation: User A's orders never hit User B's account

**Deliverable:** Users can trade with real money through their own broker

---

## 🛤️ Phase 8: Advanced UI Polish

**Timeline:** 2-3 weeks
**Goal:** Beautiful, responsive, production-quality interface

**Pages to Build:**
- Dashboard (portfolio summary, quick stats, activity feed)
- Trading Terminal (real-time chart, order form, positions)
- Agent Manager (create, edit, pause agents)
- Agent Details (execution history, performance metrics)
- Settings (profile, broker connection, notifications)

**Features:**
- Responsive design (mobile + desktop)
- Real-time WebSocket updates
- Asset allocation charts (pie/donut)
- Performance charts (equity curve)
- Dark mode support
- Loading states, error handling

**Deliverable:** Production-quality web trading application

---

## 🛤️ Phase 9: News & Advanced Triggers

**Timeline:** 2-3 weeks
**Goal:** Agents react to news and market events

**News Integration:**
- Fetch from Polygon.io News API
- Store in shared database (all users access same news)
- Real-time news stream

**Sentiment Analysis:**
- Use LLM (Claude Haiku for speed/cost)
- Classify: Positive, Negative, Neutral
- Extract mentioned symbols
- Calculate relevance score

**News Triggers:**
- "Run when: keyword='earnings beat', symbols=[AAPL,MSFT], sentiment=Positive"

**Advanced Triggers:**
- Technical indicators: "Run when MACD crosses"
- Volume spikes: "Run when volume > 2x average"
- Sector movements: "Run when tech sector drops 2%"

**Deliverable:** Agents react to news and technical signals

---

## 🛤️ Phase 10: Multi-Agent Workflows

**Timeline:** 3-4 weeks
**Goal:** Users create teams of agents that work together

**Coordination Patterns:**

**Sequential (Pipeline):**
- Agent 1 "Analyst" → Finds opportunities
- Agent 2 "Risk Checker" → Validates safety
- Agent 3 "Executor" → Places trades

**Parallel (Voting):**
- Multiple agents analyze same stock
- Agents vote on decision
- Majority decision executes

**Hierarchical (Approval):**
- Worker agents propose trades
- Supervisor agent approves/rejects
- Only approved trades execute

**Visual Workflow Builder:**
- Drag-and-drop interface (like n8n, Zapier)
- Condition nodes: Price checks, indicator checks
- Action nodes: Buy, sell, notify, log
- LLM nodes: AI decision points
- Data nodes: Fetch market data, news

**Deliverable:** Users can build complex multi-agent strategies

---

## 🛤️ Phase 11: Safety & Monitoring

**Timeline:** 1-2 weeks
**Goal:** Production-ready safety and compliance

**Safety Validations:**
- Market condition checks (VIX > 40? Pause agents)
- Agent performance checks (losing streak? Auto-pause)
- Position concentration limits (max 40% in one sector)
- Volatility checks (don't trade high-volatility stocks)
- Liquidity checks (require minimum daily volume)

**Emergency Controls (Per User):**
- Pause all my agents
- Cancel all my pending orders
- Liquidate all my positions (emergency exit)

**Audit Logging:**
- Every order (who, what, when, why)
- Every trade execution
- Every agent decision (with reasoning)
- Every trigger fire
- Immutable log (cannot be deleted)

**Performance Tracking:**
- Per-agent stats (win rate, P&L, trades)
- Per-user overall performance
- Agent leaderboard (top performers)

**Deliverable:** Production-ready safety & compliance

---

## 🛤️ Phase 12: Launch Preparation

**Timeline:** 1-2 weeks
**Goal:** Ready for public users

**Security Audit:**
- Penetration testing
- Vulnerability scan
- Code review for auth/security
- API key encryption verified

**Performance Optimization:**
- Database query optimization
- Index all user_id foreign keys
- Redis cache tuning
- Load testing (1000 concurrent users)

**Monitoring:**
- Error tracking (Sentry)
- Uptime monitoring
- Performance metrics (Prometheus/Grafana)
- Alerting rules

**Documentation:**
- User onboarding guide
- API documentation
- Agent creation tutorial
- FAQ and troubleshooting

**Legal & Compliance:**
- Terms of Service
- Privacy Policy
- Risk disclaimers
- Age verification (18+)
- GDPR compliance

**Deliverable:** Platform ready for public launch

---

## 🔮 Post-Launch Features (Future)

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

## ⏱️ Timeline Reality Check

**Optimistic (Full-Time Solo Dev):**
- **Phase 0-2 (Foundation + Auth + Schema):** 4-7 weeks
- **Phase 3-4 (Paper Trading + Market Data):** 5-6 weeks
- **Phase 5-6 (Simple Agent + Triggers):** 3-5 weeks
- **Phase 7-8 (Broker + UI Polish):** 4-6 weeks
- **Phase 9-12 (Advanced Features + Launch):** 6-8 weeks
- **Total:** ~22-32 weeks (5-8 months)

**Realistic (With Life, Interruptions, Learning):**
- **Total to Launch:** 6-12 months

**That's OK!** Better to be honest and hit milestones than rush and burn out.

---

## 📊 Success Criteria

### MVP Success (Phase 0-5)
- ✅ Users can register and authenticate
- ✅ Users can trade with paper money
- ✅ Real-time market data working
- ✅ Basic AI agent can trade manually
- ✅ Mobile-responsive UI

### Advanced MVP (Phase 6-9)
- ✅ Agents run on scheduled triggers
- ✅ Real money trading via broker integration
- ✅ News-based triggers working
- ✅ Production-quality UI

### Production Ready (Phase 10-12)
- ✅ Multi-agent workflows
- ✅ Safety validations and monitoring
- ✅ Legal compliance
- ✅ Ready for public users

---

## 📋 Prerequisites

**Required API Keys:**
- Polygon.io API key (market data) - ~$200/month
- Alpaca Paper Trading account (free)
- Anthropic API key (Claude) or OpenAI (GPT-4)

**Development Environment:**
- Bun 1.2+, PostgreSQL 16, Redis 7
- Docker & Docker Compose
- Git repository

**Infrastructure (Later):**
- AWS account for EKS deployment
- Domain name
- SSL certificates

---

**For implementation details, see:**
- [TODO.md](./TODO.md) - Current sprint tasks
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [DEPLOYMENT.md](./DEPLOYMENT.md) - AWS EKS deployment
