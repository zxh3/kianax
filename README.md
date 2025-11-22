# Kianax

**"Talk to Create Routines"** - An AI-native automation platform where users build workflows by describing them in natural language.

> **Status:** Phase 2 Complete (Routine Editor, Plugins, Execution Engine). Phase 3 (Triggers & AI) In Progress.

## Key Features

- **Visual Routine Editor:** Drag-and-drop interface built with ReactFlow to construct complex DAGs.
- **Natural Language Creation:** Chat with an AI agent to generate, modify, and execute routines instantly.
- **Plugin System:** Extensible builder pattern for creating Data Sources, Processors, Logic, and Actions.
- **Execution Engine:** Powered by **Temporal**, supporting conditional branching, loops, and reliable retries.
- **Real-Time Dashboard:** Live execution logs, node highlighting, and observability via **Convex**.
- **Secure & Multi-Tenant:** Row-level security and isolated environments for every user.

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind v4, shadcn/ui
- **Backend:** Convex (Serverless database & functions)
- **Workflow Engine:** Temporal (Reliable execution)
- **Auth:** Better Auth (Google OAuth + Email)
- **Language:** TypeScript (Monorepo with Turbo)

## Getting Started

### Prerequisites

- **Bun** (v1.2.23+)
- **Temporal CLI** (`brew install temporal`)

### Quick Start

1.  **Install dependencies:**
    ```bash
    bun install
    ```

2.  **Start development servers:**
    Open two separate terminal panes.

    **Pane 1 (Temporal Services):**
    ```bash
    bun run dev:temporal
    ```
    (This starts the Temporal Server on 7233 and Temporal UI on 8233.)

    **Pane 2 (Frontend & Backend Apps):**
    ```bash
    bun run dev:apps
    ```
    (This starts the Next.js app on 3000, Convex development server, and Temporal Workers.)

3.  **Setup Environment:**
    - Create a Convex project: `cd apps/server && npx convex dev`
    - Add credentials to `.env.local` files (see below).

### Environment Variables

Create `.env.local` in `apps/web`, `apps/server`, and `apps/workers`:

```bash
# apps/web/.env.local
NEXT_PUBLIC_CONVEX_URL=...
OPENAI_API_KEY=... # Required for Chat AI features

# apps/server/.env.local
CONVEX_URL=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# apps/workers/.env.local
TEMPORAL_ADDRESS=localhost:7233
CONVEX_URL=...
```

## Architecture

The project is a monorepo managed by Turbo:

- **`apps/web`**: Next.js frontend app.
- **`apps/server`**: Convex backend functions and database schema.
- **`apps/workers`**: Temporal workers that execute the routine logic.
- **`packages/plugins`**: The core plugin registry and definitions.
- **`packages/plugin-sdk`**: The builder SDK for creating new plugins.

## Contributing

We use [Conventional Commits](https://www.conventionalcommits.org/).

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `chore`: Maintenance tasks

---

**License:** MIT