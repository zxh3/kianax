# Temporal Architecture for Kianax

This document explains how Temporal Cloud is used to execute user-defined routines in Kianax.

## Table of Contents
- [Overview](#overview)
- [Core Concepts](#core-concepts)
- [Architecture](#architecture)
- [Data Flow](#data-flow)
- [Trigger Implementation](#trigger-implementation)
- [Workflow Implementation](#workflow-implementation)
- [Activity Implementation](#activity-implementation)
- [Multi-Tenancy](#multi-tenancy)
- [Error Handling](#error-handling)
- [Observability](#observability)
- [Development Setup](#development-setup)
- [Production Setup](#production-setup)

---

## Overview

**The Challenge:**
Users create custom automation routines with arbitrary plugin combinations. We need to execute these user-defined DAGs reliably, with retries, observability, and multi-tenant isolation.

**The Solution:**
Temporal provides a durable execution engine where we define ONE generic workflow (`routineExecutor`) that interprets and executes ANY user routine at runtime.

**Key Insight:**
- **User Routines** = Data (stored in Convex as JSON)
- **Temporal Workflows** = Execution Engine (code that runs the data)

This is the **Interpreter Pattern** applied to workflow orchestration.

---

## Core Concepts

### Temporal Workflows vs User Routines

**Temporal Workflow:**
- Code deployed to Workers
- Durable, resumable, deterministic
- Orchestrates execution logic
- ONE workflow definition executes ALL user routines

**User Routine:**
- Data stored in Convex
- Trigger configuration + DAG of plugin nodes
- Created/modified by users at runtime
- MANY routines, all executed by the same workflow

### Key Temporal Primitives

1. **Workflows**: Durable orchestration logic
   - Deterministic (no random, no Date.now(), no network calls)
   - Resumable (survives server restarts)
   - Versioned (can update code without breaking running workflows)

2. **Activities**: Non-deterministic operations
   - Plugin execution, API calls, database writes
   - Automatic retries with exponential backoff
   - Timeout enforcement

3. **Task Queues**: Worker isolation
   - Each user gets dedicated queue: `user-${userId}`
   - Enables per-user worker scaling
   - Multi-tenant execution isolation

4. **Schedules**: Cron-based triggers
   - Native Temporal feature for periodic execution
   - Better than external cron jobs (built-in retry, observability)

5. **Signals/Queries**: Runtime communication
   - Signals: Send events to running workflows (e.g., pause/resume)
   - Queries: Read workflow state without side effects

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│                    (Next.js 16 + React 19)                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Real-time updates (Convex subscriptions)
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CONVEX BACKEND                             │
│  • Stores routine definitions (trigger + DAG)                   │
│  • Temporal Client (starts workflows)                           │
│  • HTTP endpoints (webhook triggers)                            │
│  • Reactive queries (event triggers)                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ gRPC (Temporal Client)
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   TEMPORAL CLOUD / SERVER                       │
│  • Workflow orchestration                                       │
│  • Schedules (cron triggers)                                    │
│  • Workflow history storage                                     │
│  • Task queue management                                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Long polling (Task Queues)
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TEMPORAL WORKERS                             │
│  • routineExecutor workflow (generic DAG executor)              │
│  • Activities:                                                  │
│    - executePlugin (run plugin code)                            │
│    - updateRoutineStatus (write to Convex)                      │
│    - fetchExternalData (API calls)                              │
│  • One worker per task queue (multi-tenant)                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Routine Creation & Activation

```
User creates routine in UI
    ↓
Convex mutation stores routine
{
  id: "routine-123",
  userId: "user-456",
  trigger: { type: "cron", config: { schedule: "*/5 * * * *" } },
  nodes: [ /* DAG */ ],
  connections: [ /* edges */ ],
  status: "draft"
}
    ↓
User clicks "Activate"
    ↓
Convex validation runs
    ↓
Convex mutation calls Temporal Client (apps/server/convex/lib/temporal.ts)
    ↓
Branch on trigger type:

┌─────────────────┬──────────────────┬──────────────────┬─────────────────┐
│  Cron Trigger   │ Webhook Trigger  │ Manual Trigger   │ Event Trigger   │
└─────────────────┴──────────────────┴──────────────────┴─────────────────┘
       │                   │                  │                  │
       ▼                   ▼                  ▼                  ▼
Create Temporal      Setup webhook      Ready to start    Setup Convex
Schedule             endpoint           on demand         reactive query
```

### 2. Routine Execution

```
Trigger fires (cron schedule / webhook / manual / event)
    ↓
Temporal Client starts workflow:
  temporal.workflow.start(routineExecutor, {
    taskQueue: `user-${userId}`,
    workflowId: `routine-${routineId}-${timestamp}`,
    args: [routineDAG, triggerData]
  })
    ↓
Temporal Server assigns to Worker
    ↓
Worker polls task queue `user-${userId}`
    ↓
Worker starts routineExecutor workflow
    ↓
Workflow performs topological sort of DAG
    ↓
For each node in order:
  1. Gather inputs from previous nodes
  2. Execute node as Activity: executeActivity(executePlugin, { nodeConfig, inputs })
  3. Activity loads plugin code from Convex
  4. Activity executes plugin.execute(inputs, config, context)
  5. Activity updates Convex: executeActivity(updateRoutineStatus, { nodeId, status, output })
  6. Store results for next node
    ↓
Workflow completes, returns results
    ↓
Convex receives final status update
    ↓
UI receives real-time update via subscription
```

---

## Trigger Implementation

### Cron Triggers

**When:** Time-based schedules (e.g., "every 5 minutes", "daily at 9am")

**Implementation:**
```typescript
// apps/server/convex/lib/temporal.ts
export async function activateCronRoutine(routine: Routine) {
  const temporal = await getTemporalClient();

  await temporal.schedule.create({
    scheduleId: `routine-${routine._id}`,
    spec: {
      cronExpressions: [routine.trigger.config.schedule], // "*/5 * * * *"
      timeZone: routine.trigger.config.timezone || 'UTC'
    },
    action: {
      type: 'startWorkflow',
      workflowType: 'routineExecutor',
      taskQueue: `user-${routine.userId}`,
      args: [{
        routineId: routine._id,
        userId: routine.userId,
        nodes: routine.nodes,
        connections: routine.connections
      }]
    },
    policies: {
      pauseOnFailure: false, // Continue on failures
      overlap: 'BUFFER_ONE' // Queue if previous run still executing
    }
  });
}
```

**Deactivation:**
```typescript
export async function deactivateCronRoutine(routineId: string) {
  const temporal = await getTemporalClient();
  await temporal.schedule.delete(`routine-${routineId}`);
}
```

**Benefits:**
- No external cron daemon needed
- Built-in retry on failure
- Temporal UI shows schedule history
- Can pause/resume schedules
- Handles overlapping executions

### Webhook Triggers

**When:** External systems POST data to trigger routine

**Implementation:**
```typescript
// apps/server/convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
  path: "/webhooks/routine/:routineId",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const routineId = ctx.params.routineId;

    // Load routine from Convex
    const routine = await ctx.runQuery(api.routines.get, { id: routineId });

    if (!routine || routine.trigger.type !== 'webhook') {
      return new Response("Not found", { status: 404 });
    }

    // Validate webhook secret
    const secret = request.headers.get('x-webhook-secret');
    if (secret !== routine.trigger.config.secret) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Parse webhook payload
    const payload = await request.json();

    // Start Temporal workflow
    const temporal = await getTemporalClient();
    await temporal.workflow.start('routineExecutor', {
      taskQueue: `user-${routine.userId}`,
      workflowId: `routine-${routineId}-${Date.now()}`,
      args: [{
        routineId: routine._id,
        userId: routine.userId,
        nodes: routine.nodes,
        connections: routine.connections,
        triggerData: payload // Webhook payload available to plugins
      }]
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  })
});

export default http;
```

**Security:**
- Webhook secret validation
- Rate limiting (Convex built-in)
- Payload size limits
- User-scoped endpoints

### Manual Triggers

**When:** User clicks "Run" button in UI

**Implementation:**
```typescript
// apps/server/convex/routines.ts
export const executeRoutine = mutation({
  args: { routineId: v.id("routines") },
  handler: async (ctx, { routineId }) => {
    const userId = await requireUser(ctx);
    const routine = await ctx.db.get(routineId);

    if (!routine || routine.userId !== userId) {
      throw new Error("Routine not found");
    }

    // Start Temporal workflow
    const temporal = await getTemporalClient();
    const handle = await temporal.workflow.start('routineExecutor', {
      taskQueue: `user-${userId}`,
      workflowId: `routine-${routineId}-${Date.now()}`,
      args: [{
        routineId: routine._id,
        userId: routine.userId,
        nodes: routine.nodes,
        connections: routine.connections
      }]
    });

    // Store execution record
    await ctx.db.insert("routine_executions", {
      routineId: routine._id,
      userId: userId,
      workflowId: handle.workflowId,
      status: "running",
      triggerType: "manual",
      startedAt: Date.now(),
      nodeStates: []
    });

    return { executionId: handle.workflowId };
  }
});
```

**UI Integration:**
```typescript
// Frontend component
const { mutate: runRoutine } = useMutation(api.routines.executeRoutine);

<Button onClick={() => runRoutine({ routineId })}>
  Run Now
</Button>
```

### Event Triggers

**When:** Data changes or system events (e.g., "when stock price drops 5%")

**Implementation:**
```typescript
// apps/server/convex/events.ts
import { internalMutation } from "./_generated/server";

// Scheduled function checks conditions periodically
export const checkEventTriggers = internalMutation({
  handler: async (ctx) => {
    // Find all active event-triggered routines
    const routines = await ctx.db
      .query("routines")
      .withIndex("by_trigger_type", (q) =>
        q.eq("triggerType", "event").eq("status", "active")
      )
      .collect();

    for (const routine of routines) {
      // Evaluate trigger condition
      const condition = routine.trigger.config.condition;
      const shouldTrigger = await evaluateCondition(ctx, condition);

      if (shouldTrigger) {
        // Start Temporal workflow
        const temporal = await getTemporalClient();
        await temporal.workflow.start('routineExecutor', {
          taskQueue: `user-${routine.userId}`,
          workflowId: `routine-${routine._id}-${Date.now()}`,
          args: [{
            routineId: routine._id,
            userId: routine.userId,
            nodes: routine.nodes,
            connections: routine.connections,
            triggerData: { event: condition.event, timestamp: Date.now() }
          }]
        });
      }
    }
  }
});

// Convex Cron triggers this every minute
export default cronJobs;
cronJobs.interval("check-event-triggers", { minutes: 1 }, api.events.checkEventTriggers);
```

**Event Condition Example:**
```typescript
{
  type: "event",
  config: {
    condition: {
      source: "stock_price",
      symbol: "AAPL",
      operator: "drops_by_percent",
      threshold: 5
    }
  }
}
```

---

## Workflow Implementation

**Location:** `workers/src/workflows/routine-executor.ts`

**Key Constraints:**
- **Deterministic**: No random, no Date.now(), no network calls
- **Durable**: Must be resumable after server restart
- **Versionable**: Can update code without breaking running workflows

```typescript
import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

// Proxy activities with retry/timeout config
const {
  executePlugin,
  updateRoutineStatus,
  storeNodeResult
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '1m',
    maximumAttempts: 3
  }
});

export interface RoutineInput {
  routineId: string;
  userId: string;
  nodes: Node[];
  connections: Connection[];
  triggerData?: any;
}

export interface Node {
  id: string;
  pluginId: string;
  type: 'input' | 'processor' | 'logic' | 'output';
  config: any;
  enabled: boolean;
}

export interface Connection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
}

/**
 * Generic routine executor workflow
 *
 * Executes user-defined routine DAGs at runtime by:
 * 1. Topologically sorting nodes
 * 2. Executing each node as an activity
 * 3. Passing outputs to downstream nodes
 * 4. Updating status in Convex
 */
export async function routineExecutor(input: RoutineInput): Promise<void> {
  const { routineId, userId, nodes, connections, triggerData } = input;

  // Update routine status: running
  await updateRoutineStatus({
    routineId,
    status: 'running',
    startedAt: Date.now()
  });

  try {
    // Topologically sort nodes (deterministic algorithm)
    const sortedNodes = topologicalSort(nodes, connections);

    // Store node outputs
    const nodeResults = new Map<string, any>();

    // Execute nodes in order
    for (const node of sortedNodes) {
      if (!node.enabled) {
        continue; // Skip disabled nodes
      }

      // Gather inputs from connected nodes
      const inputs = gatherNodeInputs(node.id, connections, nodeResults, triggerData);

      // Execute node as activity
      try {
        const output = await executePlugin({
          pluginId: node.pluginId,
          config: node.config,
          inputs: inputs,
          context: {
            userId,
            routineId,
            nodeId: node.id
          }
        });

        // Store result for downstream nodes
        nodeResults.set(node.id, output);

        // Update Convex with node status
        await storeNodeResult({
          routineId,
          nodeId: node.id,
          status: 'completed',
          output,
          completedAt: Date.now()
        });

      } catch (error) {
        // Node execution failed
        await storeNodeResult({
          routineId,
          nodeId: node.id,
          status: 'failed',
          error: {
            message: error.message,
            stack: error.stack
          },
          completedAt: Date.now()
        });

        // Stop execution on failure
        throw error;
      }
    }

    // All nodes completed successfully
    await updateRoutineStatus({
      routineId,
      status: 'completed',
      completedAt: Date.now()
    });

  } catch (error) {
    // Workflow failed
    await updateRoutineStatus({
      routineId,
      status: 'failed',
      error: {
        message: error.message,
        stack: error.stack
      },
      completedAt: Date.now()
    });

    throw error; // Re-throw for Temporal to record
  }
}

/**
 * Topological sort (deterministic)
 * Returns nodes in execution order
 */
function topologicalSort(nodes: Node[], connections: Connection[]): Node[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize
  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  // Build graph
  for (const conn of connections) {
    adjacency.get(conn.sourceNodeId)!.push(conn.targetNodeId);
    inDegree.set(conn.targetNodeId, inDegree.get(conn.targetNodeId)! + 1);
  }

  // Find entry points (nodes with no incoming edges)
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  // Sort by node ID for determinism
  queue.sort();

  // Kahn's algorithm
  const sorted: Node[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    sorted.push(nodeMap.get(nodeId)!);

    const neighbors = adjacency.get(nodeId)! || [];
    for (const neighborId of neighbors) {
      const newDegree = inDegree.get(neighborId)! - 1;
      inDegree.set(neighborId, newDegree);

      if (newDegree === 0) {
        queue.push(neighborId);
      }
    }

    // Sort queue for determinism
    queue.sort();
  }

  // Check for cycles
  if (sorted.length !== nodes.length) {
    throw new Error('Cycle detected in routine DAG');
  }

  return sorted;
}

/**
 * Gather inputs for a node from connected nodes
 */
function gatherNodeInputs(
  nodeId: string,
  connections: Connection[],
  results: Map<string, any>,
  triggerData?: any
): any {
  const incomingConnections = connections.filter(c => c.targetNodeId === nodeId);

  if (incomingConnections.length === 0) {
    // Entry node - use trigger data if available
    return triggerData || {};
  }

  if (incomingConnections.length === 1) {
    // Single input
    const sourceId = incomingConnections[0].sourceNodeId;
    return results.get(sourceId);
  }

  // Multiple inputs - merge (logic nodes may have multiple branches)
  const inputs: any = {};
  for (const conn of incomingConnections) {
    const handle = conn.targetHandle || 'default';
    inputs[handle] = results.get(conn.sourceNodeId);
  }
  return inputs;
}
```

---

## Activity Implementation

**Location:** `workers/src/activities/`

**Key Characteristics:**
- Non-deterministic (can call APIs, use random, Date.now())
- Automatic retries
- Timeout enforcement
- Can access external systems

### Activity: Execute Plugin

```typescript
// workers/src/activities/plugins.ts
import { Context } from '@temporalio/activity';
import { ConvexHttpClient } from 'convex/browser';

const convex = new ConvexHttpClient(process.env.CONVEX_URL!);

export interface ExecutePluginInput {
  pluginId: string;
  config: any;
  inputs: any;
  context: {
    userId: string;
    routineId: string;
    nodeId: string;
  };
}

export async function executePlugin(input: ExecutePluginInput): Promise<any> {
  const { pluginId, config, inputs, context } = input;

  // Heartbeat to show activity is alive
  Context.current().heartbeat();

  // Load plugin from Convex
  const plugin = await convex.query('plugins:get', { pluginId });

  if (!plugin) {
    throw new Error(`Plugin not found: ${pluginId}`);
  }

  // Load user credentials for this plugin (if required)
  let credentials;
  if (plugin.credentials && plugin.credentials.length > 0) {
    credentials = await convex.query('credentials:get', {
      userId: context.userId,
      pluginId: pluginId
    });
  }

  // Heartbeat before execution
  Context.current().heartbeat();

  // Execute plugin code
  // Note: Plugin code should be sandboxed (VM2, isolated-vm, or separate container)
  const output = await executePluginCode(plugin, inputs, config, credentials, context);

  return output;
}

/**
 * Execute plugin code in sandbox
 * TODO: Implement proper sandboxing (VM2, isolated-vm, or Firecracker)
 */
async function executePluginCode(
  plugin: any,
  inputs: any,
  config: any,
  credentials: any,
  context: any
): Promise<any> {
  // For now, load plugin from file system
  // In production, this should be sandboxed execution

  const pluginModule = await import(`../../../plugins/${plugin.category}/${plugin.id}/index.ts`);

  const result = await pluginModule.default.execute(inputs, config, {
    userId: context.userId,
    routineId: context.routineId,
    credentials: credentials
  });

  return result;
}
```

### Activity: Update Routine Status

```typescript
// workers/src/activities/convex.ts
import { ConvexHttpClient } from 'convex/browser';

const convex = new ConvexHttpClient(process.env.CONVEX_URL!);

export interface UpdateRoutineStatusInput {
  routineId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt?: number;
  completedAt?: number;
  error?: {
    message: string;
    stack?: string;
  };
}

export async function updateRoutineStatus(input: UpdateRoutineStatusInput): Promise<void> {
  await convex.mutation('executions:updateStatus', input);
}

export interface StoreNodeResultInput {
  routineId: string;
  nodeId: string;
  status: 'completed' | 'failed';
  output?: any;
  error?: {
    message: string;
    stack?: string;
  };
  completedAt: number;
}

export async function storeNodeResult(input: StoreNodeResultInput): Promise<void> {
  await convex.mutation('executions:updateNodeStatus', input);
}
```

---

## Multi-Tenancy

**Problem:** Thousands of users, each with their own routines. How to isolate execution?

**Solution:** Dedicated task queues per user.

### Task Queue Strategy

```typescript
// User A's routines execute on: user-a123
// User B's routines execute on: user-b456
```

**Benefits:**
- **Isolation**: User A's heavy routine doesn't affect User B
- **Scalability**: Can deploy more workers for high-volume users
- **Resource Limits**: Can set per-user quotas (max concurrent workflows)
- **Observability**: Easy to see all workflows for a user

### Worker Deployment

**Development:**
```bash
# Start single worker listening to all task queues
bun run workers/dev
```

**Production:**
```typescript
// workers/src/worker.ts
import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';

async function runWorker(taskQueue: string) {
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS!,
    tls: {
      clientCertPair: {
        crt: Buffer.from(process.env.TEMPORAL_CLIENT_CERT!, 'base64'),
        key: Buffer.from(process.env.TEMPORAL_CLIENT_KEY!, 'base64')
      }
    }
  });

  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE!,
    taskQueue,
    workflowsPath: require.resolve('./workflows'),
    activities
  });

  await worker.run();
}

// In production, deploy workers dynamically per user
const taskQueue = process.env.TASK_QUEUE || 'default';
runWorker(taskQueue);
```

**Auto-Scaling:**
```typescript
// Scale workers based on task queue depth
// Can use Kubernetes HPA or custom auto-scaler
const queueDepth = await temporal.getTaskQueueDepth(`user-${userId}`);

if (queueDepth > 10) {
  deployWorker(`user-${userId}`);
}
```

---

## Error Handling

### Activity Retry Policies

```typescript
proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',        // First retry after 1s
    backoffCoefficient: 2,         // Double each time
    maximumInterval: '1m',         // Cap at 1 minute
    maximumAttempts: 3,            // Max 3 retries
    nonRetryableErrorTypes: [
      'PluginNotFound',
      'InvalidConfiguration',
      'PermissionDenied'
    ]
  }
});
```

### Workflow Error Handling

```typescript
// In routineExecutor workflow
try {
  const output = await executePlugin({ /* ... */ });
} catch (error) {
  if (error.type === 'NetworkError') {
    // Temporal will retry activity
    throw error;
  }

  if (error.type === 'InvalidInput') {
    // Don't retry, mark node as failed
    await storeNodeResult({
      routineId,
      nodeId: node.id,
      status: 'failed',
      error: {
        message: 'Invalid input to plugin',
        details: error.message
      }
    });

    // Stop execution
    throw new Error('Routine failed due to invalid input');
  }
}
```

### Compensation (Future)

For routines with side effects, implement compensation logic:

```typescript
// Example: If "send email" succeeds but "update CRM" fails, send apology email
if (sendEmailSuccess && !updateCRMSuccess) {
  await executePlugin({
    pluginId: 'email',
    config: {
      to: user.email,
      subject: 'Apology',
      body: 'We encountered an error...'
    }
  });
}
```

---

## Observability

### Temporal Web UI

**Access:** `http://localhost:8233` (dev) or Temporal Cloud UI (prod)

**Capabilities:**
- View all workflows (past and present)
- Inspect workflow history (every activity execution)
- See input/output of each activity
- Replay failed workflows
- Terminate stuck workflows

### Convex Execution Logs

```typescript
// apps/server/convex/schema.ts
routine_executions: defineTable({
  routineId: v.id("routines"),
  userId: v.string(),
  workflowId: v.string(),  // Temporal workflow ID
  status: v.union(
    v.literal("running"),
    v.literal("completed"),
    v.literal("failed")
  ),
  triggerType: v.union(...),
  triggerData: v.optional(v.any()),
  nodeStates: v.array(
    v.object({
      nodeId: v.string(),
      status: v.string(),
      input: v.optional(v.any()),
      output: v.optional(v.any()),
      error: v.optional(v.object({
        message: v.string(),
        stack: v.optional(v.string())
      })),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      duration: v.optional(v.number())
    })
  ),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  duration: v.optional(v.number())
})
```

### Real-Time Updates

```typescript
// Frontend component
const execution = useQuery(api.executions.get, { executionId });

return (
  <div>
    <h2>Execution Status: {execution.status}</h2>
    {execution.nodeStates.map(node => (
      <div key={node.nodeId}>
        {node.status === 'running' && <Spinner />}
        {node.status === 'completed' && <CheckIcon />}
        {node.status === 'failed' && <ErrorIcon />}
        <span>{node.nodeId}</span>
      </div>
    ))}
  </div>
);
```

### Metrics (Future)

```typescript
// Track important metrics
const metrics = {
  executionCount: 12543,
  successRate: 0.98,
  averageDuration: 3200, // ms
  p95Duration: 8500,
  failureReasons: {
    'NetworkTimeout': 120,
    'InvalidInput': 45,
    'RateLimitExceeded': 32
  }
};
```

---

## Development Setup

### Prerequisites

- Node.js 18+
- Bun (for fast package management)
- Docker Desktop (for local Temporal server)

### 1. Install Temporal CLI

```bash
brew install temporal
# Or see: https://docs.temporal.io/cli
```

### 2. Start Local Temporal Server

```bash
temporal server start-dev

# This starts:
# - Temporal Server on localhost:7233
# - Temporal Web UI on localhost:8233
```

**Or use Docker Compose:**

```yaml
# docker-compose.yml
version: '3.8'
services:
  temporal:
    image: temporalio/auto-setup:latest
    ports:
      - "7233:7233"  # gRPC
      - "8233:8233"  # Web UI
    environment:
      - DB=postgresql
      - DB_PORT=5432
      - POSTGRES_USER=temporal
      - POSTGRES_PWD=temporal
      - POSTGRES_SEEDS=postgresql
    depends_on:
      - postgresql

  postgresql:
    image: postgres:13
    environment:
      POSTGRES_PASSWORD: temporal
      POSTGRES_USER: temporal
```

```bash
docker-compose up -d
```

### 3. Set Environment Variables

```bash
# .env.local
TEMPORAL_ADDRESS=localhost:7233
TEMPORAL_NAMESPACE=default
CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOY_KEY=your-deploy-key
```

### 4. Start Workers

```bash
cd workers
bun install
bun run dev
```

### 5. Test Workflow Execution

```bash
# Via Temporal CLI
temporal workflow execute \
  --task-queue user-test \
  --type routineExecutor \
  --input '{"routineId":"test-1","userId":"user-1","nodes":[],"connections":[]}'

# Via Convex mutation
npx convex run routines:executeRoutine --args '{"routineId":"<id>"}'
```

---

## Production Setup

### Temporal Cloud

1. **Create Account:** https://cloud.temporal.io
2. **Create Namespace:** `kianax-prod`
3. **Generate mTLS Certificate:**
   ```bash
   temporal cloud namespace certificate create \
     --namespace kianax-prod \
     --certificate-file client.crt \
     --private-key-file client.key
   ```

4. **Store Credentials:**
   ```bash
   # Base64 encode for environment variables
   cat client.crt | base64 > client.crt.b64
   cat client.key | base64 > client.key.b64
   ```

5. **Deploy Environment Variables:**
   ```bash
   # Production .env
   TEMPORAL_ADDRESS=kianax-prod.tmprl.cloud:7233
   TEMPORAL_NAMESPACE=kianax-prod
   TEMPORAL_CLIENT_CERT=<contents of client.crt.b64>
   TEMPORAL_CLIENT_KEY=<contents of client.key.b64>
   ```

### Worker Deployment

**Option 1: Dedicated Server (Simple)**

```bash
# On production server
git clone https://github.com/your-org/kianax.git
cd kianax/workers
bun install
bun run build
NODE_ENV=production bun run start

# Use PM2 for process management
pm2 start dist/worker.js --name kianax-worker
pm2 save
```

**Option 2: Docker (Recommended)**

```dockerfile
# workers/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json bun.lockb ./
RUN npm install -g bun && bun install --frozen-lockfile

COPY . .
RUN bun run build

CMD ["bun", "run", "start"]
```

```bash
docker build -t kianax-worker .
docker run -d \
  --name kianax-worker \
  -e TEMPORAL_ADDRESS=$TEMPORAL_ADDRESS \
  -e TEMPORAL_NAMESPACE=$TEMPORAL_NAMESPACE \
  -e TEMPORAL_CLIENT_CERT=$TEMPORAL_CLIENT_CERT \
  -e TEMPORAL_CLIENT_KEY=$TEMPORAL_CLIENT_KEY \
  -e CONVEX_URL=$CONVEX_URL \
  kianax-worker
```

**Option 3: Kubernetes (Scale)**

```yaml
# workers/k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kianax-worker
spec:
  replicas: 3
  selector:
    matchLabels:
      app: kianax-worker
  template:
    metadata:
      labels:
        app: kianax-worker
    spec:
      containers:
      - name: worker
        image: kianax-worker:latest
        env:
        - name: TEMPORAL_ADDRESS
          valueFrom:
            secretKeyRef:
              name: temporal-config
              key: address
        - name: TEMPORAL_CLIENT_CERT
          valueFrom:
            secretKeyRef:
              name: temporal-certs
              key: client.crt
        - name: TEMPORAL_CLIENT_KEY
          valueFrom:
            secretKeyRef:
              name: temporal-certs
              key: client.key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Monitoring

- **Temporal Cloud Dashboard:** View workflow metrics, errors, task queue depth
- **Convex Logs:** Execution history and status
- **Application Metrics:** Prometheus + Grafana (optional)

---

## Implementation Plan

This section provides a step-by-step guide to implement the Temporal-based routine execution engine in your codebase.

### File Structure Overview

```
kianax/
├── apps/
│   └── server/                         # Convex backend
│       ├── package.json                # Add @temporalio/client
│       └── convex/
│           ├── lib/
│           │   └── temporal.ts         # 🆕 Temporal Client (singleton)
│           ├── triggers/               # 🆕 Trigger handlers
│           │   ├── cron.ts             # Activate/deactivate cron schedules
│           │   ├── webhook.ts          # Webhook validation/parsing
│           │   ├── manual.ts           # Manual execution handler
│           │   └── events.ts           # Event-based trigger checking
│           ├── routines.ts             # Update: add activateRoutine mutation
│           ├── executions.ts           # Update: add status update mutations
│           └── http.ts                 # Update: add webhook endpoint
│
├── workers/                            # Temporal Worker app
│   ├── src/
│   │   ├── workflows/
│   │   │   ├── routine-executor.ts     # 🆕 Main workflow implementation
│   │   │   ├── utils/
│   │   │   │   ├── topological-sort.ts # 🆕 DAG sorting
│   │   │   │   └── gather-inputs.ts    # 🆕 Input gathering logic
│   │   │   └── index.ts                # 🆕 Export workflows
│   │   ├── activities/
│   │   │   ├── plugins.ts              # 🆕 executePlugin activity
│   │   │   ├── convex.ts               # 🆕 Convex update activities
│   │   │   └── index.ts                # 🆕 Export activities
│   │   ├── worker.ts                   # 🆕 Worker bootstrap
│   │   └── dev-worker.ts               # 🆕 Dev entry point
│   ├── package.json                    # ✅ Already has Temporal deps
│   ├── tsconfig.json
│   └── Dockerfile                      # 🆕 Production deployment
│
├── packages/
│   └── shared/
│       └── src/
│           └── temporal/               # 🆕 Shared types
│               ├── types.ts            # Workflow/Activity interfaces
│               ├── constants.ts        # Timeouts, queue names
│               └── index.ts            # Re-exports
│
└── .env.local                          # Update with Temporal vars
```

### Dependencies to Install

#### 1. Convex Backend (Temporal Client)

```bash
cd apps/server
npm install @temporalio/client
```

**Update `apps/server/package.json`:**
```json
{
  "dependencies": {
    "@temporalio/client": "^1.13.0",
    "convex": "^1.28.2"
  }
}
```

#### 2. Workers (Already Installed)

Verify `workers/package.json` has:
```json
{
  "dependencies": {
    "@temporalio/worker": "^1.13.0",
    "@temporalio/workflow": "^1.13.0",
    "@temporalio/activity": "^1.13.0",
    "convex": "^1.28.2",
    "@kianax/shared": "*"
  }
}
```

#### 3. Shared Package

No additional dependencies needed (just TypeScript types).

### Implementation Phases

---

#### **Phase 1: Foundation Setup** (1-2 hours)

**Goal:** Set up shared types and environment configuration

- [ ] **1.1 Create Shared Types**

  **File:** `packages/shared/src/temporal/types.ts`

  ```typescript
  export interface RoutineInput {
    routineId: string;
    userId: string;
    nodes: Node[];
    connections: Connection[];
    triggerData?: any;
  }

  export interface Node {
    id: string;
    pluginId: string;
    type: 'input' | 'processor' | 'logic' | 'output';
    config: any;
    enabled: boolean;
  }

  export interface Connection {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourceHandle?: string;
    targetHandle?: string;
  }

  export interface ExecutePluginInput {
    pluginId: string;
    config: any;
    inputs: any;
    context: PluginContext;
  }

  export interface PluginContext {
    userId: string;
    routineId: string;
    nodeId: string;
  }

  export interface UpdateRoutineStatusInput {
    routineId: string;
    status: 'running' | 'completed' | 'failed';
    startedAt?: number;
    completedAt?: number;
    error?: { message: string; stack?: string };
  }

  export interface StoreNodeResultInput {
    routineId: string;
    nodeId: string;
    status: 'completed' | 'failed';
    output?: any;
    error?: { message: string; stack?: string };
    completedAt: number;
  }
  ```

  **File:** `packages/shared/src/temporal/constants.ts`

  ```typescript
  export const TASK_QUEUE_PREFIX = 'user-';
  export const DEFAULT_TASK_QUEUE = 'kianax-default';

  export const TIMEOUTS = {
    ACTIVITY_START_TO_CLOSE: '5 minutes',
    ACTIVITY_SCHEDULE_TO_CLOSE: '10 minutes',
    ACTIVITY_HEARTBEAT: '30 seconds'
  };

  export const RETRY_POLICY = {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '1m',
    maximumAttempts: 3
  };
  ```

  **File:** `packages/shared/src/temporal/index.ts`

  ```typescript
  export * from './types';
  export * from './constants';
  ```

- [ ] **1.2 Set Up Environment Variables**

  **Update `.env.local`:**
  ```bash
  # Temporal Configuration
  TEMPORAL_ADDRESS=localhost:7233
  TEMPORAL_NAMESPACE=default

  # Convex (already exists)
  CONVEX_DEPLOYMENT=dev:your-project
  NEXT_PUBLIC_CONVEX_URL=https://...
  CONVEX_DEPLOY_KEY=...
  ```

- [ ] **1.3 Install Dependencies**

  ```bash
  # In root
  bun install

  # In apps/server
  cd apps/server
  npm install @temporalio/client

  # Verify workers deps
  cd ../../workers
  bun install
  ```

**Validation:** TypeScript compiles without errors, env vars loaded

---

#### **Phase 2: Temporal Client (Convex)** (2-3 hours)

**Goal:** Enable Convex to start Temporal workflows

- [ ] **2.1 Create Temporal Client**

  **File:** `apps/server/convex/lib/temporal.ts`

  ```typescript
  import { Client, WorkflowHandle } from '@temporalio/client';

  let temporalClient: Client | null = null;

  export async function getTemporalClient(): Promise<Client> {
    if (!temporalClient) {
      const address = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
      const namespace = process.env.TEMPORAL_NAMESPACE || 'default';

      if (process.env.NODE_ENV === 'production') {
        // Production: Temporal Cloud with mTLS
        temporalClient = new Client({
          namespace,
          connection: {
            address,
            tls: {
              clientCertPair: {
                crt: Buffer.from(process.env.TEMPORAL_CLIENT_CERT!, 'base64'),
                key: Buffer.from(process.env.TEMPORAL_CLIENT_KEY!, 'base64')
              }
            }
          }
        });
      } else {
        // Development: local server, no TLS
        temporalClient = new Client({
          namespace,
          connection: { address }
        });
      }
    }

    return temporalClient;
  }

  export async function startRoutineWorkflow(
    routineId: string,
    userId: string,
    nodes: any[],
    connections: any[],
    triggerData?: any
  ): Promise<WorkflowHandle> {
    const client = await getTemporalClient();

    return await client.workflow.start('routineExecutor', {
      taskQueue: `user-${userId}`,
      workflowId: `routine-${routineId}-${Date.now()}`,
      args: [{
        routineId,
        userId,
        nodes,
        connections,
        triggerData
      }]
    });
  }

  export async function createCronSchedule(
    routineId: string,
    userId: string,
    schedule: string,
    timezone: string,
    nodes: any[],
    connections: any[]
  ): Promise<void> {
    const client = await getTemporalClient();

    await client.schedule.create({
      scheduleId: `routine-${routineId}`,
      spec: {
        cronExpressions: [schedule],
        timeZone: timezone || 'UTC'
      },
      action: {
        type: 'startWorkflow',
        workflowType: 'routineExecutor',
        taskQueue: `user-${userId}`,
        args: [{ routineId, userId, nodes, connections }]
      },
      policies: {
        pauseOnFailure: false,
        overlap: 'BUFFER_ONE'
      }
    });
  }

  export async function deleteCronSchedule(routineId: string): Promise<void> {
    const client = await getTemporalClient();
    await client.schedule.delete(`routine-${routineId}`);
  }
  ```

- [ ] **2.2 Create Trigger Handlers**

  **File:** `apps/server/convex/triggers/manual.ts`

  ```typescript
  import { mutation } from '../_generated/server';
  import { v } from 'convex/values';
  import { startRoutineWorkflow } from '../lib/temporal';

  export const executeRoutine = mutation({
    args: { routineId: v.id('routines') },
    handler: async (ctx, { routineId }) => {
      const userId = (await ctx.auth.getUserIdentity())?.subject;
      if (!userId) throw new Error('Not authenticated');

      const routine = await ctx.db.get(routineId);
      if (!routine || routine.userId !== userId) {
        throw new Error('Routine not found');
      }

      // Start workflow
      const handle = await startRoutineWorkflow(
        routine._id,
        userId,
        routine.nodes,
        routine.connections
      );

      // Create execution record
      await ctx.db.insert('routine_executions', {
        routineId: routine._id,
        userId,
        workflowId: handle.workflowId,
        status: 'running',
        triggerType: 'manual',
        startedAt: Date.now(),
        nodeStates: []
      });

      return { executionId: handle.workflowId };
    }
  });
  ```

  **File:** `apps/server/convex/triggers/cron.ts`

  ```typescript
  import { internalMutation } from '../_generated/server';
  import { v } from 'convex/values';
  import { createCronSchedule, deleteCronSchedule } from '../lib/temporal';

  export const activateCronTrigger = internalMutation({
    args: { routineId: v.id('routines') },
    handler: async (ctx, { routineId }) => {
      const routine = await ctx.db.get(routineId);
      if (!routine || routine.trigger.type !== 'cron') {
        throw new Error('Invalid routine for cron trigger');
      }

      await createCronSchedule(
        routine._id,
        routine.userId,
        routine.trigger.config.schedule,
        routine.trigger.config.timezone,
        routine.nodes,
        routine.connections
      );
    }
  });

  export const deactivateCronTrigger = internalMutation({
    args: { routineId: v.id('routines') },
    handler: async (ctx, { routineId }) => {
      await deleteCronSchedule(routineId);
    }
  });
  ```

**Validation:** Can call `getTemporalClient()` without errors

---

#### **Phase 3: Worker Implementation** (4-6 hours)

**Goal:** Implement workflow and activities that execute routines

- [ ] **3.1 Implement Workflow Utilities**

  **File:** `workers/src/workflows/utils/topological-sort.ts`

  ```typescript
  import type { Node, Connection } from '@kianax/shared/temporal';

  export function topologicalSort(
    nodes: Node[],
    connections: Connection[]
  ): Node[] {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // Initialize
    for (const node of nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }

    // Build graph
    for (const conn of connections) {
      adjacency.get(conn.sourceNodeId)!.push(conn.targetNodeId);
      inDegree.set(conn.targetNodeId, inDegree.get(conn.targetNodeId)! + 1);
    }

    // Find entry points
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) queue.push(nodeId);
    }
    queue.sort(); // Determinism

    // Kahn's algorithm
    const sorted: Node[] = [];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      sorted.push(nodeMap.get(nodeId)!);

      const neighbors = adjacency.get(nodeId)! || [];
      for (const neighborId of neighbors) {
        const newDegree = inDegree.get(neighborId)! - 1;
        inDegree.set(neighborId, newDegree);
        if (newDegree === 0) queue.push(neighborId);
      }
      queue.sort(); // Determinism
    }

    if (sorted.length !== nodes.length) {
      throw new Error('Cycle detected in routine DAG');
    }

    return sorted;
  }
  ```

  **File:** `workers/src/workflows/utils/gather-inputs.ts`

  ```typescript
  import type { Connection } from '@kianax/shared/temporal';

  export function gatherNodeInputs(
    nodeId: string,
    connections: Connection[],
    results: Map<string, any>,
    triggerData?: any
  ): any {
    const incoming = connections.filter(c => c.targetNodeId === nodeId);

    if (incoming.length === 0) {
      return triggerData || {};
    }

    if (incoming.length === 1) {
      return results.get(incoming[0].sourceNodeId);
    }

    // Multiple inputs
    const inputs: any = {};
    for (const conn of incoming) {
      const handle = conn.targetHandle || 'default';
      inputs[handle] = results.get(conn.sourceNodeId);
    }
    return inputs;
  }
  ```

- [ ] **3.2 Implement Main Workflow**

  **File:** `workers/src/workflows/routine-executor.ts`

  ```typescript
  import { proxyActivities } from '@temporalio/workflow';
  import type * as activities from '../activities';
  import type { RoutineInput } from '@kianax/shared/temporal';
  import { topologicalSort } from './utils/topological-sort';
  import { gatherNodeInputs } from './utils/gather-inputs';

  const {
    executePlugin,
    updateRoutineStatus,
    storeNodeResult
  } = proxyActivities<typeof activities>({
    startToCloseTimeout: '5 minutes',
    retry: {
      initialInterval: '1s',
      backoffCoefficient: 2,
      maximumInterval: '1m',
      maximumAttempts: 3
    }
  });

  export async function routineExecutor(input: RoutineInput): Promise<void> {
    const { routineId, userId, nodes, connections, triggerData } = input;

    await updateRoutineStatus({
      routineId,
      status: 'running',
      startedAt: Date.now()
    });

    try {
      const sortedNodes = topologicalSort(nodes, connections);
      const nodeResults = new Map<string, any>();

      for (const node of sortedNodes) {
        if (!node.enabled) continue;

        const inputs = gatherNodeInputs(
          node.id,
          connections,
          nodeResults,
          triggerData
        );

        try {
          const output = await executePlugin({
            pluginId: node.pluginId,
            config: node.config,
            inputs,
            context: { userId, routineId, nodeId: node.id }
          });

          nodeResults.set(node.id, output);

          await storeNodeResult({
            routineId,
            nodeId: node.id,
            status: 'completed',
            output,
            completedAt: Date.now()
          });
        } catch (error: any) {
          await storeNodeResult({
            routineId,
            nodeId: node.id,
            status: 'failed',
            error: { message: error.message, stack: error.stack },
            completedAt: Date.now()
          });
          throw error;
        }
      }

      await updateRoutineStatus({
        routineId,
        status: 'completed',
        completedAt: Date.now()
      });
    } catch (error: any) {
      await updateRoutineStatus({
        routineId,
        status: 'failed',
        error: { message: error.message, stack: error.stack },
        completedAt: Date.now()
      });
      throw error;
    }
  }
  ```

  **File:** `workers/src/workflows/index.ts`

  ```typescript
  export * from './routine-executor';
  ```

- [ ] **3.3 Implement Activities**

  **File:** `workers/src/activities/plugins.ts`

  ```typescript
  import { Context } from '@temporalio/activity';
  import type { ExecutePluginInput } from '@kianax/shared/temporal';

  export async function executePlugin(
    input: ExecutePluginInput
  ): Promise<any> {
    const { pluginId, config, inputs, context } = input;

    Context.current().heartbeat();

    // TODO: Load plugin from Convex and execute
    // For now, return mock data
    console.log('Executing plugin:', pluginId, 'for user:', context.userId);

    return { success: true, data: 'Mock plugin output' };
  }
  ```

  **File:** `workers/src/activities/convex.ts`

  ```typescript
  import { ConvexHttpClient } from 'convex/browser';
  import type {
    UpdateRoutineStatusInput,
    StoreNodeResultInput
  } from '@kianax/shared/temporal';

  const convex = new ConvexHttpClient(process.env.CONVEX_URL!);

  export async function updateRoutineStatus(
    input: UpdateRoutineStatusInput
  ): Promise<void> {
    // TODO: Implement Convex mutation to update execution status
    console.log('Updating routine status:', input);
  }

  export async function storeNodeResult(
    input: StoreNodeResultInput
  ): Promise<void> {
    // TODO: Implement Convex mutation to store node result
    console.log('Storing node result:', input);
  }
  ```

  **File:** `workers/src/activities/index.ts`

  ```typescript
  export * from './plugins';
  export * from './convex';
  ```

- [ ] **3.4 Create Worker Bootstrap**

  **File:** `workers/src/worker.ts`

  ```typescript
  import { NativeConnection, Worker } from '@temporalio/worker';
  import * as activities from './activities';

  export async function createWorker(taskQueue: string): Promise<Worker> {
    const connection = await NativeConnection.connect({
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233'
    });

    return await Worker.create({
      connection,
      namespace: process.env.TEMPORAL_NAMESPACE || 'default',
      taskQueue,
      workflowsPath: require.resolve('./workflows'),
      activities
    });
  }

  export async function runWorker(taskQueue: string = 'default'): Promise<void> {
    const worker = await createWorker(taskQueue);
    console.log(`Worker started on task queue: ${taskQueue}`);
    await worker.run();
  }
  ```

  **File:** `workers/src/dev-worker.ts`

  ```typescript
  import { runWorker } from './worker';

  async function main() {
    const taskQueue = process.env.TASK_QUEUE || 'user-default';
    await runWorker(taskQueue);
  }

  main().catch(err => {
    console.error('Worker failed:', err);
    process.exit(1);
  });
  ```

- [ ] **3.5 Update Worker Package Scripts**

  **Update `workers/package.json`:**
  ```json
  {
    "scripts": {
      "dev": "tsx watch src/dev-worker.ts",
      "start": "node dist/worker.js",
      "build": "tsc"
    }
  }
  ```

**Validation:** Worker starts without errors, connects to Temporal server

---

#### **Phase 4: Integration & Testing** (2-3 hours)

**Goal:** Wire everything together and test end-to-end

- [ ] **4.1 Start Local Temporal Server**

  ```bash
  temporal server start-dev
  ```

  Verify:
  - Server running on `localhost:7233`
  - Web UI accessible at `localhost:8233`

- [ ] **4.2 Start Worker**

  ```bash
  cd workers
  bun run dev
  ```

  Verify: Worker connects and logs "Worker started on task queue: user-default"

- [ ] **4.3 Test Manual Trigger**

  ```bash
  # Create a test routine in Convex
  npx convex run routines:create --args '{
    "name": "Test Routine",
    "trigger": {"type": "manual"},
    "nodes": [
      {
        "id": "node1",
        "pluginId": "test-plugin",
        "type": "input",
        "config": {},
        "enabled": true
      }
    ],
    "connections": []
  }'

  # Execute it manually
  npx convex run triggers/manual:executeRoutine --args '{"routineId": "<id>"}'
  ```

  Verify in Temporal Web UI:
  - Workflow `routine-<id>-<timestamp>` appears
  - Workflow completes successfully
  - Activities executed in order

- [ ] **4.4 Test Cron Trigger**

  ```bash
  # Activate cron trigger
  npx convex run triggers/cron:activateCronTrigger --args '{"routineId": "<id>"}'
  ```

  Verify:
  - Schedule appears in Temporal Web UI
  - Workflow executes on schedule
  - Can pause/resume schedule

**Validation:** Manual trigger works, cron schedule created successfully

---

### Testing Checklist

- [ ] **Unit Tests**
  - [ ] `topologicalSort` handles DAGs correctly
  - [ ] `topologicalSort` detects cycles
  - [ ] `gatherNodeInputs` handles single/multiple inputs

- [ ] **Integration Tests**
  - [ ] Worker connects to Temporal server
  - [ ] Workflow can be started via Temporal Client
  - [ ] Activities execute and return values
  - [ ] Convex receives status updates

- [ ] **End-to-End Tests**
  - [ ] User activates routine → workflow starts
  - [ ] Routine executes → plugins run in order
  - [ ] Errors handled gracefully
  - [ ] UI shows real-time updates

---

### Production Deployment Checklist

- [ ] **Environment Variables**
  - [ ] `TEMPORAL_ADDRESS` set to Temporal Cloud
  - [ ] `TEMPORAL_NAMESPACE` configured
  - [ ] `TEMPORAL_CLIENT_CERT` (base64)
  - [ ] `TEMPORAL_CLIENT_KEY` (base64)
  - [ ] `CONVEX_URL` set to production Convex

- [ ] **Worker Deployment**
  - [ ] Docker image built
  - [ ] Deployed to production (server/Kubernetes)
  - [ ] Auto-scaling configured
  - [ ] Health checks enabled

- [ ] **Monitoring**
  - [ ] Temporal Cloud dashboard accessible
  - [ ] Convex logs streaming
  - [ ] Alerts configured for failures

---

### Troubleshooting

**Worker won't connect to Temporal:**
- Check `TEMPORAL_ADDRESS` is correct
- Verify Temporal server is running (`temporal server start-dev`)
- Check network connectivity / firewalls

**Workflow not executing:**
- Verify worker is polling the correct task queue (`user-${userId}`)
- Check Temporal Web UI for pending tasks
- Review worker logs for errors

**Activities failing:**
- Check activity timeout configuration
- Review error messages in Temporal Web UI
- Verify Convex URL is accessible from workers

**Type errors:**
- Ensure `@kianax/shared` is built: `cd packages/shared && npm run build`
- Verify TypeScript path mappings in `tsconfig.json`

---

## Summary

**Key Takeaways:**

1. **One Workflow, Many Routines:** The `routineExecutor` workflow is generic and interprets user routine DAGs at runtime

2. **Triggers are Metadata:** Triggers (cron/webhook/manual/event) determine WHEN routines start, but are not part of the executable DAG

3. **Activities are Plugin Execution:** Each plugin node executes as a Temporal Activity with automatic retries

4. **Multi-Tenancy via Task Queues:** Each user gets a dedicated task queue for isolation and scalability

5. **Convex + Temporal Partnership:**
   - Convex stores routine definitions and starts workflows
   - Temporal executes the routines durably
   - Activities update Convex with real-time status
   - UI subscribes to Convex for live updates

6. **Developer Experience:**
   - Local dev: `temporal server start-dev` + worker
   - Production: Temporal Cloud + deployed workers
   - Zero infrastructure management (serverless)

This architecture provides **reliability, observability, and scalability** for executing user-defined automations at any scale.
