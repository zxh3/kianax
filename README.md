# Kianax

**Kianax: Your AI Automation Co-pilot.** Design, automate, and orchestrate custom routines for any task, all powered by natural language.

## Key Features

- **Visual Routine Editor:** Drag-and-drop interface built with ReactFlow to construct complex DAGs.
- **Natural Language Creation:** Chat with an AI agent to generate, modify, and execute routines instantly.
- **Plugin System:** Extensible builder pattern for creating Data Sources, Processors, Logic, and Actions with built-in schema validation.
- **Secure Credential Management:** Centralized vault for API keys and OAuth2 tokens (e.g., OpenAI, Google), securely encrypted and injected into plugins at runtime.
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
OPENAI_API_KEY=... # Required for the "Chat with AI" feature (Routine generation)

# apps/server/.env.local
CONVEX_URL=...
GOOGLE_CLIENT_ID=...     # For User Authentication (Better Auth)
GOOGLE_CLIENT_SECRET=... # For User Authentication (Better Auth)

# apps/workers/.env.local
TEMPORAL_ADDRESS=localhost:7233
CONVEX_URL=...
```

> **Note:** Credentials for plugins (e.g., your personal OpenAI API Key for routine nodes, Google Calendar tokens) are managed securely within the **Kianax Dashboard** under Settings > Credentials, not in `.env` files.

## Architecture

The project is a monorepo managed by Turbo:

- **`apps/web`**: Next.js frontend app.
- **`apps/server`**: Convex backend functions and database schema.
- **`apps/workers`**: Temporal workers that execute the routine logic.
- **`packages/plugins`**: The core plugin registry and definitions.
- **`packages/plugin-sdk`**: The builder SDK for creating new plugins.

## For Coding Agents

If you are an AI coding assistant (Claude Code, Gemini CLI, etc.) working on this repository:

1.  **Do not commit changes automatically.** Only commit when explicitly instructed by the user.
2.  **After making changes:** Run the formatter to ensure consistent style.
    ```bash
    bun run format
    ```
3.  **Before proposing a commit:** Run linting and type checking to catch errors.
    ```bash
    bun run lint
    bun run typecheck
    ```
4.  **Fixing issues:** If linting fails, try running `bunx @biomejs/biome check --write .` to automatically fix supported issues.

## Contributing

We use [Conventional Commits](https://www.conventionalcommits.org/).

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `chore`: Maintenance tasks
