# Kianax Type Definitions

> **⚠️ WORK IN PROGRESS**: These type definitions are still being refined and may change as the platform evolves. Not all types are fully implemented yet.

This directory contains TypeScript type definitions for the Kianax platform.

## Structure

### `plugin.ts`
Defines the plugin system types:
- **`Plugin`** - Base plugin interface that all plugins implement
- **`PluginType`** - Plugin categories (trigger, input, processor, logic, output)
- **`PluginMetadata`** - Plugin marketplace metadata
- **`InstalledPlugin`** - User's installed plugin instance
- **`PluginCredentials`** - Encrypted credential storage
- **`CredentialSchema`** - Credential requirements for plugins

### `workflow.ts`
Defines workflow structure and composition:
- **`Workflow`** - Complete workflow definition
- **`WorkflowNode`** - Plugin instance within a workflow
- **`WorkflowConnection`** - Edge connecting two nodes
- **`WorkflowStatus`** - Workflow lifecycle states
- **`WorkflowTemplate`** - Shareable workflow templates
- **`WorkflowValidationResult`** - Validation errors and warnings

### `execution.ts`
Defines workflow execution and monitoring:
- **`WorkflowExecution`** - Execution record with full state
- **`ExecutionStatus`** - Execution lifecycle states
- **`NodeExecutionState`** - Per-node execution state
- **`ExecutionStatistics`** - Analytics and metrics
- **`ExecutionEvent`** - Real-time execution events

### `index.ts`
Central export for all types, plus:
- **`User`** - User account information
- **`UserSettings`** - User preferences and quotas

## Usage

Import types from the central index:

```typescript
import type {
  Workflow,
  Plugin,
  WorkflowExecution,
  ExecutionStatus
} from "@/types";
```

Or import from specific files:

```typescript
import type { Plugin, PluginType } from "@/types/plugin";
import type { Workflow, WorkflowNode } from "@/types/workflow";
```

## Type Safety

All types are designed to work seamlessly with:
- **Convex Schema** - Backend database schemas
- **React Components** - Frontend UI components
- **Temporal Workers** - Workflow execution engine
- **Plugin SDK** - Plugin development

## Examples

### Creating a Workflow Type

```typescript
import type { Workflow, WorkflowNode, WorkflowConnection } from "@/types";

const myWorkflow: Workflow = {
  id: "wf_123",
  userId: "user_456",
  name: "Stock Trading Automation",
  status: "active",
  nodes: [
    {
      id: "node_1",
      pluginId: "stock-price-polygon",
      type: "input",
      label: "Get AAPL Price",
      position: { x: 100, y: 100 },
      enabled: true,
    },
    {
      id: "node_2",
      pluginId: "ai-processor",
      type: "processor",
      label: "Analyze Trend",
      position: { x: 300, y: 100 },
      enabled: true,
    },
  ],
  connections: [
    {
      id: "conn_1",
      sourceNodeId: "node_1",
      targetNodeId: "node_2",
    },
  ],
  version: 1,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
```

### Defining a Plugin Type

```typescript
import type { Plugin, PluginContext } from "@/types";

const stockPricePlugin: Plugin<
  { symbol: string },
  { price: number; timestamp: string },
  { apiKey: string }
> = {
  id: "stock-price-polygon",
  name: "Stock Price (Polygon.io)",
  description: "Get real-time stock prices",
  version: "1.0.0",
  type: "input",
  inputSchema: {
    type: "object",
    properties: {
      symbol: { type: "string" },
    },
    required: ["symbol"],
  },
  outputSchema: {
    type: "object",
    properties: {
      price: { type: "number" },
      timestamp: { type: "string" },
    },
    required: ["price", "timestamp"],
  },
  credentials: [
    {
      key: "apiKey",
      label: "API Key",
      type: "password",
      required: true,
    },
  ],
  execute: async (input, config, context) => {
    // Implementation
    return {
      price: 150.25,
      timestamp: new Date().toISOString(),
    };
  },
};
```

## Validation

Types include JSON Schema definitions for runtime validation:
- Input validation before plugin execution
- Output validation after plugin execution
- Connection type checking between nodes
- Configuration validation

## Future Additions

Planned type additions:
- `Team` - Team workspaces
- `ApiKey` - API key management
- `Webhook` - Webhook configurations
- `Schedule` - Cron schedule definitions
- `Notification` - Notification preferences
