# Flow-Based Plugin System Design

## Overview

This document proposes a simplification of the Kianax plugin/routine system from **port-based connections** to **flow-based connections** with expression-based data access.

## Current System (Port-Based)

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Node A    │      │   Node B    │      │   Node C    │
│             │      │             │      │             │
│ [out:data]──┼──────┼──▶[in:data] │      │             │
│             │      │ [out:result]┼──────┼──▶[in:input]│
└─────────────┘      └─────────────┘      └─────────────┘
```

**Characteristics:**
- Explicit input/output port definitions on each plugin
- Edges connect specific `sourcePort` → `targetPort`
- Data flows through named port connections
- Plugins define `PluginSchemas.inputs` and `PluginSchemas.outputs`

**Pain Points:**
1. Complex plugin authoring - must define input/output port schemas
2. Rigid data flow - can only access data through connected ports
3. UI complexity - must visualize and manage port connections
4. Refactoring friction - changing ports requires updating all connections

## Proposed System (Flow-Based)

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Node A    │      │   Node B    │      │   Node C    │
│             │      │             │      │             │
│     ●───────┼──────┼──────●      │      │             │
│             │      │      ●──────┼──────┼──────●      │
└─────────────┘      └─────────────┘      └─────────────┘

Node B config:
  inputData: "{{ nodes.nodeA.output }}"

Node C config:
  payload: "{{ nodes.nodeB.output.result }}"
```

**Key Changes:**
1. **Single connection point per node** - no explicit input/output ports
2. **Connections define data availability scope** - "Node B can access Node A's output"
3. **Expression-based data binding** - config fields use `{{ }}` expressions to pull data
4. **Output schema only** - plugins declare what they output, not what they accept

## Design Principles

### 1. Connections = Execution Order + Data Scope

A connection from Node A → Node B means:
- Node A executes before Node B
- Node B can reference `{{ nodes.nodeA.output }}` in its config

```typescript
interface Connection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  // Optional: for control flow routing (see below)
  sourceHandle?: string;  // e.g., "true", "false", "success", "error"
}
```

### 2. Plugins Define Output Schema Only

```typescript
const httpRequestPlugin = createPlugin("http-request")
  .withMetadata({ name: "HTTP Request", ... })
  .withConfig(z.object({
    url: z.string(),       // Supports expressions: "{{ vars.apiUrl }}"
    method: z.enum(["GET", "POST", ...]),
    headers: z.record(z.string()).optional(),
    body: z.any().optional(),
  }))
  .withOutputSchema(z.object({
    status: z.number(),
    data: z.any(),
    headers: z.record(z.string()),
  }))
  .execute(async ({ config, context }) => {
    const response = await fetch(config.url, { ... });
    return {
      status: response.status,
      data: await response.json(),
      headers: Object.fromEntries(response.headers),
    };
  })
  .build();
```

### 3. Expression System Provides Data Access

The existing expression system becomes the **primary data access mechanism**:

```typescript
// Available in any node's config:
{{ nodes.<nodeId>.output }}           // Full output of a node
{{ nodes.<nodeId>.output.data }}      // Nested access
{{ nodes.<nodeId>.output.items[0] }}  // Array access
{{ vars.<name> }}                     // Routine variables
{{ trigger.payload }}                 // Trigger data
{{ execution.id }}                    // Execution context
```

### 4. Scope Resolution Rules

A node can only reference:
1. **Upstream nodes** - nodes with a path to the current node
2. **Routine variables** - globally available
3. **Trigger data** - when routine has a trigger
4. **Execution context** - always available

```typescript
function getAvailableScope(nodeId: string, graph: Graph): ExpressionScope {
  const upstreamNodes = findUpstreamNodes(nodeId, graph);
  return {
    nodes: upstreamNodes.map(n => ({
      id: n.id,
      label: n.label,
      outputSchema: getPluginOutputSchema(n.pluginId),
    })),
    vars: graph.variables,
    trigger: graph.triggerSchema,
    execution: executionContextSchema,
  };
}
```

## Control Flow: Branching Nodes

For conditional routing (if-else, switch, try-catch), we use **source handles**:

### If-Else Node

```typescript
const ifElsePlugin = createPlugin("if-else")
  .withMetadata({ name: "If/Else", category: "Logic" })
  .withConfig(z.object({
    value: z.any(),  // Expression: "{{ nodes.upstream.output.status }}"
    conditions: z.array(conditionSchema),
  }))
  // Multiple output handles for routing
  .withOutputHandles(["true", "false"])
  .withOutputSchema(z.object({
    result: z.boolean(),
    value: z.any(),  // Pass-through the evaluated value
  }))
  .execute(async ({ config }) => {
    const result = evaluateConditions(config.value, config.conditions);
    return {
      // Return which handle should be activated
      __handle: result ? "true" : "false",
      output: { result, value: config.value },
    };
  })
  .build();
```

### Connection with Handles

```typescript
// Connections from if-else node specify source handle
const connections: Connection[] = [
  {
    id: "1",
    sourceNodeId: "ifelse_1",
    sourceHandle: "true",    // Only triggers if condition is true
    targetNodeId: "action_a"
  },
  {
    id: "2",
    sourceNodeId: "ifelse_1",
    sourceHandle: "false",   // Only triggers if condition is false
    targetNodeId: "action_b"
  },
];
```

### Visual Representation

```
                    ┌────────────────┐
                    │   If/Else      │
──────●────────────▶│  condition...  │
                    │                │
                    │  [true] [false]│
                    └───┬────────┬───┘
                        │        │
                        ▼        ▼
              ┌─────────────┐  ┌─────────────┐
              │  Action A   │  │  Action B   │
              │  (true path)│  │ (false path)│
              └─────────────┘  └─────────────┘
```

### Other Control Flow Nodes

| Node Type | Output Handles | Description |
|-----------|----------------|-------------|
| If/Else | `true`, `false` | Binary branching |
| Switch | `case1`, `case2`, ..., `default` | Multi-way branching |
| Try/Catch | `success`, `error` | Error handling |
| Loop | `iteration`, `complete` | Iteration control |
| Router | Dynamic based on config | Route by value |

## Execution Engine Changes

### 1. Graph Structure

```typescript
interface ExecutionGraph {
  nodes: Node[];
  connections: Connection[];
  variables: Variable[];
  trigger?: TriggerConfig;
}

interface Node {
  id: string;
  pluginId: string;
  label: string;
  config: Record<string, unknown>;  // May contain expressions
  position?: { x: number; y: number };
  credentialMappings?: Record<string, string>;
}
```

### 2. Execution Flow

```typescript
async function executeGraph(graph: ExecutionGraph, triggerData?: unknown) {
  const state = new ExecutionState();
  const resolver = new ExpressionResolver();

  // Build dependency graph
  const depGraph = buildDependencyGraph(graph.connections);

  // Execute in topological order
  for (const nodeId of topologicalSort(depGraph)) {
    const node = graph.nodes.find(n => n.id === nodeId);
    const plugin = getPlugin(node.pluginId);

    // Check if this node should execute (handle-based routing)
    if (!shouldExecute(node, state, graph.connections)) {
      continue;  // Skip - not on active path
    }

    // Build expression context from upstream outputs
    const context = buildExpressionContext(node, state, graph);

    // Resolve expressions in config
    const resolvedConfig = resolver.resolve(node.config, context);

    // Execute plugin
    const result = await plugin.execute({
      config: resolvedConfig,
      context: { userId, routineId, credentials, ... },
    });

    // Store result
    state.setNodeOutput(nodeId, result);

    // Handle routing (for control flow nodes)
    if (result.__handle) {
      state.setActiveHandle(nodeId, result.__handle);
    }
  }

  return state.getFinalOutputs();
}
```

### 3. Handle-Based Routing

```typescript
function shouldExecute(
  node: Node,
  state: ExecutionState,
  connections: Connection[]
): boolean {
  // Find all incoming connections
  const incoming = connections.filter(c => c.targetNodeId === node.id);

  if (incoming.length === 0) {
    return true;  // Entry node - always execute
  }

  // Check if ANY incoming connection is active
  for (const conn of incoming) {
    const sourceOutput = state.getNodeOutput(conn.sourceNodeId);
    if (!sourceOutput) continue;  // Source hasn't executed

    // If connection has a handle, check if it's active
    if (conn.sourceHandle) {
      const activeHandle = state.getActiveHandle(conn.sourceNodeId);
      if (activeHandle === conn.sourceHandle) {
        return true;  // This path is active
      }
    } else {
      return true;  // No handle = always active when source executed
    }
  }

  return false;  // No active incoming path
}
```

## Plugin SDK Changes

### Before (Port-Based)

```typescript
const plugin = createPlugin("my-plugin")
  .withInput("data", {
    label: "Input Data",
    schema: z.object({ ... })
  })
  .withOutput("result", {
    label: "Result",
    schema: z.object({ ... })
  })
  .execute(async ({ inputs, config }) => {
    const data = inputs.data.items[0].data;
    return { result: processData(data) };
  })
  .build();
```

### After (Flow-Based)

```typescript
const plugin = createPlugin("my-plugin")
  .withConfig(z.object({
    inputData: z.any(),  // Expression: "{{ nodes.upstream.output }}"
    option: z.string(),
  }))
  .withOutputSchema(z.object({
    result: z.any(),
    metadata: z.object({ ... }),
  }))
  .execute(async ({ config }) => {
    // config.inputData is already resolved from expression
    return {
      result: processData(config.inputData),
      metadata: { ... },
    };
  })
  .build();
```

## Migration Strategy

### Phase 1: Dual Support
- Keep existing port-based infrastructure
- Add flow-based connection support alongside
- Plugins can opt into new system

### Phase 2: Expression-First Configs
- Update plugin configs to use expression-enabled fields
- Expression resolver handles both old and new patterns

### Phase 3: Deprecate Ports
- Migrate existing plugins to flow-based
- Remove port definitions from plugin SDK
- Convert existing routines (migration script)

### Phase 4: Cleanup
- Remove port-based code paths
- Simplify execution engine
- Update documentation

## Benefits

| Aspect | Port-Based | Flow-Based |
|--------|------------|------------|
| Plugin authoring | Define inputs + outputs | Define config + output only |
| Data access | Only via connected ports | Any upstream node via expressions |
| Connection UI | Complex port matching | Simple node-to-node lines |
| Flexibility | Rigid, schema-locked | Dynamic, expression-based |
| Learning curve | Higher (port concepts) | Lower (just expressions) |
| Refactoring | Update all connections | Update expressions only |

## Risks & Mitigations

### Risk: Lose Type Safety
**Mitigation:** Output schemas still provide type info for expression autocomplete. Validation at design-time warns about type mismatches.

### Risk: Complex Control Flow
**Mitigation:** Handles preserve branching capability. If-else, switch, try-catch all work via handle routing.

### Risk: Migration Effort
**Mitigation:** Phased rollout with backwards compatibility. Automated migration for simple cases.

### Risk: Performance
**Mitigation:** Expression resolution is already fast. No additional overhead vs port data gathering.

## Open Questions

1. **Multiple outputs per node?** - Some nodes might want multiple distinct outputs (e.g., HTTP request with `data` + `rawResponse`). Solution: Output schema is an object with named fields, access via `{{ nodes.http.output.data }}` vs `{{ nodes.http.output.rawResponse }}`.

2. **Merge nodes?** - When multiple branches converge, how to access data from different paths? Solution: Node config can reference multiple upstream nodes; only the one that executed has data.

3. **Loop iteration data?** - How to access current iteration value? Solution: Special `{{ $current }}` or `{{ $iteration }}` context within loop body.

## Conclusion

The flow-based system simplifies plugin development and routine authoring while maintaining full control flow capabilities through handle-based routing. The existing expression system already provides the foundation for this change.
