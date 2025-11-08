# Kianax Architecture

AI-native workflow platform where users describe automations in natural language, and plugins connect any data source to any action.

## Core Vision

**"Talk to Create Workflows"** - AI builds automations for you.

Users describe what they want → AI translates to executable workflows → Plugins provide the building blocks.

**Example:** "When AAPL drops 5%, analyze sentiment. If positive, buy $1000."

**Result:** Cron Trigger → Stock Price Input → AI Processor → News Input → AI Processor → Logic Condition → Trading Output

## Stack

**Frontend:** Next.js 16 + React 19 + Convex React hooks
**Backend:** Convex (serverless functions + real-time database + auth)
**Workflows:** trigger.dev (execution engine, triggers, retries)
**AI:** OpenAI (GPT-4 for parsing, GPT-3.5 for transformations)
**Deploy:** Vercel + Convex (zero infrastructure management)

**Why Convex?**
- Real-time by default (no WebSocket server needed)
- TypeScript-native (schema in code, no migrations)
- Built-in auth & encryption
- Auto-scaling, pay-per-use
- Perfect for solo developers

## Core Concepts

### 1. Node Types

Workflows are built from **5 fundamental node types**:

**1. Triggers** - Start workflow execution
- Cron (time-based schedules)
- Webhook (HTTP events)
- Manual (user-initiated)
- Platform events (data changes, system events)

**2. Inputs** - Fetch data from external sources
- APIs (REST, GraphQL, web scraping)
- Databases (queries, reads)
- Files (download, parse)
- Streams (RSS, WebSocket)

**3. Processors** - Transform and analyze data
- AI (LLMs, sentiment, summarization, classification)
- Data transformation (format conversion, mapping, filtering)
- Computation (math, aggregation, validation)
- Parsing (JSON, XML, CSV)

**4. Logic** - Control execution flow
- Conditions (if/else branching)
- Switches (multi-branch routing)
- Loops (iterate over arrays)
- Error handling (try/catch, retry)
- Delays (wait, sleep)

**5. Outputs** - Write data or perform actions
- APIs (POST, PUT, DELETE)
- Databases (insert, update, delete)
- Notifications (email, SMS, push)
- Integrations (trading, CRM, storage)
- Sub-workflows (call other workflows)

**Type-Safe Connections:**
- Nodes connect when output schema matches input schema
- If types don't match, insert an AI Processor to adapt data
- All connections validated before workflow activation

**AI Processor = Universal Adapter:**
```typescript
Input: { symbol: "AAPL", price: 150 }
Instruction: "Transform to { ticker, currentPrice, action: 'buy' }"
Output: { ticker: "AAPL", currentPrice: 150, action: "buy" }
```

This taxonomy is **future-proof**: any new plugin fits into one of these 5 categories based on its role in the workflow.

### 2. Workflow Types

**Root Workflows** (autonomous):
- MUST have trigger node
- Run independently on schedule/event
- Example: "Stock price monitor"

**Sub-Workflows** (reusable):
- NO trigger nodes
- Called by other workflows
- Example: "Send notification"

### 3. Workflow Validation

**Root Workflow Requirements:**
- MUST have at least one Trigger node
- All Trigger nodes must be entry points (no incoming edges)
- Trigger nodes can only be: Cron, Webhook, Manual, or Platform Event types
- At least one execution path from Trigger to an Output node
- DAG structure (no cycles allowed)
- No orphaned nodes (all nodes must be reachable from a Trigger)

**Sub-Workflow Requirements:**
- MUST NOT have any Trigger nodes
- Must define input/output schemas (entry/exit points)
- DAG structure (no cycles allowed)
- All nodes must be connected in valid execution flow

**General Validation:**
- **Type Compatibility**: Connected nodes must have matching schemas (or AI Processor auto-inserted)
- **Plugin Requirements**: All required plugin configurations present (API endpoints, parameters)
- **Credentials**: All plugins requiring credentials have them configured by user
- **No Cycles**: Graph is acyclic (topological sort possible)
- **Reachability**: All nodes reachable from entry points

**Workflow States:**
- `draft` - Being edited, validation may fail, cannot execute
- `active` - Validated and enabled, executing on triggers
- `paused` - Validated but disabled, not executing
- `archived` - Saved for reference, cannot execute

**Activation Requirements:**
Users can only activate a workflow (draft → active) when:
1. Workflow passes all validation rules
2. All required plugins are installed
3. All required credentials are configured
4. For workflows from templates: user has reviewed and customized

**Validation Algorithms:**

```typescript
// 1. Check for Trigger nodes (Root workflows only)
function validateTriggers(workflow) {
  const triggerNodes = nodes.filter(n => n.type === 'trigger');

  if (workflow.type === 'root' && triggerNodes.length === 0) {
    return error("Root workflows must have at least one Trigger node");
  }

  if (workflow.type === 'sub-workflow' && triggerNodes.length > 0) {
    return error("Sub-workflows cannot have Trigger nodes");
  }

  // Triggers must be entry points (no incoming edges)
  for (const trigger of triggerNodes) {
    if (edges.some(e => e.target === trigger.id)) {
      return error("Trigger nodes cannot have incoming connections");
    }
  }
}

// 2. Check for cycles (must be DAG)
function validateDAG(nodes, edges) {
  const visited = new Set();
  const recursionStack = new Set();

  function hasCycle(nodeId) {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const outgoing = edges.filter(e => e.source === nodeId);
    for (const edge of outgoing) {
      if (!visited.has(edge.target)) {
        if (hasCycle(edge.target)) return true;
      } else if (recursionStack.has(edge.target)) {
        return true; // Cycle detected
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  return nodes.some(n => hasCycle(n.id));
}

// 3. Check reachability (no orphaned nodes)
function validateReachability(workflow) {
  const entryPoints = workflow.type === 'root'
    ? nodes.filter(n => n.type === 'trigger')
    : [workflow.entryNode];

  const reachable = new Set();

  function dfs(nodeId) {
    reachable.add(nodeId);
    const outgoing = edges.filter(e => e.source === nodeId);
    outgoing.forEach(e => {
      if (!reachable.has(e.target)) dfs(e.target);
    });
  }

  entryPoints.forEach(ep => dfs(ep.id));

  const orphans = nodes.filter(n => !reachable.has(n.id));
  if (orphans.length > 0) {
    return error(`Orphaned nodes: ${orphans.map(n => n.id).join(', ')}`);
  }
}

// 4. Check type compatibility
function validateTypes(edges, nodes) {
  for (const edge of edges) {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    const sourceOutput = getPluginOutputSchema(sourceNode.pluginId);
    const targetInput = getPluginInputSchema(targetNode.pluginId);

    if (!schemasCompatible(sourceOutput, targetInput)) {
      // Auto-insert AI Processor if schemas don't match
      insertAIProcessor(edge, sourceOutput, targetInput);
    }
  }
}
```

### 4. Execution Flow

> **Note:** See [WORKFLOW_EXECUTION_ANALYSIS.md](./WORKFLOW_EXECUTION_ANALYSIS.md) for detailed comparison of Temporal vs trigger.dev execution engines.

**Recommended: Temporal Cloud** (designed for dynamic, user-defined workflows)

**Architecture:**

```typescript
// Workflow executor (runs in Temporal Worker)
async function userWorkflowExecutor(workflowDef: WorkflowDAG) {
  const results = new Map();

  // Execute nodes in topological order
  for (const node of topologicalSort(workflowDef.nodes, workflowDef.edges)) {
    // Gather inputs from connected nodes
    const inputs = workflowDef.edges
      .filter(e => e.target === node.id)
      .map(e => results.get(e.source));

    // Execute node as Temporal Activity
    const output = await executeActivity(
      getPluginActivity(node.pluginId),
      {
        config: node.config,
        inputs: inputs,
        userId: workflowDef.userId
      },
      {
        startToCloseTimeout: '5m',
        retry: { maximumAttempts: 3 }
      }
    );

    results.set(node.id, output);

    // Update execution status in Convex (via activity)
    await executeActivity(updateExecutionStatus, {
      workflowId: workflowDef.id,
      nodeId: node.id,
      status: 'completed',
      output
    });
  }

  return results;
}

// Start workflow dynamically when user activates
await temporal.workflow.start(userWorkflowExecutor, {
  taskQueue: `user-${userId}`,  // Multi-tenant isolation
  workflowId: `workflow-${workflowId}`,
  args: [workflowDAG],
  cronSchedule: workflow.cronPattern  // For Cron triggers
});
```

**Trigger Types → Temporal:**
- **Cron Trigger**: `cronSchedule` parameter in workflow.start()
- **Webhook Trigger**: HTTP endpoint in Convex → `workflow.start()`
- **Manual Trigger**: User button → `workflow.start()`
- **Platform Event**: Convex subscription → `workflow.start()`

**Execution Process:**
```
1. User creates workflow in Convex (draft state)
2. User activates workflow (validation runs)
3. Convex mutation → Temporal Client
4. Temporal starts workflow execution
5. Temporal Workers execute activities (plugin code)
6. Each node execution:
   - Worker calls plugin.execute()
   - Plugin interacts with external APIs
   - Results saved to Convex via activity
7. Convex broadcasts updates via subscriptions
8. Frontend receives real-time status via useQuery
```

**Why Temporal over trigger.dev:**
- ✅ **Dynamic workflows**: Purpose-built for user-defined workflows at runtime
- ✅ **Workflow versioning**: Update engine without breaking running workflows
- ✅ **Superior observability**: Time-travel debugging, workflow history replay
- ✅ **Multi-tenancy**: Task queues per user, isolated execution
- ✅ **Long-running**: Workflows can run for days/weeks (trigger.dev has limits)
- ✅ **Deterministic**: Guarantees reliability and correctness
- ✅ **Battle-tested**: Used by Uber, Netflix, Stripe for mission-critical workflows

**Alternative: trigger.dev (Interpreter Pattern)**

If using trigger.dev, deploy ONE generic executor task:

```typescript
export const workflowExecutor = task({
  id: "workflow-executor",
  run: async ({ workflowId, userId }) => {
    // Load workflow from Convex
    const workflow = await convex.query("workflows:get", { workflowId });

    // Execute nodes in order
    for (const node of topologicalSort(workflow.nodes)) {
      const plugin = await getPlugin(node.pluginId);
      const inputs = gatherInputs(node, results);
      results[node.id] = await plugin.execute(inputs, node.config);
    }
  }
});
```

See [WORKFLOW_EXECUTION_ANALYSIS.md](./WORKFLOW_EXECUTION_ANALYSIS.md) for full comparison.

### 5. Multi-Tenancy

**Automatic via Convex Auth:**
- All queries filtered by `userId` from auth context
- Row-level security built-in
- No manual filtering needed

```typescript
// Automatic user isolation
export const list = query({
  handler: async (ctx) => {
    const userId = (await ctx.auth.getUserIdentity())?.subject;
    return await ctx.db.query("workflows")
      .withIndex("by_user", q => q.eq("userId", userId))
      .collect();
  },
});
```

### 6. Data Model

**Workflow Structure (DAG):**

A workflow is a **Directed Acyclic Graph (DAG)** consisting of:

- **Nodes** - Plugin instances with configuration
  - Each node references a plugin (e.g., "stock-price-v1.0.0")
  - Contains plugin-specific config (API keys, parameters, prompts)
  - Has unique ID for connections

- **Edges** - Data flow between nodes
  - Defines execution order (source → target)
  - Maps output from one node to input of next
  - Validates type compatibility (or inserts AI Processor)

- **Workflow Metadata**
  - Name, description, type (root vs sub-workflow)
  - Owner (userId for multi-tenancy)
  - Status (draft, active, paused, archived)
  - Source (original or from template ID)

**Example Workflow:**
```
Node 1: Cron Trigger (every 5 min)
   ↓ edge
Node 2: Stock Price Input (symbol: "AAPL")
   ↓ edge (output: {symbol, price, timestamp})
Node 3: AI Processor (check if price dropped 5%)
   ↓ edge (output: {dropped: boolean, ...})
Node 4: Logic - Condition (if dropped === true)
   ↓ edge
Node 5: Trading Output (buy $1000)
```

**Key Convex Tables:**
- `workflows` - User's workflow definitions (nodes + edges + metadata)
- `workflow_executions` - Execution history, status, logs
- `workflow_templates` - Shared workflows in marketplace
- `plugins` - Available plugins in marketplace
- `credentials` - Encrypted API keys per user
- `plugin_installs` - User's installed plugins

**No SQL, no migrations.** Schema defined in TypeScript, stored as JSON in Convex.

### 7. Security

**Built-in via Convex + trigger.dev:**
- Encrypted credentials (Convex encryption)
- Sandboxed plugin execution (trigger.dev tasks)
- Rate limiting (Convex automatic)
- Audit logging (Convex function logs)
- Row-level security (Convex auth context)

**Plugin Sandboxing:**
- Runs in isolated V8 contexts
- Resource limits (timeout, memory)
- Network allowlist
- No cross-user data access

### 8. Marketplace

**Plugin Marketplace:**

1. Developer builds plugin using SDK
2. Submit to marketplace (Convex mutation)
3. Code review + security scan
4. Publish (stored in Convex file storage)
5. Users install one-click

**Features:**
- Browse by category/rating
- Version management (semver)
- Revenue sharing (optional)
- Community reviews

**Workflow Marketplace:**

Users can share workflows as templates for others to use.

**Sharing Flow:**
1. User creates workflow
2. Publishes to marketplace (creates template)
3. Template includes: nodes, edges, plugin requirements, description
4. Other users browse and discover workflows

**Installation Flow:**
1. User finds workflow template in marketplace
2. Drafts workflow from template (copies structure)
3. System checks: Do they have all required plugins installed?
4. System checks: Have they configured all required credentials?
5. User can only **enable/activate** workflow when:
   - All required plugins are installed
   - All credentials are properly configured
6. Draft workflows can be edited but not executed

**Use Cases:**
- "Stock alert when price drops 10%" - reusable template
- "Daily news summary via email" - configure your own email
- "Social media sentiment tracker" - connect your own APIs

**Privacy:**
- Shared workflows contain structure only (nodes + edges)
- No user credentials or personal data included
- Users must configure their own API keys and credentials

## Workflow Creation

**Three Interfaces:**

1. **Chat** (primary) - "Alert me when TSLA drops 10%"
2. **Audio** - Speak your workflow (Whisper transcription)
3. **Visual** - React Flow editor for complex workflows

**AI translates natural language → DAG → trigger.dev job**

## Differentiation

vs **Zapier/n8n:** AI builds workflows, not drag-and-drop
vs **Langchain:** Production platform, not just a library
vs **Temporal:** Natural language interface, plugin marketplace

## Development

```bash
# Setup (first time)
npx convex dev          # Creates Convex project
bun install             # Install dependencies

# Development (daily)
npx convex dev          # Terminal 1 - Backend
bun run dev             # Terminal 2 - Frontend

# Deploy
vercel deploy           # Frontend
npx convex deploy       # Backend (automatic)
```

## Key Principles

1. **Serverless-First** - Zero infrastructure management
2. **Real-Time Native** - Convex subscriptions everywhere
3. **AI-First** - Natural language as primary interface
4. **Plugin-Driven** - Everything is a plugin
5. **Type-Safe** - TypeScript end-to-end
6. **Multi-Tenant** - Automatic user isolation
7. **Security-First** - Encrypted, sandboxed, validated

## What Makes Kianax Different

**Traditional workflow tools:** Drag boxes, connect arrows, configure fields
**Kianax:** "When X happens, do Y" → Done.

**Secret sauce:**
- AI Processor eliminates complex field mapping
- Plugin + workflow marketplace drives ecosystem
- Real-time everywhere (no polling, no manual WebSockets)
- Zero DevOps (fully managed stack)

---

For implementation details, see:
- **[ROADMAP.md](./ROADMAP.md)** - Development phases
- **[TODO.md](./TODO.md)** - Current tasks
- **[PLUGIN_DEVELOPMENT.md](./PLUGIN_DEVELOPMENT.md)** - Build plugins
