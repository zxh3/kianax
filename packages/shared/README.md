# @kianax/shared

Shared types, utilities, and constants used across Kianax packages.

## Usage

```typescript
import type { Workflow, Plugin, ExecutionStatus } from '@kianax/shared';
```

## Structure

- `src/types/` - TypeScript type definitions
  - `workflow.ts` - Workflow DAG types
  - `plugin.ts` - Plugin system types
  - `execution.ts` - Execution monitoring types
  - `index.ts` - Central exports

## Packages Using This

- `apps/web` - Next.js frontend
- `apps/workers` - Temporal workers
- `packages/plugin-sdk` - Plugin development SDK (future)
