# Kianax

**"Talk to Create Routines"** - An AI-native automation platform where users build routines by describing them in natural language.

> **⚠️ Early Development:** Phase 2 complete (Plugin System & Routine Foundation). Frontend UI with visual routine editor now functional. See [Current Status](#status).

## Vision

Connect any data source to any action through an extensible plugin marketplace. Users describe routines in plain English, AI builds them, and plugins provide the capabilities.

**Example Future Routine:**
```
"When AAPL drops 5%, analyze news sentiment. If positive, buy $1000."
```
This creates: Stock Price Monitor → AI Analysis → Conditional Logic → Trading Action

## Current Status

**Phase 0-1: Foundation & Auth** ✅ **Complete**
**Phase 2: Plugin System & Routine Foundation** ✅ **Complete**

**What's Working:**
- ✅ Next.js 16 + React 19 with shadcn/ui + Tailwind CSS v4
- ✅ Convex backend (serverless functions + real-time DB)
- ✅ Better Auth with Google OAuth + email/password
- ✅ Dashboard with `/dashboard/routines`, `/dashboard/plugins`, `/dashboard/marketplace`
- ✅ Visual routine editor with ReactFlow (node-based DAG builder)
- ✅ Plugin system with builder pattern (7 plugins: data sources, processors, logic, actions)
- ✅ Plugin marketplace UI with install/uninstall/enable/disable
- ✅ Routine CRUD (create, read, update, delete, list) with real-time updates
- ✅ Temporal workflow execution engine with conditional branching + loops
- ✅ Execution tracking (node results, status, observability)
- ✅ E2E test infrastructure
- ✅ Single-command dev (`bun dev`)
- ✅ Bun monorepo with Turbo

**Next Up (Phase 3):**
- 📋 Trigger system (manual, cron, webhook, event)
- 📋 Plugin credential management UI
- 📋 AI-powered routine creation (Phase 5)
- 📋 Production deployment (Phase 4)

See [docs/TODO.md](./docs/TODO.md) for detailed current tasks and [docs/ROADMAP.md](./docs/ROADMAP.md) for long-term vision.

## Tech Stack

| Layer | Technology | Why? |
|-------|-----------|------|
| **Frontend** | Next.js 16, React 19, Tailwind v4, shadcn/ui, ReactFlow | Modern DX, server components |
| **Backend** | Convex | Zero DevOps, real-time subscriptions, TypeScript-native |
| **Auth** | Better Auth | OAuth + email/password, Convex integration |
| **Execution** | Temporal | User-defined routine execution at runtime |
| **Workers** | TypeScript | Execute routine logic as Temporal Activities |
| **AI** | OpenAI (planned) | Routine generation from natural language |
| **Infra** | Vercel + Convex + Temporal | Fully managed, auto-scaling |

**Why Temporal?** Purpose-built for user-defined execution graphs. Battle-tested by Uber, Netflix, Stripe. Handles retries, timeouts, versioning.

**Why Convex?** No PostgreSQL/Redis/K8s. Built-in real-time, TypeScript schemas, instant API generation.

## Getting Started

### Prerequisites

- **Bun** (v1.2.23+) - [Install](https://bun.sh)
- **Temporal CLI** - `brew install temporal` (macOS) or [download](https://docs.temporal.io/cli)

### Quick Start

```bash
# Install dependencies
bun install

# Start everything with one command! 🚀
bun dev
```

This starts all services in parallel with color-coded logs:

| Service | Port | Purpose |
|---------|------|---------|
| ⚡ Temporal Server | 7233 | Workflow orchestration |
| 🔧 Temporal UI | [8233](http://localhost:8233) | Workflow debugging |
| 🗄️ Convex Backend | N/A | Serverless backend + database |
| 🌐 Next.js Web | [3000](http://localhost:3000) | Frontend application |
| 👷 Temporal Workers | N/A | Execute workflows |

### Environment Variables

```bash
# .env.local (apps/web)
NEXT_PUBLIC_CONVEX_URL=https://...    # From convex dev
CONVEX_DEPLOYMENT=dev:your-project    # From convex dev
SITE_URL=http://localhost:3000        # Local dev URL

# .env.local (apps/server)
CONVEX_URL=https://...                # Same as web
GOOGLE_CLIENT_ID=...                  # OAuth (optional)
GOOGLE_CLIENT_SECRET=...              # OAuth (optional)
SITE_URL=http://localhost:3000

# .env.local (apps/workers)
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
CONVEX_URL=https://...                # Same as web

# .env.local (apps/scripts)
CONVEX_URL=https://...                # Same as web
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
```

### Development Commands

```bash
# Start everything
bun dev

# Start only Temporal
bun run dev:temporal

# Start only apps
bun run dev:apps

# Build all apps
bun run build

# Lint and format
bun run lint
bun run format

# Type check
bun run typecheck

# Run Convex functions
cd apps/server
npx convex run users:getCurrentUser

# Test routine execution (E2E with Convex + Temporal)
cd apps/scripts
bun run test:routine:simple        # Test simple 2-node routine
bun run test:routine:conditional   # Test conditional branching

# Test Temporal workflows directly
temporal workflow execute \
  --task-queue default \
  --type routineExecutor \
  --workflow-id test-1
```

### Troubleshooting

**Temporal won't start:**
```bash
ps aux | grep temporal
pkill -f temporal
```

**Port already in use:**
```bash
lsof -ti:3000
kill -9 $(lsof -ti:3000)
```

**Workers can't connect:** Check the blue "temporal" output to ensure Temporal started successfully.

### First Time Setup

1. **Start Convex:**
   ```bash
   cd apps/server
   npx convex dev
   # Follow prompts to create account/project
   # Copy URLs to .env.local files
   ```

2. **Configure OAuth (optional):**
   - Create Google OAuth app
   - Add credentials to `.env.local`

3. **Start development:**
   ```bash
   bun dev
   ```

4. **Visit app:**
   - http://localhost:3000
   - Sign in with Google or email
   - Access dashboard

## Architecture

### Project Structure

```
kianax/
├── apps/
│   ├── web/              # Next.js frontend
│   │   └── app/          # App router pages
│   │       └── dashboard/# Protected dashboard routes
│   ├── server/           # Convex backend
│   │   └── convex/       # Database schema + functions
│   ├── workers/          # Temporal Workers
│   │   ├── workflows/    # Workflow definitions
│   │   └── activities/   # Activity implementations
│   └── scripts/          # Test scripts and utilities
├── packages/
│   ├── shared/           # Shared types (Temporal, etc.)
│   ├── ui/               # Shared React components (shadcn/ui)
│   └── typescript-config/# Shared TypeScript configs
└── docs/                 # Documentation
    ├── ARCHITECTURE.md   # System design
    ├── ROADMAP.md        # Product vision
    ├── TODO.md           # Current tasks
    └── TEMPORAL.md       # Temporal implementation
```

### Development Flow

```
┌─────────────────────────────────────────────┐
│            bun dev (root)                   │
└─────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
  ┌─────▼─────┐         ┌──────▼──────┐
  │ Temporal  │         │ Turbo (apps)│
  │  (7233)   │         └──────┬──────┘
  └───────────┘                │
                ┌──────────────┼──────────────┐
                │              │              │
          ┌─────▼────┐   ┌─────▼────┐  ┌─────▼────┐
          │  Convex  │   │ Next.js  │  │ Workers  │
          │ Backend  │   │  (3000)  │  │(Temporal)│
          └──────────┘   └──────────┘  └──────────┘
```

## System Architecture

### Routine System

**Triggers** (routine-level configuration - Phase 3):
- **Manual** - User-initiated ✅ (implemented)
- **Cron** - Time-based schedules (planned)
- **Webhook** - HTTP events (planned)
- **Event** - Platform events (planned)

**Node Types** (plugin DAG):
1. **Data Sources** - Fetch data (APIs, databases, files) - 2 plugins ✅
2. **Processors** - Transform data (AI, computation, parsing) - 1 plugin ✅
3. **Logic** - Control flow (if/else, loops, error handling) - 1 plugin ✅
4. **Actions** - Perform actions (APIs, notifications, integrations) - 3 plugins ✅

**Type-Safe Connections:** ✅
- ReactFlow visual editor with drag-and-drop connections
- Zod schema validation for inputs/outputs
- Runtime type checking during execution

### Future Plugin Examples

**Data Sources** (Planned):
- Stock prices (Polygon.io)
- Twitter/X monitoring
- Reddit tracking
- RSS feeds
- Web scraping

**Actions** (Planned):
- Trading (Alpaca)
- Email (SendGrid)
- SMS (Twilio)
- HTTP requests
- Slack/Discord

**AI Processing** (Planned):
- Sentiment analysis
- Summarization
- Classification
- Data transformation

## Core Principles

1. **Iteration Speed** - Ship fast, learn fast, improve fast
2. **AI-First** - Natural language as primary interface (when ready)
3. **Plugin-Driven** - Community builds the ecosystem (when ready)
4. **Serverless-First** - Zero infrastructure management
5. **Real-Time Native** - Live updates everywhere
6. **User-Centric** - Simple beats powerful

## Security (Planned)

- 🔒 Server-side execution only
- 🔒 Plugin sandboxing
- 🔒 Encrypted credentials
- 🔒 Row-level user isolation
- 🔒 Rate limiting
- 🔒 Schema validation
- 🔒 Audit logging

## Contributing

### Git Workflow

**For AI assistants:**
- ⚠️ **Never push to remote** unless explicitly requested
- Always commit locally first
- Wait for approval before pushing

**Commit Convention:** [Conventional Commits](https://www.conventionalcommits.org/)

```bash
feat(server): add workflow CRUD functions
fix(web): correct auth redirect
docs: update architecture docs
chore(deps): update dependencies
```

**Types:** `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `ci`, `build`

## Documentation

- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System design and technical architecture
- **[ROADMAP.md](./docs/ROADMAP.md)** - Product vision and development phases
- **[TODO.md](./docs/TODO.md)** - Current sprint tasks
- **[TEMPORAL.md](./docs/TEMPORAL.md)** - Temporal implementation details

## Roadmap Highlights

- **Phase 0-1:** Foundation & Auth ✅ (Complete)
- **Phase 2:** Plugin SDK & Routine Foundation ✅ (Complete)
  - Plugin system with builder pattern
  - Visual routine editor (ReactFlow)
  - Marketplace UI
  - 7 working plugins
- **Phase 3:** Trigger System & Production (Next, 2-3 weeks)
  - Cron scheduling
  - Webhook triggers
  - Event-based triggers
  - Credential management UI
- **Phase 4:** Core Plugins (3-4 weeks)
  - Real APIs (stock prices, weather, etc.)
  - Trading integrations
  - Communication plugins
- **Phase 5:** AI Routine Creation (3-4 weeks)
  - Natural language → routine DAG
  - AI-powered node configuration
- **Phase 6:** Plugin Marketplace V2 (2-3 weeks)
  - Community plugins
  - Plugin versioning
  - Plugin reviews/ratings

See [ROADMAP.md](./docs/ROADMAP.md) for full timeline and details.

## License

[Add your license here]

---

**Status:** Phase 2 Complete | **Next:** Trigger System & Production Deployment

Built with Next.js, Convex, Better Auth, Temporal, and ReactFlow
