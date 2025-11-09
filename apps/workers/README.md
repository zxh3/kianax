# @kianax/workers

Temporal workers for executing Kianax workflows.

## Overview

Workers poll Temporal server for workflow tasks and execute:
- **Workflows** - Orchestration logic (deterministic, runs in V8 sandbox)
- **Activities** - External operations (plugin execution, Convex updates, API calls)

## Development

```bash
# Start Temporal dev server (Terminal 1)
temporal server start-dev

# Start worker (Terminal 2)
cd apps/workers
bun install
bun run dev
```

## Production

```bash
# Build
bun run build

# Start
bun run start
```

## Structure

```
src/
├── workflows/          # Workflow definitions
│   ├── user-workflow-executor.ts  # Generic DAG executor
│   └── index.ts
├── activities/         # Activity implementations
│   ├── plugins/        # Plugin execution
│   ├── convex/         # Convex integration
│   └── index.ts
├── worker.ts           # Production entry point
└── dev-worker.ts       # Development entry point
```

## How It Works

1. User creates workflow in dashboard (Convex mutation)
2. Convex calls Temporal client to start workflow
3. Worker polls Temporal and picks up workflow task
4. Workflow executes DAG by calling activities
5. Activities execute plugins and update Convex
6. Results stored in Convex for real-time updates

## Environment Variables

See `.env.example` for required configuration.
