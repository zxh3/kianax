# Core Libraries (`apps/workers/src/lib`)

This directory contains core library functions and classes that implement fundamental logic for the Kianax worker. These components are designed to be decoupled from Temporal-specific orchestration, allowing for easier testing and reusability.

## Key Component: `GraphIterator` (`graph-executor.ts`)

The `graph-executor.ts` file defines the `GraphIterator` class, which is the brain of the routine execution logic. It is a pure TypeScript class responsible for managing the state and traversal of a routine's Directed Acyclic Graph (DAG), including complex control flows like loops and branching.

### How it Works

1.  **Graph Representation:** It takes a routine definition (nodes and connections) and builds an internal `ExecutionGraph` representation.
2.  **Execution State:** It maintains an `ExecutionState` object that tracks:
    *   Outputs of executed nodes.
    *   A history of executed node-contexts (for accurate dependency resolution in loops).
    *   The current loop stack (for nested loop support).
    *   A queue of tasks ready to be processed.
3.  **`nextBatch()`:** This method identifies and returns a list of `ExecutionTask` objects (nodes with their specific execution context, e.g., current loop iteration) that are currently ready to be executed. A node is ready when all its incoming flow dependencies have been met.
4.  **`markNodeCompleted()`:** When a node finishes execution, this method is called to update the internal state with its output. It then uses the output's control signal (`PluginResult.signal`) to determine which subsequent flow connections to follow.
5.  **Control Flow Handling:**
    *   **Flow Edges (`type: "flow"`):** These connections dictate the execution order. The `GraphIterator` processes these edges based on the `signal` returned by the preceding node, effectively handling branching (e.g., "true", "false" branches).
    *   **Loop Edges:** Special flow edges (`type: "flow"` with `loopConfig`) allow the `GraphIterator` to manage iterative execution, re-queueing nodes for subsequent iterations until `maxIterations` is reached.
6.  **Data Flow Handling:**
    *   **Data Edges (`type: "data"`):** These connections are used by `gatherInputs()` to collect and map outputs from upstream nodes to the inputs of the current node, respecting the execution context (e.g., pulling data from the correct loop iteration or parent scope).
7.  **`isDone()`:** Indicates whether all executable paths in the graph have been completed.
8.  **Validation:** Includes functions (`validateGraph`, `findEntryNodes`, `determineNextNodes`) to ensure the routine's graph structure is valid (e.g., no cycles, proper loop configurations).

The `GraphIterator` provides a deterministic and robust mechanism for traversing and executing complex routine graphs, abstracting away the intricacies of dependency management and control flow.
