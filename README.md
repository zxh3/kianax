# Kianax

A multi-tenant AI-powered stock trading platform where users create autonomous trading agents using natural language or visual workflows.

## Overview

Kianax enables users to:
- **Create AI Trading Agents** using plain English descriptions of strategies
- **Connect Broker Accounts** (Alpaca, Interactive Brokers)
- **Automate Trading** with agents that analyze markets and execute trades
- **Build Workflows** visually for advanced multi-agent strategies
- **Monitor Performance** with real-time dashboards and analytics

Each user has complete data isolation with their own portfolio, agents, and trading history.

## Key Features

- 🤖 **AI-Powered Agents**: GPT-4 and Claude integration for strategy interpretation
- 📊 **Real-Time Market Data**: Live quotes and WebSocket streaming via Polygon.io
- 🔒 **Multi-Tenant Architecture**: Complete user isolation and security
- 🎯 **Feature Flags**: Gradual rollouts and A/B testing with Statsig
- 🔐 **Authentication**: Secure auth with Better Auth (email/password + OAuth)
- 📈 **Live Trading**: Integration with Alpaca broker API
- 🌐 **Modern Stack**: Next.js 16, Fastify, PostgreSQL, Redis, Kubernetes

## Tech Stack

**Frontend:** Next.js 16 (React 19), Tailwind CSS v4, shadcn/ui
**Backend:** Fastify 5, Bun runtime, TypeScript
**Database:** PostgreSQL 16, Redis 7, Drizzle ORM
**Infrastructure:** AWS EKS, RDS, ElastiCache
**External Services:** Polygon.io (market data), Alpaca (broker), OpenAI/Anthropic (AI)

## Project Structure

```
kianax/
├── apps/
│   ├── web/          # Next.js 16 frontend
│   └── server/       # Fastify backend API
├── packages/
│   ├── ui/           # Shared React components
│   ├── db/           # Database schema & migrations
│   └── typescript-config/
└── docs/             # Documentation
    ├── ARCHITECTURE.md
    ├── DEPLOYMENT.md
    ├── KUBERNETES.md
    ├── LOCAL_DEVELOPMENT.md
    ├── MICROSERVICES.md
    └── TODO.md
```

## Quick Start

**Prerequisites:** Bun 1.2.23+, Docker (for local PostgreSQL/Redis)

```bash
# Install dependencies
bun install

# Start databases
docker-compose up -d

# Run database migrations
cd packages/db && bun run db:migrate

# Start all services
bun run dev

# Or start individually:
bun run dev --filter=web      # Frontend on :3000
bun run dev --filter=server   # Backend on :3001
```

## Documentation

Comprehensive documentation is available in the [`docs/`](./docs) directory:

### Architecture & Design
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System design, user flows, multi-tenant model
- **[MICROSERVICES.md](./docs/MICROSERVICES.md)** - Service boundaries, communication patterns, migration strategy
- **[ROADMAP.md](./docs/ROADMAP.md)** - Long-term product vision and development phases
- **[TODO.md](./docs/TODO.md)** - Current sprint tasks and near-term work

### Deployment & Operations
- **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - AWS EKS deployment guide with Terraform, CI/CD, monitoring
- **[KUBERNETES.md](./docs/KUBERNETES.md)** - Kubernetes operations, kubectl commands, debugging
- **[LOCAL_DEVELOPMENT.md](./docs/LOCAL_DEVELOPMENT.md)** - Local testing with Docker Compose, Minikube, Kind, Tilt

## Development

```bash
# Lint code
bun run lint

# Format code
bun run format

# Type check
bun run typecheck

# Build all apps
bun run build
```

## Core Principles

1. **Multi-Tenancy**: Every resource scoped to `user_id` - complete user isolation
2. **Security First**: Backend validation, encrypted credentials, audit logging
3. **Real-Time**: WebSocket for live market data and trade notifications
4. **Scalable**: Microservices architecture ready for horizontal scaling

## Contributing

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

3. **Push to remote**:
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

- ✅ All trading logic validated server-side
- ✅ Broker API keys encrypted at rest (AES-256)
- ✅ User data isolated per `user_id`
- ✅ Rate limiting per user
- ✅ Audit logging for all trades

Never expose broker API keys or user credentials to the frontend.

## License

[Add your license here]

## Status

**Current Phase:** Phase 0 - Foundation

Recent milestones:
- ✅ Monorepo setup with Turborepo + Bun
- ✅ Database package with Drizzle ORM
- ✅ Basic Fastify server with health endpoints
- ✅ Next.js 16 frontend with shadcn/ui
- ✅ Docker Compose for local development
- ✅ Comprehensive documentation
- 🚧 Next: Database connection & user CRUD API

See [`docs/TODO.md`](./docs/TODO.md) for current tasks and [`docs/ROADMAP.md`](./docs/ROADMAP.md) for long-term vision.
