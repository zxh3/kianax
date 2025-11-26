# Project Tasks & Roadmap

## Architecture & Scalability

- [x] **Fix Nested Loops Support**
  - Implemented `loopStack` in `GraphIterator` (`apps/workers/src/lib/graph-executor.ts`) to track nested loop contexts.

- [ ] **Handle Temporal History Limits (continueAsNew)**
  - **Context:** Long-running loops or massive graphs can exceed Temporal's 50MB/50k event history limit.
  - **Action:** Implement `continueAsNew` pattern. 
  - **Plan:** Serialize `GraphIterator.state` and pass it to the next workflow run.
  - **File:** `apps/workers/src/workflows/routine-executor.ts`

- [x] **Concurrency Control**
  - Implemented manual promise buffering in `routineExecutor` workflow loop (Limit: 20 concurrent activities).

## Security

- [x] **Secure Credential Handling**
  - Implemented `getWorkerCredentials` query in Convex and updated `executePlugin` activity to fetch credentials dynamically.

## Refactoring

- [x] **Decouple Traversal from Execution ("Dumb Workflow")**
  - Extracted `GraphIterator` class in `apps/workers/src/lib/graph-executor.ts`.
  - Workflow now acts as a simple runner for the iterator.

- [x] **Standardize Control Flow Plugins**
  - **Context:** Logic for `if/else` and `loops` is hardcoded in `determineNextNodes` using magic strings.
  - **Action:** Formalize a `ControlFlowPlugin` interface. Control flow plugins should return execution instructions (e.g., `EdgeSelection`) rather than just data.
  - **Status:** Completed. Implemented strict separation of `flow` vs `data` edges and standardized `PluginResult` signal.
  - **Update:** Refined `Connection` types to use a discriminated union (`FlowConnection` | `DataConnection`) for compile-time safety.
  - **Update:** Standardized on `sourceHandle` and `targetHandle` for all connection types.
