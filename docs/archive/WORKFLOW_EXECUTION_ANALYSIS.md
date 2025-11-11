# Workflow Execution: trigger.dev vs Temporal Cloud

**Problem Statement:** How do user-created workflows (stored as DAGs in Convex) get executed at runtime?

**Challenge:** Each user can create unlimited workflows dynamically. We need a scalable, multi-tenant execution engine.

---

## Architecture Patterns

### Pattern 1: Interpreter (Runtime Execution)

**How it works:**
- Deploy ONE generic "workflow executor" task
- User workflows (DAG JSON) stored in Convex
- When workflow triggers, pass DAG as payload to executor
- Executor interprets and executes DAG at runtime

```typescript
// SINGLE deployed task for all workflows
export const workflowExecutor = task({
  id: "workflow-executor",
  run: async ({ workflowId, userId }) => {
    // 1. Load workflow definition from Convex
    const workflow = await convex.query("workflows:get", { workflowId });

    // 2. Execute nodes in topological order
    const results = {};
    for (const node of topologicalSort(workflow.nodes, workflow.edges)) {
      // 3. Get plugin executor
      const plugin = await getPlugin(node.pluginId);

      // 4. Execute plugin with inputs from previous nodes
      const inputs = gatherInputs(node, results, workflow.edges);
      results[node.id] = await plugin.execute(inputs, node.config);

      // 5. Update execution status in Convex
      await convex.mutation("executions:updateNode", {
        nodeId: node.id,
        status: "completed",
        output: results[node.id]
      });
    }
  }
});

// Schedule dynamically per workflow
await schedules.create({
  task: workflowExecutor.id,
  cron: workflow.cronPattern,
  payload: { workflowId, userId },
  externalId: `${userId}-${workflowId}` // Multi-tenant isolation
});
```

**Pros:**
- ✅ One deployment for all workflows
- ✅ Users can create workflows instantly (no deployment needed)
- ✅ Easy to update workflow logic globally
- ✅ Simple multi-tenancy (externalId)

**Cons:**
- ❌ Harder debugging (all workflows share same task)
- ❌ Limited observability (can't see workflow structure in trigger.dev UI)
- ❌ Complex error handling (need to interpret DAG failures)
- ❌ No workflow versioning built-in

---

### Pattern 2: Code Generation (Compile-time)

**How it works:**
- Each workflow compiles to TypeScript code
- Deploy as separate task to trigger.dev
- Direct execution (no interpretation)

```typescript
// Auto-generated code for each workflow
export const workflow_abc123 = task({
  id: "workflow-abc123",
  run: async (payload) => {
    const node1 = await stockPricePlugin.execute({ symbol: "AAPL" });
    const node2 = await aiProcessorPlugin.execute({
      input: node1,
      instruction: "Check if dropped 5%"
    });

    if (node2.dropped) {
      await tradingPlugin.execute({ action: "buy", amount: 1000 });
    }
  }
});
```

**Pros:**
- ✅ Better debugging (each workflow is visible code)
- ✅ Better observability (see structure in trigger.dev UI)
- ✅ Faster execution (no interpretation overhead)
- ✅ Type-safe execution

**Cons:**
- ❌ Need deployment infrastructure for every workflow activation
- ❌ Slower to activate workflows (compile + deploy)
- ❌ Harder to update workflow engine globally
- ❌ May hit trigger.dev task limits with many users

**Key Question:** Can trigger.dev deploy tasks dynamically?
- **Answer:** No clear documentation on this. Tasks appear to be deployed via CLI/CI.
- Would need custom deployment pipeline to compile and deploy user workflows.

---

## Temporal Cloud Alternative

Temporal is **designed** for Pattern 1 (dynamic workflows) from the ground up.

```typescript
// Define workflow TYPE once
async function userWorkflowExecutor(workflowDef: WorkflowDAG) {
  const results = {};

  for (const node of topologicalSort(workflowDef.nodes)) {
    // Execute as Temporal activity
    results[node.id] = await executeActivity(
      getPluginActivity(node.pluginId),
      gatherInputs(node, results),
      { startToCloseTimeout: '5m' }
    );
  }

  return results;
}

// Start workflow dynamically per user
await client.workflow.start(userWorkflowExecutor, {
  taskQueue: `user-${userId}`,  // Multi-tenant isolation
  workflowId: `workflow-${workflowId}`,
  args: [workflowDAG],
  cronSchedule: workflow.cronPattern // Built-in cron support
});
```

**Temporal Advantages:**
- ✅ **True dynamic workflows** - designed for this use case
- ✅ **Workflow versioning** - update logic without breaking running workflows
- ✅ **Better multi-tenancy** - task queues per user/tier
- ✅ **Superior observability** - workflow history, replay, time-travel debugging
- ✅ **Deterministic execution** - guarantees reliability
- ✅ **Built-in cron** - no separate scheduling system
- ✅ **Signals/queries** - pause/resume/query running workflows
- ✅ **Unlimited duration** - workflows can run for months/years
- ✅ **Mature ecosystem** - battle-tested at Uber, Netflix, Stripe

**Temporal Disadvantages:**
- ❌ **Steeper learning curve** - more concepts to learn
- ❌ **More expensive** - Temporal Cloud pricing higher than trigger.dev
- ❌ **More operational complexity** - if self-hosting
- ❌ **Requires Workers** - need to deploy and manage worker processes
- ❌ **Go/Java heritage** - TypeScript SDK is newer (though mature now)

---

## Recommendation

### For Kianax Use Case:

**Go with Temporal Cloud** if:
- ✅ You need true dynamic workflow execution
- ✅ You expect complex, long-running workflows (hours/days)
- ✅ You need workflow versioning (users update workflows)
- ✅ You want best-in-class observability and debugging
- ✅ You're building a production workflow platform (not just a side feature)

**Go with trigger.dev** if:
- ✅ You want simpler developer experience
- ✅ Your workflows are relatively simple and short (< 1 hour)
- ✅ You want to stay 100% serverless (no workers to manage)
- ✅ You're prototyping and want faster iteration
- ✅ Cost is a major concern early on

---

## My Recommendation: **Temporal Cloud**

**Why:**

1. **Kianax IS a workflow platform** - this is the core product, not a side feature
2. **User workflows are dynamic** - users create/update workflows constantly
3. **Complexity is inevitable** - parallel branches, conditions, sub-workflows, error handling
4. **Need workflow versioning** - when users update workflows, old executions shouldn't break
5. **Observability is critical** - users need to see what their workflows are doing
6. **Long-term scalability** - built for Uber-scale workflow orchestration

**Migration Path:**
- Start with Temporal Cloud (managed service, zero ops)
- Build Temporal Workers in TypeScript (runs alongside Next.js/Convex)
- Workers execute plugin code (same plugin SDK)
- Convex still stores workflows, credentials, execution metadata
- Temporal handles execution orchestration only

**Updated Architecture:**

```
User creates workflow in Next.js
  ↓
Saved to Convex (workflows table)
  ↓
User activates workflow
  ↓
Convex mutation → Temporal Client
  ↓
Temporal starts workflow (dynamic execution)
  ↓
Temporal Workers execute activities (plugin code)
  ↓
Activities call back to Convex (update execution status)
  ↓
Frontend receives real-time updates (Convex subscriptions)
```

**Stack:**
- **Frontend:** Next.js + Convex React hooks (unchanged)
- **Database:** Convex (unchanged)
- **Auth:** Convex Auth (unchanged)
- **Workflows:** Temporal Cloud (replaces trigger.dev)
- **Workers:** TypeScript Workers (deployed on Vercel or separate server)
- **Plugins:** Same SDK, executed as Temporal Activities

---

## Cost Comparison

**Temporal Cloud:**
- Free tier: 1M actions/month
- Growth: $200/month for 25M actions
- Enterprise: Custom pricing

**trigger.dev:**
- Free tier: 1M task executions/month
- Pro: $50/month for 5M executions
- Enterprise: Custom pricing

**Verdict:** trigger.dev is cheaper, but Temporal provides more value for a workflow platform.

---

## Alternative: Hybrid Approach

**Use both:**
- **Temporal** for complex user workflows (the main product)
- **trigger.dev** for simple internal tasks (email sending, webhooks, data sync)

This separates concerns:
- User-facing workflows → Temporal (needs reliability, observability)
- Internal automation → trigger.dev (simpler, cheaper)

---

## Next Steps

**If choosing Temporal:**
1. Set up Temporal Cloud account
2. Build TypeScript Worker with plugin SDK
3. Update ARCHITECTURE.md with Temporal flow
4. Prototype: Simple workflow (Cron → Stock Price → Email)
5. Test: Multi-tenant isolation, workflow updates, observability

**If choosing trigger.dev:**
1. Implement Pattern 1 (Interpreter)
2. Build generic workflow executor task
3. Test: Multiple users, multiple workflows, concurrency
4. Assess: Observability, debugging, limitations
5. Plan: Migration to Temporal if needed later

---

## Conclusion

**Temporal is the right choice for Kianax** because:
- It's purpose-built for exactly this use case
- Workflow orchestration is your core product
- You need reliability, versioning, and observability at scale
- The learning curve is worth it for a workflow platform

trigger.dev is great for simpler task queuing, but Temporal is the industry standard for dynamic, user-defined workflows.
