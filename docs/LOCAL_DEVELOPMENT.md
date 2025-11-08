# Local Development

Simple setup for developing Kianax locally with Convex + Temporal.

## Prerequisites

- Node.js 18+ or Bun 1.2+
- Text editor (VS Code recommended)
- Docker Desktop (for local Temporal server)

## First-Time Setup

### 1. Install Dependencies

```bash
# Clone and install
git clone <your-repo>
cd kianax
bun install

# Initialize Convex (creates project + generates files)
npx convex dev
# Follow prompts to create Convex account (free)
# This creates convex/ directory and .env.local automatically
```

### 2. Start Local Temporal Server

```bash
# Using Temporal CLI (recommended)
brew install temporal  # macOS
# or download from https://docs.temporal.io/cli

# Start local Temporal server
temporal server start-dev

# This runs:
# - Temporal Server (localhost:7233)
# - Temporal Web UI (http://localhost:8233)
```

**Alternative: Docker Compose**

```bash
# Download Temporal docker-compose
curl -L https://github.com/temporalio/docker-compose/archive/main.zip -o temporal.zip
unzip temporal.zip && cd docker-compose-main

# Start services
docker-compose up -d

# Web UI: http://localhost:8080
```

## Daily Development

```bash
# Terminal 1: Temporal Server (if not using docker-compose)
temporal server start-dev

# Terminal 2: Convex backend
npx convex dev

# Terminal 3: Temporal Workers
bun run workers/dev

# Terminal 4: Next.js frontend
bun run dev

# Open browser
open http://localhost:3000        # App
open http://localhost:8233        # Temporal UI
open https://dashboard.convex.dev # Convex Dashboard
```

**What's running:**
- **Temporal Server** (localhost:7233) - Workflow orchestration
- **Temporal Web UI** (localhost:8233) - Workflow debugging
- **Convex** (cloud) - Database + real-time + auth
- **Workers** (local) - Execute workflow code
- **Next.js** (localhost:3000) - Frontend

## Development Workflow

### 1. Define Schema

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  workflows: defineTable({
    userId: v.string(),
    name: v.string(),
    type: v.union(v.literal("root"), v.literal("sub-workflow")),
    nodes: v.array(v.any()),
    edges: v.array(v.any()),
  }).index("by_user", ["userId"]),
});
```

Schema changes are **instant** - no migrations needed.

### 2. Write Functions

```typescript
// convex/workflows.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Query (read) - auto-subscribes in React
export const list = query({
  handler: async (ctx) => {
    const userId = (await ctx.auth.getUserIdentity())?.subject;
    return await ctx.db.query("workflows")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();
  },
});

// Mutation (write)
export const create = mutation({
  args: { name: v.string(), nodes: v.array(v.any()) },
  handler: async (ctx, args) => {
    const userId = (await ctx.auth.getUserIdentity())?.subject;
    return await ctx.db.insert("workflows", {
      userId,
      ...args,
    });
  },
});
```

### 3. Use in Frontend

```typescript
// app/workflows/page.tsx
"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function WorkflowsPage() {
  const workflows = useQuery(api.workflows.list);
  const createWorkflow = useMutation(api.workflows.create);

  // Real-time! Auto-updates when data changes
  return (
    <div>
      {workflows?.map(w => <div key={w._id}>{w.name}</div>)}
      <button onClick={() => createWorkflow({ name: "Test", nodes: [] })}>
        Create
      </button>
    </div>
  );
}
```

### 4. Develop Temporal Workflows

```typescript
// workers/workflows/executor.ts
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

const { executePlugin, updateConvexStatus } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: { maximumAttempts: 3 }
});

export async function userWorkflowExecutor(workflowDef: WorkflowDAG) {
  const results = new Map();

  // Execute nodes in topological order
  for (const node of topologicalSort(workflowDef.nodes, workflowDef.edges)) {
    // Execute plugin as Temporal Activity
    const output = await executePlugin({
      pluginId: node.pluginId,
      config: node.config,
      inputs: gatherInputs(node, results)
    });

    results.set(node.id, output);

    // Update Convex with execution status
    await updateConvexStatus({
      workflowId: workflowDef.id,
      nodeId: node.id,
      status: 'completed',
      output
    });
  }

  return results;
}
```

```typescript
// workers/activities/plugins.ts
export async function executePlugin(params: ExecutePluginParams) {
  const plugin = await loadPlugin(params.pluginId);

  // Execute plugin code (sandboxed)
  const result = await plugin.execute(params.config, params.inputs);

  return result;
}

export async function updateConvexStatus(params: StatusUpdate) {
  // Call Convex mutation to update execution status
  await convexClient.mutation(api.executions.updateNode, params);
}
```

```typescript
// workers/index.ts - Worker entry point
import { Worker } from '@temporalio/worker';
import * as activities from './activities';
import * as workflows from './workflows';

async function run() {
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows'),
    activities,
    taskQueue: 'kianax-workflows',
  });

  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

### 5. Trigger Workflows from Convex

```typescript
// convex/workflows.ts
import { mutation } from "./_generated/server";
import { getTemporalClient } from "./lib/temporal";

export const activate = mutation({
  args: { workflowId: v.id("workflows") },
  handler: async (ctx, args) => {
    const workflow = await ctx.db.get(args.workflowId);
    const userId = (await ctx.auth.getUserIdentity())?.subject;

    // Start Temporal workflow
    const temporal = await getTemporalClient();
    await temporal.workflow.start('userWorkflowExecutor', {
      taskQueue: `user-${userId}`,
      workflowId: `workflow-${args.workflowId}`,
      args: [workflow],
      cronSchedule: workflow.cronPattern // For cron triggers
    });

    // Update workflow status
    await ctx.db.patch(args.workflowId, { status: 'active' });
  }
});
```

## Testing Functions

### Test Convex Functions

```bash
# Run a query
npx convex run workflows:list

# Run a mutation
npx convex run workflows:create '{"name": "Test", "nodes": []}'

# Tail logs
npx convex dev --tail-logs
```

### Test Temporal Workflows

```bash
# Using Temporal CLI
temporal workflow execute \
  --task-queue kianax-workflows \
  --type userWorkflowExecutor \
  --workflow-id test-workflow-1 \
  --input '{"nodes": [...], "edges": [...]}'

# List workflows
temporal workflow list

# Describe workflow
temporal workflow describe --workflow-id test-workflow-1

# View workflow history
temporal workflow show --workflow-id test-workflow-1
```

**Temporal Web UI (localhost:8233):**
- View all running workflows
- See execution history with full replay
- Debug failed workflows
- Test workflow queries and signals

## Environment Variables

```env
# .env.local (auto-generated by convex dev)
CONVEX_DEPLOYMENT=dev:your-project-name
NEXT_PUBLIC_CONVEX_URL=https://...

# Add your own
OPENAI_API_KEY=sk-...

# Temporal (local development)
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
```

**Convex secrets** (for backend):
```bash
npx convex env set OPENAI_API_KEY sk-...
```

## Common Tasks

### Add New Table

1. Edit `convex/schema.ts`
2. Save (Convex auto-deploys)
3. Use immediately in functions

### Debug Function

1. Add `console.log()` in function
2. Check terminal running `npx convex dev`
3. Or check Dashboard logs

### Reset Database

```bash
npx convex import --clear  # Clears all data
```

**Warning:** This deletes everything in development!

### Test Real-Time Updates

1. Open app in two browser tabs
2. Create workflow in tab 1
3. Watch it appear instantly in tab 2

No polling. No manual WebSockets. Just works.

## Tips

**Type Safety:**
- Convex auto-generates TypeScript types from schema
- `api.workflows.list` is fully typed
- Errors caught at compile time

**Performance:**
- Convex caches query results automatically
- Frontend only re-renders on actual changes
- No need for manual cache management

**Debugging:**
- Check `npx convex dev` logs for function errors
- Use Dashboard for inspecting database
- Browser DevTools shows Convex WebSocket (automatic)

## Deploy to Production

```bash
# Deploy Convex backend
npx convex deploy

# Deploy Next.js frontend
vercel deploy

# That's it!
```

Production uses same Convex code, different deployment.

---

**Questions?**
- [Convex Docs](https://docs.convex.dev)
- [Temporal Docs](https://docs.temporal.io)
- Check `convex/README.md` for project-specific notes
