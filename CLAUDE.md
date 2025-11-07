# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Kianax** is a multi-tenant AI-powered stock trading platform where users create autonomous trading agents using natural language or visual workflows.

### What This Platform Does

- Users sign up and connect their broker accounts (Alpaca, IBKR)
- Users create AI agents by describing strategies in plain English
- Agents analyze market data and execute trades automatically
- Each user has complete isolation - own portfolio, agents, and data
- Advanced users can build multi-agent workflows visually

### Key Architectural Principles

1. **Multi-Tenancy**: Every resource (agents, portfolios, orders) is scoped to `user_id`
2. **User Isolation**: Users cannot see or affect each other's data
3. **Backend-Only Logic**: All trading decisions and validations happen server-side
4. **Real-Time Updates**: WebSocket for live market data and trade notifications

### Documentation

For detailed architecture and implementation plan:
- **`docs/ARCHITECTURE.md`**: High-level system design, user flows, multi-tenant model
- **`docs/TODO.md`**: 10-phase implementation roadmap (12-16 weeks)

## Architecture

### Monorepo Structure

- **apps/web**: Next.js 16 application (frontend for users)
- **apps/server**: Fastify backend (API, trading engine, AI agents)
- **packages/ui**: Shared React component library (`@kianax/ui`) based on shadcn/ui
- **packages/typescript-config**: Shared TypeScript configurations
- **docs/**: Architecture and implementation planning

### Backend (apps/server)

Fastify server handling:
- Authentication (JWT tokens)
- REST API for trading operations
- WebSocket server for real-time data
- AI agent execution (LLM integration)
- Broker integration (Alpaca, IBKR)
- PostgreSQL + Redis for data

**Key Backend Concepts:**
- All API routes filter by authenticated `user_id`
- Agent executions belong to specific users
- Orders routed to user's broker account
- Market data cached and shared across users

### Frontend (apps/web)

Next.js application with:
- User authentication flows
- Trading terminal with live charts
- Agent builder (natural language + visual)
- Portfolio dashboard
- Real-time WebSocket updates

### UI Package Architecture

The `@kianax/ui` package is a component library with specific export patterns:

```
exports:
  "./globals.css" → src/styles/globals.css
  "./postcss.config" → postcss.config.mjs
  "./lib/*" → src/lib/*.ts
  "./components/*" → src/components/*.tsx
  "./hooks/*" → src/hooks/*.ts
```

Components are built on:
- Radix UI primitives for accessible components
- Tailwind CSS v4 with PostCSS
- `class-variance-authority` for variant management
- `cn()` utility function (clsx + tailwind-merge) in `src/lib/utils.ts`

### Technology Stack

**Frontend:**
- **Runtime**: Bun 1.2.23
- **Framework**: Next.js 16 with Turbopack
- **React**: v19.2.0
- **Styling**: Tailwind CSS v4 via PostCSS
- **UI Components**: shadcn/ui (new-york style) with Radix UI
- **Forms**: react-hook-form + zod validation
- **Icons**: lucide-react

**Backend:**
- **Framework**: Fastify 5.2
- **Runtime**: Bun 1.2.23
- **Language**: TypeScript 5.9.2
- **WebSocket**: Native ws or socket.io
- **Validation**: Zod

**Database:**
- **Primary**: PostgreSQL 16
- **Cache**: Redis 7
- **ORM**: Prisma (planned)

**External Services:**
- **Market Data**: Polygon.io (REST + WebSocket)
- **Broker**: Alpaca (primary), IBKR (future)
- **LLM**: OpenAI (GPT-4), Anthropic (Claude)

**Tooling:**
- **Linting/Formatting**: Biome 2.2.5
- **Build System**: Turborepo 2.5.8

## Common Commands

### Development

```bash
# Run all apps in development mode (web + server)
bun run dev

# Run specific app
turbo dev --filter=web
turbo dev --filter=server

# Run web app directly (port 3000)
cd apps/web && bun run dev

# Run server directly (port 3001)
cd apps/server && bun run dev
```

### Building

```bash
# Build all packages and apps
bun run build

# Build specific app
turbo build --filter=web
turbo build --filter=server
```

### Code Quality

```bash
# Lint all packages (uses Biome)
bun run lint

# Format code (uses Biome)
bun run format

# Type check all packages
bun run typecheck

# Lint and fix specific app
cd apps/web && bun run lint:fix
cd apps/server && bun run lint:fix
```

### Database (Future)

```bash
# Generate Prisma client
cd apps/server && bunx prisma generate

# Run migrations
cd apps/server && bunx prisma migrate dev

# Open Prisma Studio
cd apps/server && bunx prisma studio
```

## Development Notes

### Multi-Tenant Development Guidelines

When working on features, always ensure:

1. **User Isolation**: All database queries filter by `user_id`
2. **No Cross-User Access**: Users can only see their own data
3. **Backend Validation**: Never trust frontend input
4. **Audit Logging**: Log all trades and agent executions

Example:
```typescript
// ❌ BAD - No user filtering
const agents = await db.agents.findMany();

// ✅ GOOD - Filter by authenticated user
const agents = await db.agents.findMany({
  where: { user_id: req.user.id }
});
```

### Agent System

Users create agents that trade autonomously. Each agent has:
- **Owner** (`user_id`) - Who created it
- **Strategy** (natural language prompt OR visual workflow)
- **Risk Limits** (max position size, daily trades, allocation)
- **Triggers** (when to run: time, price, news)
- **Status** (active or paused)

When an agent executes:
1. Trigger fires (e.g., scheduled time)
2. Build context (user's portfolio + market data)
3. Call LLM (GPT-4 or Claude) with strategy prompt
4. Parse decision (buy/sell/hold)
5. Validate against user's balance and risk limits
6. Execute on user's broker account
7. Log execution and notify user

### Biome Configuration

Biome is configured in `biome.json` with:
- Double quotes for JavaScript/TypeScript
- Space indentation
- Import type enforcement disabled (`useImportType: "off"`)
- Auto organize imports disabled
- Ignores `.next`, `.turbo`, `dist` directories

### Turborepo Task Dependencies

Tasks defined in `turbo.json`:
- `build`: depends on `^build` (builds dependencies first)
  - Outputs: `.next/**`, `dist/**`
- `lint`: depends on `^lint`
- `typecheck`: depends on `^typecheck`
- `dev`: no cache, persistent task

### Package Manager

This project uses Bun. Workspaces are configured in root `package.json`:
- `apps/*`
- `packages/*`

Always use `bun` commands, not npm/yarn/pnpm.

### TypeScript Configuration

Shared configs in `packages/typescript-config`:
- `base.json`: Base TypeScript config
- `nextjs.json`: Next.js-specific config (for apps/web)
- `react-library.json`: React library config (for packages/ui)

Backend (`apps/server`) uses `base.json` with ESM configuration.

### Working with UI Components

When modifying or adding components to `@kianax/ui`:
1. Components are in `packages/ui/src/components/`
2. Use the `cn()` utility for className merging
3. Follow Radix UI patterns for primitives
4. Export via the package.json exports field
5. Components use React Server Components (rsc: true)

### Import Aliases

When working in the UI package, use these aliases (defined in components.json):
- `@kianax/ui/components` → components
- `@kianax/ui/lib/utils` → utils
- `@kianax/ui/hooks` → hooks
- `@kianax/ui/lib` → lib

### Adding UI Components

The UI package uses shadcn/ui. Component configuration is in `packages/ui/components.json`:
- Style: new-york
- Base color: neutral
- CSS variables enabled
- Icon library: lucide-react

To add new shadcn components, use the CLI from the UI package directory.

### Backend API Structure

Server routes follow this pattern:

```
apps/server/src/
├── routes/
│   ├── auth.ts         # Authentication endpoints
│   ├── agents.ts       # Agent CRUD (filtered by user_id)
│   ├── orders.ts       # Order management (user-scoped)
│   ├── portfolio.ts    # Portfolio data (user-scoped)
│   └── market.ts       # Market data (shared across users)
├── services/
│   ├── llm.service.ts      # LLM integration (OpenAI/Anthropic)
│   ├── broker.service.ts   # Broker API client
│   └── trading.service.ts  # Trading engine
└── index.ts            # Fastify server setup
```

## Git Workflow

### Commit Message Convention

This project follows Conventional Commits format:

```
<type>(<scope>): <description>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `chore`: Maintenance tasks, dependency updates
- `docs`: Documentation changes
- `refactor`: Code refactoring without feature changes
- `style`: Code style/formatting changes
- `test`: Test additions or modifications
- `perf`: Performance improvements
- `ci`: CI/CD configuration changes
- `build`: Build system or dependency changes

**Scope (optional):** The affected package or area (e.g., `web`, `server`, `ui`)

**Examples:**
- `feat(server): add agent execution engine`
- `feat(web): add agent builder UI`
- `fix(server): validate user_id in agent queries`
- `docs: update architecture with multi-tenant design`

### Branch Strategy

The main branch is `main`. Use feature branches for development.

## Testing Workflow

### Start Development Environment

```bash
# Terminal 1: Start web app
cd apps/web && bun run dev

# Terminal 2: Start backend server
cd apps/server && bun run dev

# Terminal 3: Start PostgreSQL (if using Docker)
docker-compose up postgres

# Terminal 4: Start Redis (if using Docker)
docker-compose up redis
```

Web app: http://localhost:3000
Backend API: http://localhost:3001
Health check: http://localhost:3001/health

## Security Reminders

When implementing features:

1. **Never expose broker API keys to frontend**
2. **Always validate on backend, never trust frontend**
3. **Filter all queries by authenticated user_id**
4. **Encrypt sensitive data (API keys, passwords)**
5. **Use HTTPS/WSS in production**
6. **Implement rate limiting per user**
7. **Log all critical operations (trades, agent executions)**

## Current Status

Recent activity:
- ✅ Monorepo set up with Turborepo + Bun
- ✅ UI package created with shadcn/ui components
- ✅ Fastify server initialized
- ✅ Architecture docs completed (ARCHITECTURE.md, TODO.md)
- 🚧 Next: Phase 1 - Multi-user foundation (auth, database)

See `docs/TODO.md` for full implementation roadmap.

---

**Last Updated:** 2025-01-06
