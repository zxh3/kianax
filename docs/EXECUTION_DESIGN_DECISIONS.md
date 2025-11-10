# Routine Execution: Design Decisions & Trade-offs

## Problem Recap

Your original concern was spot-on: **How do we handle dynamic execution flow when logic nodes (like if-else) determine the path at runtime?**

The previous topological sort approach would execute ALL nodes in levels, which doesn't work for conditional branching.

## Solution: BFS with Conditional Edge Traversal

### Core Idea

Instead of pre-computing execution order (topological sort), we use **breadth-first search (BFS)** to determine the path dynamically:

1. Start with entry nodes (no incoming edges)
2. Execute nodes whose dependencies are satisfied
3. After each node executes, check if it's a logic node
4. For logic nodes: **Filter outgoing edges** by branch condition
5. Only traverse edges matching the branch result
6. Dead branches never enter the execution queue

### Key Components

```typescript
// 1. Enhanced Connection with conditional edges
interface Connection {
  sourceNodeId: string;
  targetNodeId: string;
  condition?: {
    type: 'branch' | 'default';
    value?: string;  // "true", "false", etc.
  };
}

// 2. Dynamic next node determination
function determineNextNodes(nodeId, output, graph) {
  if (node.type === 'logic') {
    const branch = output.branch;  // "true" or "false"

    // Only follow edges matching the branch
    return edges
      .filter(e => e.sourceNodeId === nodeId)
      .filter(e => e.condition?.value === branch)
      .map(e => e.targetNodeId);
  }

  // Non-logic nodes: follow all edges
  return edges
    .filter(e => e.sourceNodeId === nodeId)
    .map(e => e.targetNodeId);
}

// 3. BFS execution loop
while (queue.length > 0) {
  const ready = findReadyNodes(queue, graph, state);
  await Promise.all(ready.map(executeNode));

  // Determine next nodes based on outputs (handles branching)
  for (const nodeId of ready) {
    const next = determineNextNodes(nodeId, state.outputs.get(nodeId), graph);
    queue.push(...next);
  }
}
```

## Benefits

### ✅ 1. Conditional Branching Works Correctly

```
If-Else (branch: "false")
  ├─ TRUE → Buy (never executes) ✗
  └─ FALSE → Wait (executes) ✓
```

Only the "false" branch is added to the queue. The "true" branch never executes.

### ✅ 2. Parallel Execution Still Supported

```
Entry
  ├─ Fetch Stock Price (parallel)
  └─ Fetch News (parallel)
       ↓
    Merge (waits for both)
```

Both input nodes are ready simultaneously → execute in parallel via `Promise.all()`.

### ✅ 3. Deterministic Replay for Temporal

The execution is deterministic because:
- Node order determined by dependencies (static)
- Branch selection based on activity output (replayed from history)
- Queue processing order is consistent

When Temporal replays the workflow:
1. Activity results come from history (deterministic)
2. Branch decisions replay identically (same activity outputs)
3. Execution path remains consistent

### ✅ 4. Complex Patterns Supported

- **Nested branching**: If-else inside if-else
- **Diamond merges**: Branches rejoin at a common node
- **Multiple conditions**: Switch-like behavior (future)
- **Parallel branches**: Independent paths execute simultaneously

## Trade-offs

### ⚠️ 1. More Complex than Topological Sort

**Old approach** (simpler):
```typescript
const levels = topologicalSort(nodes, connections);
for (const level of levels) {
  await Promise.all(level.map(executeNode));
}
```

**New approach** (more powerful but complex):
```typescript
while (queue.length > 0) {
  const ready = findReadyNodes(queue, graph, state);
  await Promise.all(ready.map(executeNode));

  for (const nodeId of ready) {
    const next = determineNextNodes(nodeId, output, graph);
    queue.push(...next.filter(notExecuted));
  }
}
```

**Justification**: The added complexity is necessary for conditional logic. Without it, you can't build dynamic workflows.

### ⚠️ 2. Data Passing is More Explicit

We use React Flow's "handles" concept for precise data routing:

```typescript
{
  sourceNodeId: "stock-price",
  targetNodeId: "ai-processor",
  sourceHandle: "price",      // Get "price" field from stock output
  targetHandle: "data"         // Map to "data" field in AI input
}
```

**Justification**: This gives users fine-grained control over data flow and makes the UI clearer (visual handles on nodes).

### ⚠️ 3. Graph Validation Required

We must validate:
- No cycles (DAG only)
- No orphan nodes (disconnected)
- Logic nodes have conditional edges
- All node references are valid

**Justification**: Prevents runtime errors and gives users clear feedback when designing routines.

## What About Loops?

Currently, we enforce **DAG (Directed Acyclic Graph)** - no cycles allowed. This is intentional:

1. **Simpler reasoning**: Users can trace execution linearly
2. **Guaranteed termination**: No infinite loops
3. **Easier debugging**: Clear start → end flow

**Future**: We could support loops with:
- Max iteration limit (e.g., "repeat 10 times")
- Break conditions (loop until condition met)
- Temporal's continue-as-new for long-running loops

## Implementation Status

### ✅ Completed
- [x] Enhanced Connection schema with conditions
- [x] Graph executor utilities (BFS, validation, data flow)
- [x] Dynamic workflow implementation (routine-executor-v2.ts)
- [x] Comprehensive documentation
- [x] Example patterns (linear, branch, parallel, nested, diamond)

### 🚧 Next Steps
- [ ] Replace old executor with new one
- [ ] UI support for conditional edges (React Flow)
- [ ] Graph validation in routine editor
- [ ] Execution visualization (highlight active path)
- [ ] Integration tests for all patterns
- [ ] Error handling improvements (partial failures, retries)

## Migration Path

**Option 1: Hard Cut-over**
- Switch all routines to V2 executor
- Simpler but riskier

**Option 2: Gradual Migration**
- Keep V1 for existing routines
- Use V2 for new routines with logic nodes
- Migrate old routines over time

**Recommendation**: Start with Option 2 for safety. V1 is simpler and works fine for linear/parallel flows. Only use V2 when users need conditional logic.

## Testing Strategy

### Critical Test Cases

1. **Simple if-else**: Verify only one branch executes
2. **Nested conditions**: Multiple levels of branching
3. **Parallel execution**: Independent nodes run simultaneously
4. **Diamond merge**: Branches rejoin correctly
5. **Error propagation**: Failures stop execution cleanly
6. **Deterministic replay**: Same input → same path

### Example Test

```typescript
it('executes only the true branch', async () => {
  const routine = createIfElseRoutine();

  // Mock if-else to return "true"
  mockPluginOutput('if-else', { branch: 'true' });

  const result = await executeRoutine(routine);

  expect(result.executionPath).toContain('true-branch-node');
  expect(result.executionPath).not.toContain('false-branch-node');
});
```

## UI Considerations

### Conditional Edges in React Flow

React Flow already supports this! When user connects nodes:

1. **Logic nodes** expose multiple output handles: "true", "false"
2. User drags from specific handle to target node
3. Connection is labeled with condition automatically
4. Edge color/style can indicate condition type

### Execution Visualization

Show users which path was taken:
- ✅ Green: Executed nodes
- ⏭️ Gray: Skipped nodes (dead branch)
- ⏳ Yellow: Currently executing
- ❌ Red: Failed nodes

## Conclusion

The BFS-based executor with conditional edge traversal solves the dynamic routing problem while:
- ✅ Supporting all complex workflow patterns
- ✅ Maintaining deterministic replay for Temporal
- ✅ Enabling parallel execution where possible
- ✅ Providing clear execution traces for debugging

The added complexity is justified because it unlocks the core value proposition: **AI-powered routines with intelligent decision-making**.

Without conditional logic, Kianax would just be another static workflow engine. With it, users can build truly intelligent automations that adapt based on real-time data.

---

## Quick Reference

**When to use V1 (Topological Sort)**:
- Linear flows (A → B → C)
- Pure parallel flows (no branching)
- Simple data pipelines

**When to use V2 (BFS)**:
- Any routine with logic nodes (if-else, switch)
- Dynamic routing based on data
- Complex nested conditions
- AI-driven decision trees

**Rule of thumb**: If routine has a logic node, use V2. Otherwise, V1 is simpler and sufficient.
