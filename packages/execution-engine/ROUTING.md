# Port-Based Routing Design

## Overview

The Kianax execution engine uses **port-based routing** for all conditional logic and branching. This design follows n8n's approach where routing decisions are made by nodes themselves, not by edges.

## Key Principles

### 1. Edges are Simple Connections

Edges are purely structural - they connect a source port to a target port with no conditional logic:

```typescript
interface Edge {
  sourceNodeId: string;
  sourcePort: string;    // e.g., "true", "false", "success", "error"
  targetNodeId: string;
  targetPort: string;
  type: PortType;
  // NO conditionValue or other routing logic!
}
```

### 2. Nodes Control Routing

Nodes decide which output ports receive data based on their logic:

```typescript
// Example: IF node implementation
async execute(inputs, context) {
  const condition = evaluateCondition(inputs);

  if (condition) {
    return {
      outputs: [
        { portName: "true", items: inputs },  // Data flows here
        { portName: "false", items: [] },     // No data
      ]
    };
  } else {
    return {
      outputs: [
        { portName: "true", items: [] },      // No data
        { portName: "false", items: inputs }, // Data flows here
      ]
    };
  }
}
```

### 3. Execution Engine Follows Data

The iteration strategy simply executes downstream nodes **only if their input ports have data**:

```typescript
// From iteration-strategy.ts
const portOutput = result.outputs.find(p => p.portName === edge.sourcePort);

if (!portOutput || portOutput.items.length === 0) {
  continue; // Skip this edge - no data to flow
}

// Data exists, add target node to execution queue
nextNodes.add(edge.targetNodeId);
```

## Examples

### Conditional Branching

```
┌──────────┐
│  Start   │
└────┬─────┘
     │
     ▼
┌──────────┐
│ IF Node  │ ← Evaluates condition
├──────────┤
│ true  ┬──┼──→ ┌────────────┐
│ false ┘  │    │ True Path  │
└──────────┘    └────────────┘
     │
     ▼
┌────────────┐
│ False Path │
└────────────┘
```

The IF node outputs data to **either** "true" **or** "false" port, never both.

### Error Handling

```
┌──────────┐
│ HTTP Req │
├──────────┤
│ success ─┼──→ ┌────────────┐
│ error  ──┼──→ │ Log Error  │
└──────────┘    └────────────┘
     │
     ▼
┌────────────┐
│ Process    │
└────────────┘
```

The HTTP node outputs to "success" port on success, "error" port on failure.

### Switch/Router Nodes

```
┌──────────┐
│  Router  │
├──────────┤
│ route1 ──┼──→ ┌──────┐
│ route2 ──┼──→ │ ...  │
│ route3 ──┼──→ └──────┘
│ default ─┘
└──────────┘
```

A router node can output to any number of ports based on complex logic.

## Benefits

### 1. Separation of Concerns
- **Nodes**: Business logic, conditions, routing decisions
- **Edges**: Simple connections, no logic
- **Engine**: Data flow orchestration, no conditional logic

### 2. Flexibility
- Nodes can implement arbitrarily complex routing
- No need to extend edge types for new routing patterns
- Easy to test node logic independently

### 3. Visual Clarity
- Graph structure matches execution flow
- Unused branches are visually clear (empty ports)
- No hidden conditions on edges

### 4. Extensibility
- New conditional patterns just need new node types
- No changes to execution engine required
- Plugin system stays simple

## Anti-Patterns to Avoid

### ❌ DON'T: Add condition logic to edges
```typescript
// BAD - brings logic into edges
interface Edge {
  conditionValue?: string;
  conditionExpression?: string;
  whenFieldEquals?: { field: string, value: unknown };
}
```

### ❌ DON'T: Use magic field conventions
```typescript
// BAD - assumes specific output structure
if (item.json?.branch === conditionValue) { ... }
```

### ✅ DO: Let nodes control their outputs
```typescript
// GOOD - node decides what data goes where
return {
  outputs: [
    { portName: "matched", items: matchedItems },
    { portName: "unmatched", items: unmatchedItems },
  ]
};
```

### ✅ DO: Follow the data
```typescript
// GOOD - engine just checks if port has data
if (portOutput.items.length === 0) {
  continue; // No execution needed
}
```

## Implementation Notes

- Currently, only `PortType.Main` exists in the execution engine
- The execution engine doesn't use port types for routing decisions - it only checks if ports have data
- Future port types (Config, Error, etc.) can be added for:
  - UI rendering (different colors/styles)
  - Connection validation (Config → Config only, etc.)
  - Developer understanding of data flow
- Port routing is done via **port names** (e.g., "true", "false", "success", "error"), not port types
