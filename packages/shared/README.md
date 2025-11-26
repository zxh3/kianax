# @kianax/shared

Workflow type definitions for Temporal execution.

## Purpose

This package defines the **contract** between workers and scripts for routine execution via Temporal workflows.

## Contents

- **Temporal Types**: Interface definitions for workflow inputs, activity inputs, and execution tracking
  - `RoutineInput` - Input to the routine executor workflow
  - `ExecutePluginInput` - Input to the plugin execution activity
  - `CreateRoutineExecutionInput` - Create execution record
  - `UpdateRoutineStatusInput` - Update execution status
  - `StoreNodeResultInput` - Store node execution results

## Usage

```typescript
import type { RoutineInput, ExecutePluginInput } from '@kianax/shared/temporal';
```

## Why This Package Exists

Scripts need to trigger workflows via Temporal client, which requires knowing the workflow input types. Workers need the same types to define workflow signatures. This package is the minimal shared contract between them.
