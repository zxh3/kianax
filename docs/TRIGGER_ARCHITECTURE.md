# Trigger Architecture Review

**Question:** Is the Temporal + Convex combination sufficient for all trigger types (cron, webhook, event-based, manual)?

**Answer:** ✅ **Yes, with clarifications on trigger implementation patterns**

---

## Architecture Overview

**Two-Phase System:**

1. **Trigger Registration** (Convex) - Interprets trigger nodes and sets up activation
2. **Workflow Execution** (Temporal) - Executes the workflow DAG when triggered

**Key Insight:** Trigger nodes in the workflow DAG are **configuration metadata**, not executable code. They tell the system HOW to start the workflow, not WHAT the workflow does.

---

## Trigger Type Implementation

### 1. Cron Trigger ✅

**How it works:**
```typescript
// When user activates workflow with cron trigger
export const activate = mutation({
  handler: async (ctx, args) => {
    const workflow = await ctx.db.get(args.workflowId);
    const triggerNode = workflow.nodes.find(n => n.type === 'trigger' && n.pluginId === 'cron');

    // Start Temporal workflow with Schedule
    await temporal.schedule.create({
      scheduleId: `workflow-${workflow.id}`,
      spec: {
        cronExpressions: [triggerNode.config.cronPattern], // e.g., "*/5 * * * *"
      },
      action: {
        type: 'startWorkflow',
        workflowType: 'userWorkflowExecutor',
        taskQueue: `user-${userId}`,
        args: [workflow],
      },
    });

    await ctx.db.patch(args.workflowId, { status: 'active' });
  }
});
```

**Temporal Features Used:**
- **Schedules API** (newer, more powerful than legacy cronSchedule parameter)
- Supports cron expressions, intervals, and calendar-based schedules
- **On-demand triggering** via `schedule.trigger()` for "Run Now" button
- Overlap policies (allow, buffer-one, skip, cancel) for concurrent executions

**Example:** "Check stock price every 5 minutes"
- Cron: `*/5 * * * *`
- Temporal runs workflow every 5 minutes automatically
- User can also click "Run Now" to trigger immediately (via schedule.trigger())

---

### 2. Webhook Trigger ✅

**How it works:**
```typescript
// Convex HTTP action (webhook endpoint)
export const webhook = httpAction(async (ctx, request) => {
  const { workflowId } = await request.json();
  const workflow = await ctx.runQuery(internal.workflows.get, { id: workflowId });

  // Validate webhook signature/token
  const triggerNode = workflow.nodes.find(n => n.type === 'trigger' && n.pluginId === 'webhook');
  if (!validateWebhookAuth(request.headers, triggerNode.config.secret)) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Start Temporal workflow execution
  const temporal = await getTemporalClient();
  await temporal.workflow.start('userWorkflowExecutor', {
    workflowId: `webhook-${workflowId}-${Date.now()}`,
    taskQueue: `user-${workflow.userId}`,
    args: [workflow, { triggerData: await request.json() }],
  });

  return new Response('Workflow triggered', { status: 200 });
});
```

**Stack:**
- **Convex HTTP actions** receive webhook requests (public HTTPS endpoints)
- Webhook endpoint: `https://your-project.convex.site/webhook/{workflowId}`
- Convex validates auth and starts Temporal workflow
- Temporal executes the workflow with webhook payload

**Example:** "When GitHub push event received, deploy app"
- GitHub webhook → Convex HTTP endpoint → Start Temporal workflow
- Webhook payload (commit SHA, branch, etc.) passed to workflow

---

### 3. Event Trigger (Data Changes) ✅

**How it works:**

**Option A: Polling (for external data sources)**
```typescript
// Convex scheduled function (runs every minute)
export const checkEventTriggers = internalMutation({
  handler: async (ctx) => {
    const workflows = await ctx.db.query("workflows")
      .filter(q => q.eq(q.field("status"), "active"))
      .collect();

    for (const workflow of workflows) {
      const triggerNode = workflow.nodes.find(n => n.type === 'trigger' && n.pluginId === 'event');

      if (triggerNode?.config.eventType === 'stock-price-drop') {
        const currentPrice = await fetchStockPrice(triggerNode.config.symbol);
        const lastPrice = await ctx.db.query("event_state")
          .filter(q => q.eq(q.field("workflowId"), workflow._id))
          .first();

        // Check condition
        if (lastPrice && (lastPrice.value - currentPrice) / lastPrice.value > 0.05) {
          // Trigger workflow
          await startTemporalWorkflow(workflow, {
            triggerData: { symbol: triggerNode.config.symbol, currentPrice, lastPrice: lastPrice.value }
          });
        }

        // Update state
        await ctx.db.insert("event_state", { workflowId: workflow._id, value: currentPrice });
      }
    }
  },
});
```

**Option B: Database Triggers (for Convex data)**
```typescript
// Convex mutation that triggers workflow when data changes
export const createOrder = mutation({
  handler: async (ctx, args) => {
    const orderId = await ctx.db.insert("orders", args);

    // Check for workflows triggered by new orders
    const workflows = await ctx.db.query("workflows")
      .filter(q => q.eq(q.field("status"), "active"))
      .collect();

    for (const workflow of workflows) {
      const triggerNode = workflow.nodes.find(n =>
        n.type === 'trigger' &&
        n.pluginId === 'event' &&
        n.config.eventType === 'order.created'
      );

      if (triggerNode) {
        await startTemporalWorkflow(workflow, { triggerData: { orderId, ...args } });
      }
    }

    return orderId;
  }
});
```

**Stack:**
- **Convex scheduled functions** poll external APIs (every 1-60 minutes)
- **Convex mutations** detect internal data changes
- When condition met → Start Temporal workflow
- Temporal executes the workflow

**Example:** "When AAPL drops 5%, send alert"
- Convex scheduled function fetches price every 5 minutes
- Compares with previous price
- If dropped 5% → Start Temporal workflow

---

### 4. Manual Trigger ✅

**How it works:**
```typescript
// User clicks "Run Now" button
export const triggerManually = mutation({
  args: { workflowId: v.id("workflows") },
  handler: async (ctx, args) => {
    const workflow = await ctx.db.get(args.workflowId);
    const userId = (await ctx.auth.getUserIdentity())?.subject;

    // Validate user owns workflow
    if (workflow.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Start Temporal workflow
    const temporal = await getTemporalClient();
    await temporal.workflow.start('userWorkflowExecutor', {
      workflowId: `manual-${args.workflowId}-${Date.now()}`,
      taskQueue: `user-${userId}`,
      args: [workflow, { triggerData: { triggeredBy: 'user', timestamp: Date.now() } }],
    });

    return { status: 'triggered' };
  }
});
```

**Stack:**
- User clicks button in frontend
- Convex mutation validates and starts Temporal workflow
- Temporal executes immediately

**Example:** "Run my stock analysis workflow now"
- User clicks "Run Now"
- Workflow executes immediately with current data

---

## Workflow Execution Flow

Once triggered (by any method above), the workflow executes identically:

```typescript
// Temporal Worker - workers/workflows/executor.ts
export async function userWorkflowExecutor(
  workflowDef: WorkflowDAG,
  context?: { triggerData?: any }
) {
  const results = new Map();

  // Find trigger nodes and inject trigger data
  const triggerNodes = workflowDef.nodes.filter(n => n.type === 'trigger');
  for (const triggerNode of triggerNodes) {
    results.set(triggerNode.id, {
      timestamp: Date.now(),
      ...context?.triggerData,
    });
  }

  // Get nodes after triggers (the actual workflow logic)
  const executionNodes = workflowDef.nodes.filter(n => n.type !== 'trigger');

  // Execute DAG in topological order
  for (const node of topologicalSort(executionNodes, workflowDef.edges)) {
    const inputs = gatherInputs(node, results, workflowDef.edges);

    // Execute plugin as Temporal Activity
    const output = await executeActivity(
      getPluginActivity(node.pluginId),
      { config: node.config, inputs },
      { startToCloseTimeout: '5m', retry: { maximumAttempts: 3 } }
    );

    results.set(node.id, output);

    // Update Convex with execution status
    await executeActivity(updateExecutionStatus, {
      workflowId: workflowDef.id,
      nodeId: node.id,
      status: 'completed',
      output,
    });
  }

  return results;
}
```

**Key Points:**
1. Trigger nodes DON'T execute - they provide trigger data (timestamp, webhook payload, etc.)
2. Execution starts from nodes connected to trigger outputs
3. All plugin code runs as Temporal Activities
4. Convex receives real-time updates via activities

---

## Multi-Trigger Workflows

**Can a workflow have multiple triggers?**

**Answer:** Yes, but with caveats:

### Scenario 1: Multiple Manual Triggers
✅ **Supported** - Different entry points for the same workflow
```
Trigger A (Manual) → Path 1 → Output
Trigger B (Manual) → Path 2 → Output
```
User chooses which trigger to fire manually.

### Scenario 2: Multiple Cron Triggers
❌ **Not recommended** - Use multiple schedules instead
```
Workflow A (Cron every hour) → Logic
Workflow B (Cron every day) → Logic
```
Better: Create separate workflows for different schedules.

### Scenario 3: Cron + Manual
✅ **Supported via Temporal Schedules**
- Schedule runs workflow automatically
- User can also trigger manually via `schedule.trigger()`
- Same workflow, two activation methods

### Scenario 4: Webhook + Cron
⚠️ **Supported but complex** - Different trigger sources
```typescript
// Create schedule for cron
await temporal.schedule.create({
  scheduleId: `workflow-${workflowId}`,
  spec: { cronExpressions: ['0 * * * *'] },
  action: { workflowType: 'userWorkflowExecutor', args: [workflow] },
});

// Also create webhook endpoint
// When webhook called → temporal.workflow.start() directly
```

**Recommendation:** Keep it simple - one primary trigger per workflow. Use sub-workflows for reusable logic.

---

## Summary

### ✅ All Trigger Types Supported

| Trigger Type | Implementation | Status |
|--------------|----------------|--------|
| **Cron** | Temporal Schedules | ✅ Native support |
| **Webhook** | Convex HTTP Actions → Temporal | ✅ Hybrid approach |
| **Event (external)** | Convex scheduled functions → Temporal | ✅ Polling approach |
| **Event (internal)** | Convex mutations → Temporal | ✅ Database triggers |
| **Manual** | Convex mutation → Temporal | ✅ Direct invocation |

### Architecture Strengths

1. **Separation of Concerns**
   - Convex: Trigger detection, auth, data storage
   - Temporal: Workflow execution, retries, observability

2. **Scalability**
   - Convex auto-scales HTTP endpoints
   - Temporal handles millions of workflows
   - Workers scale horizontally

3. **Reliability**
   - Temporal's durable execution survives crashes
   - Convex's real-time updates for status
   - Built-in retries and error handling

4. **Developer Experience**
   - TypeScript end-to-end
   - Real-time updates (no polling in frontend)
   - Time-travel debugging (Temporal)

### Limitations

1. **Event Triggers require polling** - Convex scheduled functions limited to 1-minute intervals
   - **Mitigation:** For sub-minute precision, use webhook triggers or Temporal Schedules

2. **Two systems to manage** - Convex + Temporal Cloud
   - **Mitigation:** Both are managed services, minimal operational overhead

3. **Cost** - ~$265/month for production (vs. self-hosted ~$0)
   - **Mitigation:** Worth it for reliability and developer velocity

---

## Recommendation

✅ **Temporal + Convex is sufficient and recommended**

**Why:**
- All trigger types supported
- Battle-tested at scale (Uber, Netflix, Stripe use Temporal)
- Real-time updates out of the box (Convex)
- No infrastructure management
- TypeScript end-to-end

**Next Steps:**
1. Implement basic cron trigger first (Phase 0-3)
2. Add webhook triggers (Phase 4)
3. Add event triggers last (Phase 5) - most complex

This architecture will scale from 1 user to 100,000 users without redesign.
