# Scripts

Test scripts and utilities for the Kianax platform.

## Testing Example Workflow

To test the example workflow:

### 1. Start Temporal Server (Terminal 1)
```bash
temporal server start-dev
```

### 2. Start the Worker (Terminal 2)
```bash
cd apps/workers
bun dev
```

### 3. Run the Test Script (Terminal 3)
```bash
cd apps/scripts
bun test:example
```

## Available Scripts

- `bun client` - Run the main client script
- `bun test:example` - Test the example workflow

## What the Test Does

The test script (`test-example-workflow.ts`) demonstrates:

1. **Simple Example**: Executes a basic workflow that greets a user
   - Shows workflow start, activity execution, and result

2. **Multi-Step Example**: Executes a workflow with multiple sequential steps
   - Demonstrates parallel and sequential activity execution
   - Returns structured data

Both tests connect to your local Temporal server and execute workflows via the worker.
