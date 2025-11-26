# Workflows (`apps/workers/src/workflows`)

This directory contains the Temporal Workflow definitions for the Kianax automation engine. Workflows orchestrate the execution of routines, ensuring durability, fault tolerance, and complex state management.

## Key Component: `routine-executor.ts`

The `routine-executor.ts` file defines the primary workflow responsible for executing user-defined routines.

### How it Works

1.  **Routine Initialization:** Upon receiving a `RoutineInput`, the workflow validates the routine's graph structure and creates an initial execution record in Convex.
2.  **Graph Traversal:** It utilizes a `GraphIterator` (from `../lib/graph-executor.ts`) to manage the state and determine the next set of nodes ready for execution.
3.  **Activity Execution:** Nodes are executed as Temporal Activities, which perform the actual work (e.g., calling plugins, interacting with external services).
4.  **Concurrency Management:** The workflow limits the number of parallel activities to prevent system overload.
5.  **Progress Tracking:** As activities complete, the workflow updates the `GraphIterator`'s state, which then identifies new ready nodes based on control flow (e.g., branches, loops) and data dependencies.
6.  **Observability:** Updates to the routine's status and node results are persisted to Convex, providing real-time visibility into execution.
7.  **Durability:** Thanks to Temporal, the workflow can withstand worker failures, network issues, and system restarts, always resuming from its last known state.

This workflow is the central coordinator that brings routine definitions to life, ensuring reliable and dynamic execution.
