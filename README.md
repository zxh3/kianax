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

Each app has its own `.env.local` file:

```bash
# Web app
cp apps/web/.env.example apps/web/.env.local

# Workers
cp apps/workers/.env.example apps/workers/.env.local
```

| App | File | Key Variables |
|-----|------|---------------|
| **web** | `apps/web/.env.local` | `NEXT_PUBLIC_CONVEX_URL`, `TEMPORAL_*`, `SITE_URL`, `OPENAI_API_KEY` |
| **workers** | `apps/workers/.env.local` | `CONVEX_URL`, `TEMPORAL_*`, `TASK_QUEUE` |
| **server** | Convex dashboard | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SITE_URL` |

For Convex server functions, set env vars via CLI:
```bash
npx convex env set GOOGLE_CLIENT_ID <value>
npx convex env set GOOGLE_CLIENT_SECRET <value>
```

> **Note:** Plugin credentials (e.g., Google Calendar tokens) are managed in the **Kianax Dashboard** under Settings > Credentials.

## Architecture

The project is a monorepo managed by Turbo:

- **`apps/web`**: Next.js frontend app.
- **`apps/server`**: Convex backend functions and database schema.
- **`apps/workers`**: Temporal workers that execute the routine logic.
- **`packages/config`**: Centralized env var loading and validation.
- **`packages/plugins`**: The core plugin registry and definitions.
- **`packages/plugin-sdk`**: The builder SDK for creating new plugins.

## Development Workflow

We use a **feature branch workflow** to maintain code quality and enable easy review/rollback.

### Branch Naming

```
feat/short-description      # New features
fix/short-description       # Bug fixes
refactor/short-description  # Code refactoring
docs/short-description      # Documentation
chore/short-description     # Maintenance tasks
```

### When to Use Feature Branches

| Change Type | Feature Branch? |
|-------------|-----------------|
| New feature | Yes |
| Bug fix (multi-file) | Yes |
| Refactoring | Yes |
| Simple typo fix | No (direct to main OK) |

### Workflow

1. Create a branch: `git checkout -b feat/my-feature`
2. Make changes and commit as you work
3. Run checks: `bun run format && bun run typecheck`
4. Push: `git push -u origin feat/my-feature`
5. Create PR for review
6. Squash merge to main

### Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `chore`: Maintenance tasks
- `perf`: Performance improvements

## For Coding Agents

If you are an AI coding assistant (Claude Code, Cursor, etc.) working on this repository:

### Git Workflow

1. **Use feature branches** for non-trivial tasks:
   ```bash
   git checkout -b feat/task-name
   ```
2. **Commit as you work** on the feature branch
3. **Push and create PR** when done - never merge directly to main
4. **Direct commits to main** are OK only for trivial fixes or when user explicitly requests

### Creating Pull Requests

When creating PRs, follow the template in `.github/pull_request_template.md`:

```bash
gh pr create --title "type: description" --body "$(cat <<'EOF'
## Summary
- What this PR does (1-3 bullets)

## Type of Change
- [x] `feat` / `fix` / `refactor` / `docs` / `chore`

## Test Plan
- How you verified it works

---
🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Code Quality

1. **Run formatter** after making changes:
   ```bash
   bun run format
   ```
2. **Run checks** before pushing:
   ```bash
   bun run typecheck
   ```
3. **Auto-fix lint issues** if needed:
   ```bash
   bunx @biomejs/biome check --write .
   ```
