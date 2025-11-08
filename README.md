# Kianax

An AI-native workflow orchestration platform where users build powerful automations by simply describing what they want. Extensible plugin marketplace lets you connect any data source to any action.

## Overview

**"Talk to Create Workflows"** - The only workflow platform where AI builds automations for you.

Kianax enables users to:
- **Create Workflows with Natural Language** - Describe what you want, AI builds it
- **Connect Any Data Source** - Twitter, Reddit, earnings reports, stock prices, RSS feeds
- **Trigger on Any Event** - Time-based, data changes, webhooks, custom events
- **Take Any Action** - Trade stocks, send emails/SMS, make phone calls, HTTP requests
- **Build with Plugins** - Extensible marketplace where anyone can publish plugins
- **Powered by AI** - LLM decision nodes for intelligent, context-aware workflows

Each user has complete data isolation with their own workflows, credentials, and execution history.

## Key Features

- 🤖 **AI-Powered Workflow Creation**: Describe workflows in plain English or audio
- 🧩 **Plugin Marketplace**: Extensible ecosystem - anyone can build and publish plugins
- 🔌 **Type-Safe Connections**: Plugins automatically connect when input/output types match
- 📊 **Multi-Source Data Ingestion**: Unify data from Twitter, Reddit, APIs, databases, and more
- 🎯 **Event-Driven Execution**: Cron schedules, webhooks, data changes, custom triggers
- 🔒 **Multi-Tenant Architecture**: Complete user isolation and sandboxed plugin execution
- 🔐 **Secure Credentials**: Encrypted API key storage per user
- 🌐 **Modern Stack**: Next.js 16, Convex (serverless backend), trigger.dev (workflows), Vercel

## Example Use Cases

### 1. AI-Powered Stock Trading (Flagship)
```
"When AAPL drops 5%, analyze recent news sentiment.
If positive, buy $1000 worth. If negative, wait."
```
**Workflow:** Cron Trigger → Stock Price Input → AI Processor (check if dropped 5%) → News Input → AI Processor (sentiment analysis) → Logic Condition → Trading Output

### 2. Social Media Monitoring
```
"When my company is mentioned on Reddit with negative sentiment,
send me an SMS alert."
```
**Workflow:** Webhook Trigger → Reddit Input → AI Processor (sentiment analysis) → Logic Condition → SMS Output

### 3. Earnings Alert System
```
"Every day at 4pm, check if any tech companies reported earnings.
Summarize with AI and email me."
```
**Workflow:** Cron Trigger → Earnings Input → AI Processor (summarize) → Email Output

### 4. Custom Business Automation
```
"When a new customer signs up, enrich their data from Clearbit,
add to Salesforce, and send welcome email."
```
**Workflow:** Webhook Trigger → Clearbit Input → AI Processor (format data) → Salesforce Output → AI Processor (generate email) → Email Output

## Tech Stack

**Frontend:** Next.js 16 (React 19), Tailwind CSS v4, shadcn/ui, React Flow (workflow editor)
**Backend:** Convex (managed database + serverless functions + real-time subscriptions)
**Workflow Execution:** trigger.dev (handles triggers, queues, retries, state persistence)
**Plugin Runtime:** trigger.dev tasks (sandboxed execution)
**Auth:** Convex Auth (built-in authentication)
**File Storage:** Convex file storage (for plugin code)
**Infrastructure:** Vercel (frontend), Convex (backend + database), trigger.dev (workflows)
**AI Services:** OpenAI (GPT-4 for workflow parsing, GPT-3.5 Turbo for AI Processor)

**Why Convex?**
- Zero DevOps: No PostgreSQL, Redis, or Kubernetes management
- Built-in real-time: Live workflow execution updates without WebSocket server
- TypeScript-native: Schema and functions defined in code, no migrations
- Serverless: Auto-scaling, pay-per-use
- Perfect for solo developers focusing on product, not infrastructure

## Project Structure

```
kianax/
├── app/                  # Next.js 16 app directory (frontend)
│   ├── page.tsx          # Homepage
│   ├── workflows/        # Workflow builder UI
│   ├── marketplace/      # Plugin marketplace
│   └── chat/             # AI chat interface
├── convex/               # Convex backend (database + functions)
│   ├── schema.ts         # Database schema (workflows, plugins, users)
│   ├── workflows.ts      # Workflow CRUD mutations/queries
│   ├── plugins.ts        # Plugin marketplace functions
│   ├── executions.ts     # Execution history queries
│   ├── auth.ts           # Convex Auth configuration
│   └── lib/
│       └── triggerdev.ts # trigger.dev integration
├── packages/
│   ├── ui/               # Shared React components (shadcn/ui)
│   ├── plugin-sdk/       # Plugin development SDK
│   └── typescript-config/
├── plugins/              # Core platform plugins (compiled to trigger.dev tasks)
│   ├── triggers/
│   │   ├── cron/         # Time-based triggers
│   │   ├── webhook/      # HTTP webhook triggers
│   │   └── manual/       # User-initiated triggers
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

**Prerequisites:** Node.js 18+, npm/bun

```bash
# Install dependencies
bun install

# Set up Convex (first time only)
npx convex dev
# This will:
# 1. Create a Convex project
# 2. Generate convex/ directory with schema
# 3. Start local Convex dev server

# In a new terminal, start Next.js frontend
bun run dev
# Frontend runs on localhost:3000

# That's it! No Docker, no databases to manage.
# Convex handles everything: database, real-time, auth, file storage
```

**Environment Variables:**
```env
# .env.local
CONVEX_DEPLOYMENT=dev:your-project-name  # Auto-generated by convex dev
NEXT_PUBLIC_CONVEX_URL=https://...       # Auto-generated
TRIGGER_DEV_API_KEY=...                  # From trigger.dev dashboard
OPENAI_API_KEY=...                       # For AI workflow parsing
```

## Plugin System

### Plugin Contract

Every plugin has a strongly-typed interface:

```typescript
interface Plugin {
  id: string;                    // 'alpaca-trading'
  name: string;                  // 'Alpaca Trading'
  version: string;               // '1.0.0'
  type: 'trigger' | 'input' | 'processor' | 'logic' | 'output';
  inputSchema: JSONSchema;       // Typed inputs
  outputSchema: JSONSchema;      // Typed outputs
  credentials?: CredentialSchema; // API keys, tokens
  execute: (input, context) => Promise<output>;
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

**Workflow Marketplace:**
- **Share**: Publish workflows as templates for others
- **Browse**: Discover pre-built workflow templates
- **Install**: Draft workflow from template, configure your credentials
- **Activate**: Enable workflow when all plugins installed and credentials set
- **Privacy**: Templates contain structure only, no credentials shared

## Documentation

Comprehensive documentation is available in the [`docs/`](./docs) directory:

### Architecture & Design
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Plugin system, workflow engine, Convex + trigger.dev architecture
- **[PLUGIN_DEVELOPMENT.md](./docs/PLUGIN_DEVELOPMENT.md)** - Build and publish plugins
- **[ROADMAP.md](./docs/ROADMAP.md)** - Long-term product vision and development phases
- **[TODO.md](./docs/TODO.md)** - Current sprint tasks and near-term work

## Development

```bash
# Start Convex backend (terminal 1)
npx convex dev

# Start Next.js frontend (terminal 2)
bun run dev

# Run Convex functions in development
npx convex run workflows:create --args '{"name": "test"}'

# View Convex dashboard (database, logs, functions)
# Opens at https://dashboard.convex.dev

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
4. **AI-First**: Natural language and audio as primary workflow creation interface
5. **Security First**: Backend validation, encrypted credentials, sandboxed execution
6. **Extensibility**: Anyone can build and publish plugins to the marketplace
7. **Real-Time**: Live updates via Convex subscriptions for instant workflow execution feedback
8. **Serverless-First**: Zero DevOps, fully managed infrastructure via Convex + trigger.dev

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
   - Document new features, APIs, and workflows

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

- ✅ All workflow execution happens server-side (Convex functions + trigger.dev)
- ✅ Plugin sandboxing prevents unauthorized access
- ✅ API keys encrypted at rest (Convex encrypted fields)
- ✅ User data isolated per `user_id` (Convex authentication + row-level security)
- ✅ Rate limiting per user and per workflow (Convex built-in)
- ✅ Audit logging for all workflow executions (Convex function logs)
- ✅ Plugin code review before marketplace approval
- ✅ Credential scoping (plugins access only granted credentials)

**Security Model:**
- Plugins cannot access other users' data (enforced by Convex authentication context)
- Plugins cannot make network requests to arbitrary URLs (allowlist required)
- All plugin inputs/outputs validated against schemas (Convex validators)
- Execution timeouts prevent infinite loops (Convex function timeouts + trigger.dev task timeouts)
- Resource quotas per user (Convex + trigger.dev limits)

## License

[Add your license here]

## Status

**Current Phase:** Phase 0 - Foundation

Recent milestones:
- ✅ Monorepo setup with Bun
- ✅ Next.js 16 frontend with shadcn/ui
- ✅ Comprehensive platform architecture redesign
- ✅ Migration to Convex (serverless backend + real-time database)
- ✅ Migration to trigger.dev (workflow execution engine)
- 🚧 Next: Convex schema setup and Plugin SDK foundation

**Flagship Use Case:** AI-powered stock trading (proof-of-concept for plugin system)

**Platform Vision:** Universal workflow orchestration with plugin marketplace where:
- Users describe workflows in natural language
- Plugins provide data sources and actions
- AI powers intelligent decision-making
- Community builds and shares plugins

See [`docs/TODO.md`](./docs/TODO.md) for current tasks and [`docs/ROADMAP.md`](./docs/ROADMAP.md) for long-term vision.
