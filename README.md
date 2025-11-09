# Kianax

An AI-native routine orchestration platform where users build powerful automations by simply describing what they want. Extensible plugin marketplace lets you connect any data source to any action.

## Overview

**"Talk to Create Routines"** - The only automation platform where AI builds routines for you.

Kianax enables users to:
- **Create Routines with Natural Language** - Describe what you want, AI builds it
- **Connect Any Data Source** - Twitter, Reddit, earnings reports, stock prices, RSS feeds
- **Trigger on Any Event** - Time-based, data changes, webhooks, custom events
- **Take Any Action** - Trade stocks, send emails/SMS, make phone calls, HTTP requests
- **Build with Plugins** - Extensible marketplace where anyone can publish plugins
- **Powered by AI** - LLM decision nodes for intelligent, context-aware routines

Each user has complete data isolation with their own routines, credentials, and execution history.

## Key Features

- 🤖 **AI-Powered Routine Creation**: Describe routines in plain English or audio
- 🧩 **Plugin Marketplace**: Extensible ecosystem - anyone can build and publish plugins
- 🔌 **Type-Safe Connections**: Plugins automatically connect when input/output types match
- 📊 **Multi-Source Data Ingestion**: Unify data from Twitter, Reddit, APIs, databases, and more
- 🎯 **Event-Driven Execution**: Cron schedules, webhooks, data changes, custom triggers
- 🔒 **Multi-Tenant Architecture**: Complete user isolation and sandboxed plugin execution
- 🔐 **Secure Credentials**: Encrypted API key storage per user
- 🌐 **Modern Stack**: Next.js 16, Convex (serverless backend), Temporal Cloud (workflows), Vercel

## Example Use Cases

### 1. AI-Powered Stock Trading (Flagship)
```
"When AAPL drops 5%, analyze recent news sentiment.
If positive, buy $1000 worth. If negative, wait."
```
**Routine:**
- Trigger: Cron (every 5 minutes)
- Steps: Stock Price Input → AI Processor (check if dropped 5%) → News Input → AI Processor (sentiment analysis) → Logic Condition → Trading Output

### 2. Social Media Monitoring
```
"When my company is mentioned on Reddit with negative sentiment,
send me an SMS alert."
```
**Routine:**
- Trigger: Webhook (on Reddit mention)
- Steps: Reddit Input → AI Processor (sentiment analysis) → Logic Condition → SMS Output

### 3. Earnings Alert System
```
"Every day at 4pm, check if any tech companies reported earnings.
Summarize with AI and email me."
```
**Routine:**
- Trigger: Cron (daily at 4pm)
- Steps: Earnings Input → AI Processor (summarize) → Email Output

### 4. Custom Business Automation
```
"When a new customer signs up, enrich their data from Clearbit,
add to Salesforce, and send welcome email."
```
**Routine:**
- Trigger: Webhook (on customer signup)
- Steps: Clearbit Input → AI Processor (format data) → Salesforce Output → AI Processor (generate email) → Email Output

## Tech Stack

**Frontend:** Next.js 16 (React 19), Tailwind CSS v4, shadcn/ui, React Flow (routine editor)
**Backend:** Convex (managed database + serverless functions + real-time subscriptions)
**Routine Engine:** Temporal Cloud (dynamic Temporal workflow execution, versioning, observability)
**Workers:** TypeScript Workers (execute plugin code as Temporal Activities)
**Auth:** Convex Auth (built-in authentication)
**File Storage:** Convex file storage (for plugin code)
**Infrastructure:** Vercel (frontend), Convex (backend + database), Temporal Cloud (Temporal workflows)
**AI Services:** OpenAI (GPT-4 for routine parsing, GPT-3.5 Turbo for AI Processor)

**Why Temporal for Routine Execution?**
- Dynamic execution: Purpose-built for user-defined routines at runtime
- Workflow versioning: Update engine without breaking running routines (Temporal workflows)
- Superior observability: Time-travel debugging, Temporal workflow history replay
- Multi-tenancy: Task queues per user, isolated execution
- Battle-tested: Used by Uber, Netflix, Stripe for mission-critical Temporal workflows

**Why Convex for Data?**
- Zero DevOps: No PostgreSQL, Redis, or Kubernetes management
- Built-in real-time: Live routine execution updates without WebSocket server
- TypeScript-native: Schema and functions defined in code, no migrations
- Serverless: Auto-scaling, pay-per-use
- Perfect for solo developers focusing on product, not infrastructure

## Project Structure

```
kianax/
├── app/                  # Next.js 16 app directory (frontend)
│   ├── page.tsx          # Homepage
│   ├── routines/         # Routine builder UI
│   ├── marketplace/      # Plugin marketplace
│   └── chat/             # AI chat interface
├── convex/               # Convex backend (database + functions)
│   ├── schema.ts         # Database schema (routines, plugins, users)
│   ├── routines.ts       # Routine CRUD mutations/queries
│   ├── plugins.ts        # Plugin marketplace functions
│   ├── executions.ts     # Execution history queries
│   ├── auth.ts           # Convex Auth configuration
│   └── lib/
│       └── temporal.ts   # Temporal Client integration
├── workers/              # Temporal Workers (execute routines as Temporal workflows)
│   ├── workflows/        # Temporal workflow definitions
│   │   └── executor.ts   # Generic routine executor (Temporal workflow)
│   ├── activities/       # Activities (plugin execution)
│   │   └── plugins.ts    # Plugin activity implementations
│   └── index.ts          # Worker entry point
├── packages/
│   ├── ui/               # Shared React components (shadcn/ui)
│   ├── plugin-sdk/       # Plugin development SDK
│   └── typescript-config/
├── plugins/              # Core platform plugins (executed as Temporal Activities)
│   ├── triggers/         # Trigger configuration handlers (NOT plugins)
│   │   ├── cron/         # Cron schedule setup (Temporal Schedules)
│   │   ├── webhook/      # Webhook endpoint handlers
│   │   └── manual/       # Manual trigger handlers
│   ├── data-sources/
│   │   ├── stock-price/  # Stock market data (Polygon.io)
│   │   ├── twitter/      # Twitter API integration
│   │   └── reddit/       # Reddit API integration
│   ├── actions/
│   │   ├── alpaca/       # Stock trading via Alpaca
│   │   ├── email/        # Send emails (SendGrid)
│   │   └── http/         # HTTP requests
│   ├── transformers/
│   │   └── ai/           # AI-powered data transformation
│   └── conditions/
│       └── if-else/      # Conditional branching
└── docs/                 # Documentation
    ├── ARCHITECTURE.md
    ├── PLUGIN_DEVELOPMENT.md
    ├── ROADMAP.md
    └── TODO.md
```

## Quick Start

**Prerequisites:** Node.js 18+, npm/bun, Docker Desktop (for Temporal)

```bash
# Install dependencies
bun install

# Set up Convex (first time only)
npx convex dev
# This will:
# 1. Create a Convex project
# 2. Generate convex/ directory with schema
# 3. Start local Convex dev server

# In a new terminal, start local Temporal server
temporal server start-dev
# Or use Docker Compose (see LOCAL_DEVELOPMENT.md)

# In another terminal, start Temporal Workers
bun run workers/dev

# In another terminal, start Next.js frontend
bun run dev
# Frontend runs on localhost:3000
```

**For full local development setup**, see [LOCAL_DEVELOPMENT.md](./docs/LOCAL_DEVELOPMENT.md)

**Environment Variables:**
```env
# .env.local
CONVEX_DEPLOYMENT=dev:your-project-name  # Auto-generated by convex dev
NEXT_PUBLIC_CONVEX_URL=https://...       # Auto-generated
TEMPORAL_ADDRESS=localhost:7233          # Local Temporal server
TEMPORAL_NAMESPACE=default               # Temporal namespace
OPENAI_API_KEY=...                       # For AI routine parsing
```

## Plugin System

### Plugin Contract

Every plugin has a strongly-typed interface:

```typescript
interface Plugin {
  id: string;                    // 'alpaca-trading'
  name: string;                  // 'Alpaca Trading'
  version: string;               // '1.0.0'
  type: 'input' | 'processor' | 'logic' | 'output';
  inputSchema: JSONSchema;       // Typed inputs
  outputSchema: JSONSchema;      // Typed outputs
  credentials?: CredentialSchema; // API keys, tokens
  execute: (input, context) => Promise<output>;
}

// Note: Triggers are routine-level config, not plugins
interface Routine {
  id: string;
  trigger: { type: 'cron' | 'webhook' | 'manual' | 'event'; config: any };
  steps: PluginStep[];  // DAG of plugin nodes
}
```

### Type-Safe Connections

Plugins connect when types match. If they don't, insert an AI Processor:

```
Stock Price Input
  output: {symbol: string, price: number, timestamp: string}
      ↓
AI Processor (universal data adapter)
  instruction: "Transform to {ticker, currentPrice, action: 'buy'}"
      ↓
Trading Output
  input: {ticker: string, currentPrice: number, action: string}
```

**No complex field mapping needed** - AI handles all transformations!

### Marketplace

**Plugin Marketplace:**
- **Discover**: Browse plugins by category, rating, popularity
- **Publish**: Anyone can publish plugins (after review)
- **Install**: One-click install to your workspace
- **Version Control**: Semantic versioning with upgrade paths
- **Revenue Sharing**: Monetize your plugins (optional)

**Routine Marketplace:**
- **Share**: Publish routines as templates for others
- **Browse**: Discover pre-built routine templates
- **Install**: Draft routine from template, configure your credentials
- **Activate**: Enable routine when all plugins installed and credentials set
- **Privacy**: Templates contain structure only, no credentials shared

## Documentation

Comprehensive documentation is available in the [`docs/`](./docs) directory:

### Architecture & Design
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Plugin system, routine engine, Convex + Temporal Cloud architecture
- **[PLUGIN_DEVELOPMENT.md](./docs/PLUGIN_DEVELOPMENT.md)** - Build and publish plugins
- **[ROADMAP.md](./docs/ROADMAP.md)** - Long-term product vision and development phases
- **[TODO.md](./docs/TODO.md)** - Current sprint tasks and near-term work

## Development

```bash
# Terminal 1: Start Temporal server
temporal server start-dev

# Terminal 2: Start Convex backend
npx convex dev

# Terminal 3: Start Temporal Workers
bun run workers/dev

# Terminal 4: Start Next.js frontend
bun run dev

# Run Convex functions in development
npx convex run routines:create --args '{"name": "test"}'

# Test Temporal workflows (these execute user routines)
temporal workflow execute \
  --task-queue kianax-routines \
  --type routineExecutor \
  --workflow-id test-1

# View dashboards
# Convex: https://dashboard.convex.dev
# Temporal: http://localhost:8233

# Lint and format
bun run lint
bun run format

# Type check
bun run typecheck
```

## Core Principles

1. **Multi-Tenancy**: Every resource scoped to `user_id` - complete user isolation (Convex row-level security)
2. **Plugin Sandboxing**: Plugins run in isolated environments, cannot access other users' data
3. **Type Safety**: Plugins connect only when input/output schemas match
4. **AI-First**: Natural language and audio as primary routine creation interface
5. **Security First**: Backend validation, encrypted credentials, sandboxed execution
6. **Extensibility**: Anyone can build and publish plugins to the marketplace
7. **Real-Time**: Live updates via Convex subscriptions for instant routine execution feedback
8. **Serverless-First**: Zero DevOps, fully managed infrastructure via Convex + Temporal Cloud

## Contributing

### Important Rules

1. **⚠️ Do not push to remote unless explicitly requested (AI coding assistants only)**
   - This applies to AI tools like Claude Code
   - Always commit locally first
   - Wait for explicit approval before pushing
   - Use `git push origin main` only when asked

2. **📝 Always update documentation as you work**
   - Update `docs/TODO.md` when completing tasks
   - Update `docs/ROADMAP.md` if phases change
   - Keep documentation in sync with code changes
   - Document new features, APIs, and routines

### Git Workflow

**Recommended: Use feature branches for organization**

1. **Create a feature branch** for larger changes (optional but recommended):
   ```bash
   # Create and switch to a new branch
   git checkout -b feature/agent-execution
   git checkout -b fix/portfolio-calculation
   git checkout -b docs/update-deployment
   ```

2. **Make your changes** and commit with conventional commits

3. **Push to remote** (only when requested):
   ```bash
   # Push feature branch
   git push origin feature/agent-execution

   # Or push directly to main for smaller changes
   git push origin main
   ```

4. **After feature is complete**, merge and clean up branch:
   ```bash
   git checkout main
   git merge feature/agent-execution
   git push origin main
   git branch -d feature/agent-execution
   ```

### Commit Message Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(server): add agent execution engine
fix(web): correct portfolio calculation
docs: update deployment guide
chore(deps): update dependencies
```

**Types:** `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `ci`, `build`

## Security

- ✅ All routine execution happens server-side (Convex functions + Temporal Workers)
- ✅ Plugin sandboxing prevents unauthorized access
- ✅ API keys encrypted at rest (Convex encrypted fields)
- ✅ User data isolated per `user_id` (Convex authentication + row-level security)
- ✅ Rate limiting per user and per routine (Convex built-in)
- ✅ Audit logging for all routine executions (Convex function logs)
- ✅ Plugin code review before marketplace approval
- ✅ Credential scoping (plugins access only granted credentials)

**Security Model:**
- Plugins cannot access other users' data (enforced by Convex authentication context)
- Plugins cannot make network requests to arbitrary URLs (allowlist required)
- All plugin inputs/outputs validated against schemas (Convex validators)
- Execution timeouts prevent infinite loops (Convex function timeouts + Temporal activity timeouts)
- Resource quotas per user (Convex + Temporal Cloud limits)

## License

[Add your license here]

## Status

**Current Phase:** Phase 0 - Foundation

Recent milestones:
- ✅ Monorepo setup with Bun
- ✅ Next.js 16 frontend with shadcn/ui
- ✅ Comprehensive platform architecture redesign
- ✅ Migration to Convex (serverless backend + real-time database)
- ✅ Migration to Temporal Cloud (routine execution engine using Temporal workflows)
- 🚧 Next: Convex schema setup and Plugin SDK foundation

**Flagship Use Case:** AI-powered stock trading (proof-of-concept for plugin system)

**Platform Vision:** Universal routine orchestration with plugin marketplace where:
- Users describe routines in natural language
- Plugins provide data sources and actions
- AI powers intelligent decision-making
- Community builds and shares plugins

See [`docs/TODO.md`](./docs/TODO.md) for current tasks and [`docs/ROADMAP.md`](./docs/ROADMAP.md) for long-term vision.
