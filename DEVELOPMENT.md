# Development Guide

## Quick Start

Start the entire development environment with a single command:

```bash
bun dev
```

This starts **all services** in parallel:
- ⚡ **Temporal Server** (localhost:7233)
- 🔧 **Convex Backend** (apps/server)
- 🌐 **Next.js Web App** (localhost:3000)
- 👷 **Temporal Workers** (apps/workers)

All processes run concurrently with colored output and will auto-restart on file changes.

## What's Running

When you run `bun dev`, these services start:

| Service | Location | Port | Purpose |
|---------|----------|------|---------|
| Temporal Server | Local | 7233 | Workflow orchestration |
| Temporal UI | http://localhost:8233 | 8233 | Workflow debugging |
| Convex Backend | apps/server | N/A | Serverless backend + DB |
| Next.js Web | apps/web | 3000 | Frontend application |
| Temporal Workers | apps/workers | N/A | Execute workflows |

## Individual Services

You can also run services individually:

```bash
# Start only Temporal server
bun run dev:temporal

# Start only app dev servers (without Temporal)
bun run dev:apps

# Or go into specific apps
cd apps/web
bun dev              # Next.js only

cd apps/workers
bun dev              # Workers only

cd apps/server
bun dev              # Convex only
```

## Stopping Services

Press `Ctrl+C` to stop all services. The `--kill-others` flag ensures all processes stop together.

## Prerequisites

Make sure you have these installed:

- **Bun** (v1.2.23 or later)
- **Temporal CLI** - Install with:
  ```bash
  # macOS
  brew install temporal

  # Or download from https://docs.temporal.io/cli
  ```

## First Time Setup

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your keys
   ```

3. **Start development:**
   ```bash
   bun dev
   ```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    bun dev (root)                       │
└─────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
        ┌───────▼────────┐      ┌──────▼──────┐
        │ Temporal Server │      │ Turbo (apps)│
        │  (port 7233)    │      └──────┬──────┘
        └────────────────┘              │
                                        │
                        ┌───────────────┼───────────────┐
                        │               │               │
                  ┌─────▼─────┐  ┌──────▼──────┐ ┌─────▼─────┐
                  │  Convex    │  │   Next.js   │ │  Workers  │
                  │  Backend   │  │  (port 3000)│ │ (Temporal)│
                  └────────────┘  └─────────────┘ └───────────┘
```

## Troubleshooting

### Temporal Server Won't Start

```bash
# Check if Temporal is already running
ps aux | grep temporal

# Kill existing Temporal processes
pkill -f temporal

# Try starting again
bun dev
```

### Port Already in Use

```bash
# Check what's using port 3000 (Next.js)
lsof -ti:3000

# Kill the process
kill -9 $(lsof -ti:3000)
```

### Workers Can't Connect to Temporal

Make sure Temporal server started successfully. Check the blue-colored "temporal" output in your terminal.

## Tips

- **Turbo TUI**: The development dashboard shows all running services with their logs
- **Hot Reload**: All services support hot reload - just save your files
- **Parallel Logs**: Use the color-coded logs to identify which service is logging:
  - 🔵 Blue = Temporal
  - 🟣 Magenta = Turbo (apps)

## Production

For production deployment:

```bash
# Build all apps
bun run build

# Deploy to Vercel (frontend), Convex (backend), Temporal Cloud (workers)
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed production setup.
