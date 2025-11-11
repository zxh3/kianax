# Scripts

Test scripts and utilities for the Kianax platform.

## Testing Routine Execution

To test routine execution with the new BFS-based executor:

### 1. Start Temporal Server (Terminal 1)
```bash
temporal server start-dev
```

### 2. Start the Worker (Terminal 2)
```bash
cd apps/workers
bun dev
```

### 3. Start Convex Backend (Terminal 3)
```bash
cd apps/server
npx convex dev
```

### 4. Run the Test Script (Terminal 4)
```bash
cd apps/scripts
bun test:routine              # Conditional branching (default)
bun test:routine:conditional  # If-else branching (AAPL alert)
bun test:routine:parallel     # Parallel execution (TSLA monitoring)
bun test:routine:linear       # Simple linear flow (GOOGL report)
```

## Available Scripts

### Routine Testing
- `bun test:routine` - Test conditional branching routine (default)
- `bun test:routine:conditional` - Test if-else branching with stock price alert
- `bun test:routine:parallel` - Test parallel node execution with merge
- `bun test:routine:linear` - Test simple linear flow A→B→C

### Database Management
- `bun clear:db` - Show warning and confirmation for clearing database
- `bun clear:db --force` - Clear all tables in Convex database (requires confirmation)
- `bun clear:db --force --table=routines` - Clear specific table only

## Test Routines

### 1. Conditional Branching (Default)
**Flow:** Stock Price Input → If-Else Logic → Email Alert (true) / HTTP Log (false)

Tests:
- Conditional edge traversal
- Dead branch handling (only one path executes)
- Logic node output evaluation

Example:
```
[Stock Price: AAPL]
        ↓
[If price < $150?]
    ↙         ↘
[Email]     [HTTP]
(alert)      (log)
```

### 2. Parallel Execution
**Flow:** Stock Price Input → (Email + HTTP in parallel) → AI Merge

Tests:
- Parallel node execution
- Merge node waiting for multiple inputs
- Fan-out and fan-in patterns

Example:
```
[Stock Price: TSLA]
    ↙         ↘
[Email]    [HTTP]
    ↘         ↙
   [AI Transform]
```

### 3. Linear Flow
**Flow:** Stock Price → AI Transform → Email

Tests:
- Simple sequential execution
- Data flow between nodes
- Basic plugin chaining

Example:
```
[Stock Price: GOOGL]
        ↓
[AI Transform]
        ↓
    [Email]
```

## What Happens During Testing

1. **Script creates a routine** - Defines nodes and connections
2. **Workflow starts** - Temporal client initiates routineExecutor
3. **Worker executes** - BFS traversal with conditional branching
4. **Results stored** - Convex receives real-time execution updates
5. **Status displayed** - Script shows completion status

## Observability

After running a test routine:

1. **Temporal UI**: http://localhost:8233
   - View workflow execution history
   - See activity executions
   - Debug with time-travel replay

2. **Convex Dashboard**: https://dashboard.convex.dev
   - View `routine_executions` table
   - See `nodeStates` for each execution
   - Track `executionPath` (which nodes ran)

## Expected Output

```bash
🚀 Starting Temporal routine execution test

📡 Connecting to Temporal server...
✅ Connected to Temporal

📋 Creating conditional branching routine (AAPL alert)
   Routine ID: routine-abc123
   Nodes: 4
   Connections: 3

▶️  Starting workflow execution...
✅ Workflow started: test-routine-abc123

⏳ Waiting for workflow to complete...

🎉 Workflow completed successfully!

💡 Check Convex dashboard to see execution history and node results
```

## Troubleshooting

**Error: "Failed to connect to Temporal server"**
- Ensure Temporal server is running: `temporal server start-dev`

**Error: "No worker available"**
- Start the worker: `cd apps/workers && bun dev`

**Error: "Failed to update routine status"**
- Ensure Convex is running: `cd apps/server && npx convex dev`
- Check `CONVEX_URL` environment variable

## Testing with Real Plugins

The test script uses mock plugins. To test with real plugins:

1. Implement actual plugin code in `packages/plugins/`
2. Update plugin registry in `packages/plugins/registry.ts`
3. Add credentials to Convex if needed
4. Run the test script

The workflow will execute real plugin logic instead of mocks.
