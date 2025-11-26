# @kianax/execution-engine

Temporal-agnostic execution engine for Kianax routines.

## Overview

This package provides the core execution logic for running Kianax routines. It's designed to be independent of Temporal, making it:

- **Testable**: Run routines in tests without Temporal infrastructure
- **Reusable**: Use in different contexts (serverless, edge workers, etc.)
- **Maintainable**: Clear separation between orchestration and execution logic

## Architecture

```
execution-engine/
├── engine/          # Core execution logic
│   ├── executor.ts         # Main RoutineExecutor class
│   ├── graph-executor.ts   # BFS graph traversal
│   ├── execution-state.ts  # State management
│   └── input-gatherer.ts   # Port-based input gathering
├── validation/      # Validation logic
│   ├── graph-validator.ts       # Graph structure validation
│   └── connection-validator.ts  # Connection compatibility
├── context/         # Plugin execution context
│   └── execution-context.ts
└── types/          # Type definitions
    ├── execution.ts
    └── graph.ts
```

## Usage

```typescript
import { RoutineExecutor } from "@kianax/execution-engine";
import { getPluginRegistry } from "@kianax/plugins";

const executor = new RoutineExecutor(getPluginRegistry());

const result = await executor.execute(routine, {
  triggerData: { /* initial data */ },
  onNodeStart: async (nodeId) => {
    console.log(`Starting node: ${nodeId}`);
  },
  onNodeComplete: async (nodeId, result) => {
    console.log(`Completed node: ${nodeId}`, result);
  },
  onNodeError: async (nodeId, error) => {
    console.error(`Failed node: ${nodeId}`, error);
  },
});
```

## Key Features

- **Callback-based API**: Hook into execution lifecycle events
- **Graph validation**: Validates routine structure before execution
- **Port-based data flow**: Explicit port-to-port connections
- **Data lineage tracking**: Track how data flows through the routine
- **Loop support**: Handle loop nodes with iteration tracking
- **Error handling**: Graceful error handling with detailed context
