# Routine Execution Architecture

## Problem Statement

Routines are user-defined workflows composed of plugins connected in a graph. The execution must support:

1. **Conditional Branching**: If-else nodes change execution path at runtime
2. **Parallel Execution**: Independent nodes execute concurrently
3. **Data Flow**: Output from one node becomes input to the next
4. **Dynamic Routing**: Execution path determined at runtime based on plugin outputs
5. **Deterministic Replay**: Temporal workflow replay must be consistent

## Architecture Overview

```
User-Defined Routine (DAG)
         ↓
  Graph Executor (Workflow)
         ↓
  Plugin Activities (Workers)
```

### Key Components

1. **Routine Graph**: Nodes (plugins) + Connections (edges)
2. **Graph Executor**: Interprets graph and orchestrates execution
3. **Conditional Edges**: Connections labeled with branch conditions
4. **Execution State**: Tracks completed nodes and their outputs
5. **Data Mapper**: Routes data from outputs to inputs

## Data Model

### Enhanced Connection Schema

```typescript
export interface Connection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;

  // React Flow handles for precise data routing
  sourceHandle: string;  // Output port: "result", "true", "false", "data"
  targetHandle: string;  // Input port: "data", "condition", "value"

  // Conditional execution (for logic nodes)
  condition?: {
    type: 'branch' | 'default';
    value?: string;  // "true", "false", or any branch value
  };
}
```

### Example: If-Else Routine

```typescript
const routine = {
  nodes: [
    { id: '1', pluginId: 'stock-price', type: 'input' },
    { id: '2', pluginId: 'if-else', type: 'logic' },
    { id: '3', pluginId: 'http-buy', type: 'output' },   // True branch
    { id: '4', pluginId: 'http-wait', type: 'output' },  // False branch
  ],
  connections: [
    // Stock price → If-Else (check if dropped 5%)
    {
      id: 'c1',
      sourceNodeId: '1',
      targetNodeId: '2',
      sourceHandle: 'price',
      targetHandle: 'value'
    },

    // If-Else TRUE → Buy
    {
      id: 'c2',
      sourceNodeId: '2',
      targetNodeId: '3',
      sourceHandle: 'result',
      targetHandle: 'data',
      condition: { type: 'branch', value: 'true' }  // Only if true
    },

    // If-Else FALSE → Wait
    {
      id: 'c3',
      sourceNodeId: '2',
      targetNodeId: '4',
      sourceHandle: 'result',
      targetHandle: 'data',
      condition: { type: 'branch', value: 'false' }  // Only if false
    }
  ]
};
```

## Execution Algorithm

### High-Level Flow

```typescript
function executeRoutine(routine: RoutineInput) {
  // 1. Build execution graph
  const graph = buildExecutionGraph(routine);

  // 2. Initialize state
  const state = {
    nodeOutputs: new Map<string, any>(),
    executed: new Set<string>(),
    executionPath: [],  // For observability
  };

  // 3. Find entry nodes (no incoming edges)
  const startNodes = findEntryNodes(graph);

  // 4. Execute graph with breadth-first traversal
  await executeBFS(graph, startNodes, state);

  // 5. Return execution results
  return {
    outputs: state.nodeOutputs,
    path: state.executionPath,
  };
}
```

### Detailed Algorithm

```typescript
async function executeBFS(
  graph: ExecutionGraph,
  startNodes: string[],
  state: ExecutionState
): Promise<void> {
  const queue: string[] = [...startNodes];
  const pending = new Set(queue);

  while (queue.length > 0 || pending.size > 0) {
    // Find all nodes whose dependencies are satisfied
    const ready = findReadyNodes(queue, graph, state);

    if (ready.length === 0) {
      // No nodes ready - either waiting for activities or deadlock
      if (pending.size === 0) break;

      // Wait for at least one pending activity
      await Promise.race([...pending]);
      continue;
    }

    // Execute ready nodes in parallel
    const executions = ready.map(nodeId =>
      executeNodeWithTracking(nodeId, graph, state)
    );

    await Promise.all(executions);

    // Determine next nodes based on outputs
    for (const nodeId of ready) {
      const nextNodes = determineNextNodes(
        nodeId,
        state.nodeOutputs.get(nodeId),
        graph
      );

      for (const next of nextNodes) {
        if (!state.executed.has(next) && !pending.has(next)) {
          queue.push(next);
          pending.add(next);
        }
      }
    }
  }
}
```

### Conditional Edge Traversal

```typescript
function determineNextNodes(
  nodeId: string,
  nodeOutput: any,
  graph: ExecutionGraph
): string[] {
  const node = graph.nodes.get(nodeId);
  const outgoingEdges = graph.edges.filter(e => e.sourceNodeId === nodeId);

  // For logic nodes, filter edges by branch condition
  if (node.type === 'logic') {
    const branch = nodeOutput.branch;  // "true" | "false"

    return outgoingEdges
      .filter(edge => {
        if (!edge.condition) return true;  // Default edge, always follow
        return edge.condition.value === branch;
      })
      .map(edge => edge.targetNodeId);
  }

  // For non-logic nodes, follow all outgoing edges
  return outgoingEdges.map(edge => edge.targetNodeId);
}
```

### Data Flow and Input Gathering

```typescript
function gatherNodeInputs(
  nodeId: string,
  graph: ExecutionGraph,
  state: ExecutionState
): any {
  const incomingEdges = graph.edges.filter(e => e.targetNodeId === nodeId);

  // Build input object by mapping outputs → inputs via handles
  const inputs: Record<string, any> = {};

  for (const edge of incomingEdges) {
    const sourceOutput = state.nodeOutputs.get(edge.sourceNodeId);

    if (!sourceOutput) {
      throw new Error(`Missing output from node ${edge.sourceNodeId}`);
    }

    // Extract specific field from source output using sourceHandle
    const value = edge.sourceHandle
      ? sourceOutput[edge.sourceHandle]
      : sourceOutput;

    // Map to target input field using targetHandle
    if (edge.targetHandle) {
      inputs[edge.targetHandle] = value;
    } else {
      // No target handle - merge entire object
      Object.assign(inputs, typeof value === 'object' ? value : { data: value });
    }
  }

  return inputs;
}
```

### Dependency Checking

```typescript
function findReadyNodes(
  candidates: string[],
  graph: ExecutionGraph,
  state: ExecutionState
): string[] {
  return candidates.filter(nodeId => {
    // Already executed?
    if (state.executed.has(nodeId)) return false;

    // All dependencies satisfied?
    const dependencies = graph.edges
      .filter(e => e.targetNodeId === nodeId)
      .map(e => e.sourceNodeId);

    return dependencies.every(depId => state.executed.has(depId));
  });
}
```

## Parallel Execution

The algorithm naturally supports parallel execution:

```typescript
// Example: Parallel data fetching
const routine = {
  nodes: [
    { id: '1', pluginId: 'stock-price', type: 'input' },      // Start
    { id: '2', pluginId: 'news-fetch', type: 'input' },       // Start
    { id: '3', pluginId: 'merge-data', type: 'processor' },   // Waits for 1 & 2
    { id: '4', pluginId: 'ai-analyze', type: 'processor' },   // Waits for 3
  ],
  connections: [
    { sourceNodeId: '1', targetNodeId: '3', sourceHandle: 'price', targetHandle: 'stockData' },
    { sourceNodeId: '2', targetNodeId: '3', sourceHandle: 'articles', targetHandle: 'newsData' },
    { sourceNodeId: '3', targetNodeId: '4', sourceHandle: 'merged', targetHandle: 'data' },
  ]
};

// Execution:
// Step 1: Execute nodes 1 and 2 in parallel (no dependencies)
// Step 2: Execute node 3 (after both 1 and 2 complete)
// Step 3: Execute node 4 (after 3 completes)
```

## Temporal Workflow Integration

```typescript
// apps/workers/src/workflows/routine-executor.ts

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

const { executePlugin, storeNodeResult, updateRoutineStatus } = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: { maximumAttempts: 3 },
});

export async function routineExecutor(input: RoutineInput): Promise<any> {
  const graph = buildExecutionGraph(input);
  const state = new ExecutionState();

  await updateRoutineStatus({
    routineId: input.routineId,
    status: 'running',
    startedAt: Date.now(),
  });

  try {
    // Execute graph with BFS traversal
    await executeBFS(graph, findEntryNodes(graph), state, input);

    await updateRoutineStatus({
      routineId: input.routineId,
      status: 'completed',
      completedAt: Date.now(),
    });

    return { success: true, outputs: state.nodeOutputs };
  } catch (error) {
    await updateRoutineStatus({
      routineId: input.routineId,
      status: 'failed',
      completedAt: Date.now(),
      error: {
        message: error.message,
        stack: error.stack,
      },
    });

    throw error;
  }
}

async function executeBFS(
  graph: ExecutionGraph,
  startNodes: string[],
  state: ExecutionState,
  routineInput: RoutineInput
): Promise<void> {
  const queue = [...startNodes];

  while (queue.length > 0) {
    const ready = findReadyNodes(queue, graph, state);

    if (ready.length === 0) break;

    // Execute ready nodes in parallel (Temporal handles this correctly)
    await Promise.all(
      ready.map(nodeId => executeNode(nodeId, graph, state, routineInput))
    );

    // Remove executed from queue
    queue.splice(0, queue.length, ...queue.filter(id => !state.executed.has(id)));

    // Add next nodes
    for (const nodeId of ready) {
      const nextNodes = determineNextNodes(
        nodeId,
        state.nodeOutputs.get(nodeId),
        graph
      );

      queue.push(...nextNodes.filter(id => !state.executed.has(id)));
    }
  }
}

async function executeNode(
  nodeId: string,
  graph: ExecutionGraph,
  state: ExecutionState,
  routineInput: RoutineInput
): Promise<void> {
  const node = graph.nodes.get(nodeId);
  const inputs = gatherNodeInputs(nodeId, graph, state);

  try {
    // Execute plugin as Temporal Activity
    const output = await executePlugin({
      pluginId: node.pluginId,
      config: node.config,
      inputs,
      context: {
        userId: routineInput.userId,
        routineId: routineInput.routineId,
        executionId: workflow.info().workflowId,
        nodeId,
        triggerData: routineInput.triggerData,
      },
    });

    // Store output
    state.nodeOutputs.set(nodeId, output);
    state.executed.add(nodeId);
    state.executionPath.push(nodeId);

    // Persist to Convex for observability
    await storeNodeResult({
      routineId: routineInput.routineId,
      nodeId,
      status: 'completed',
      output,
      completedAt: Date.now(),
    });
  } catch (error) {
    await storeNodeResult({
      routineId: routineInput.routineId,
      nodeId,
      status: 'failed',
      error: {
        message: error.message,
        stack: error.stack,
      },
      completedAt: Date.now(),
    });

    throw error;
  }
}
```

## Determinism and Replay

**Critical**: Temporal workflows must be deterministic for replay. Our executor is deterministic because:

1. ✅ **Node execution order**: Determined by DAG dependencies (deterministic)
2. ✅ **Branch selection**: Based on activity output (deterministic - replayed from history)
3. ✅ **Parallel execution**: Promise.all() is deterministic in Temporal
4. ✅ **Plugin execution**: Activities (non-deterministic work) isolated from workflow
5. ✅ **Graph structure**: Immutable input (doesn't change during execution)

**Replay behavior**:
- Activity results are replayed from history
- Branch decisions replay identically (same activity outputs)
- Execution path remains consistent

## Edge Cases

### 1. Multiple Paths Merge

```
     If-Else
      /    \
   True    False
      \    /
      Merge
```

**Solution**: Merge node waits for ALL incoming edges to complete before executing. This is handled naturally by dependency checking.

### 2. Dead Branches

```
If-Else (false)
   |
  True → Buy  (never executed)
```

**Solution**: Only traverse edges matching the branch condition. Node "Buy" never enters the queue.

### 3. Missing Data

```
Node A → Node B
(A fails before producing output)
```

**Solution**: Error propagates, workflow fails with clear error message.

### 4. Circular Dependencies (Invalid)

```
A → B → C → A
```

**Solution**: Validate DAG is acyclic when routine is saved. Runtime validation as safety check.

## Observability

### Execution Trace

Store execution trace for debugging:

```typescript
interface ExecutionTrace {
  routineId: string;
  executionId: string;
  path: NodeExecution[];
  duration: number;
}

interface NodeExecution {
  nodeId: string;
  pluginId: string;
  startedAt: number;
  completedAt: number;
  inputs: any;
  outputs: any;
  status: 'completed' | 'failed';
  branchTaken?: string;  // For logic nodes
}
```

### Visualization

In the UI, highlight:
- ✅ Executed nodes (green)
- ❌ Failed nodes (red)
- ⏭️ Skipped nodes (gray, from dead branches)
- ⏳ Currently executing (yellow)
- ⏸️ Pending nodes (white)

## Implementation Checklist

- [ ] Update Connection schema with conditional edges
- [ ] Implement graph builder and validator
- [ ] Build BFS executor with conditional traversal
- [ ] Implement data gathering and mapping
- [ ] Add parallel execution support
- [ ] Create Temporal workflow wrapper
- [ ] Add execution tracing
- [ ] Build UI visualization
- [ ] Write comprehensive tests
- [ ] Document examples for common patterns

## Testing Strategy

### Unit Tests
- Graph validation (detect cycles, orphans)
- Dependency resolution
- Conditional edge filtering
- Data mapping

### Integration Tests
- Simple linear flow
- If-else branching
- Parallel execution
- Complex nested conditions
- Error handling and rollback

### Example Test Cases

```typescript
describe('Routine Executor', () => {
  it('executes linear flow', async () => {
    const routine = {
      nodes: [
        { id: '1', pluginId: 'input' },
        { id: '2', pluginId: 'processor' },
        { id: '3', pluginId: 'output' },
      ],
      connections: [
        { sourceNodeId: '1', targetNodeId: '2' },
        { sourceNodeId: '2', targetNodeId: '3' },
      ],
    };

    const result = await executeRoutine(routine);
    expect(result.executionPath).toEqual(['1', '2', '3']);
  });

  it('executes conditional branch', async () => {
    const routine = createIfElseRoutine();

    // Mock if-else to return true
    mockPlugin('if-else', { branch: 'true' });

    const result = await executeRoutine(routine);

    // Should only execute: input → if-else → true-branch
    expect(result.executionPath).toEqual(['input', 'if-else', 'true-branch']);
    expect(result.executionPath).not.toContain('false-branch');
  });

  it('executes parallel nodes', async () => {
    const routine = createParallelRoutine();

    const startTime = Date.now();
    await executeRoutine(routine);
    const duration = Date.now() - startTime;

    // Both 1-second nodes should complete in ~1 second, not 2
    expect(duration).toBeLessThan(1500);
  });
});
```

---

## Summary

The dynamic DAG executor provides:
- ✅ **Conditional branching** via labeled edges
- ✅ **Parallel execution** via Promise.all()
- ✅ **Data flow** via handle-based mapping
- ✅ **Deterministic replay** for Temporal
- ✅ **Observability** via execution traces
- ✅ **Extensibility** for future features (loops, sub-routines)

This architecture supports complex user-defined workflows while maintaining determinism and observability.
