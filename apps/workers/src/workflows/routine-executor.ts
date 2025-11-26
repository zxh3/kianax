/**
 * Dynamic Routine Executor Workflow
 *
 * Supports conditional branching, parallel execution, and dynamic routing.
 *
 * Key features:
 * - Conditional edge traversal (if-else, switch)
 * - BFS-based execution (dynamic path determination)
 * - Better data flow (handle-based input/output mapping)
 */

import {
  proxyActivities,
  workflowInfo,
  ApplicationFailure,
} from "@temporalio/workflow";
import type * as activities from "../activities";
import type { RoutineInput } from "@kianax/shared/temporal";
import {
  buildExecutionGraph,
  validateGraph,
  GraphIterator,
  type ExecutionTask,
  type ExecutionGraph,
} from "../lib/graph-executor";

// Proxy activities with timeout and retry configuration
const {
  executePlugin,
  createRoutineExecution,
  updateRoutineStatus,
  storeNodeResult,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minutes",
  retry: {
    initialInterval: "1s",
    backoffCoefficient: 2,
    maximumInterval: "1m",
    maximumAttempts: 3,
  },
});

// Concurrency limit
const MAX_CONCURRENT_ACTIVITIES = 20;

/**
 * Dynamic Routine Executor
 *
 * Executes a user-defined routine with support for:
 * - Conditional branching (if-else, switch)
 * - Parallel execution (independent nodes)
 * - Dynamic routing (runtime path determination)
 */
export async function routineExecutor(input: RoutineInput): Promise<void> {
  const { routineId, userId, triggerData } = input;

  // Get workflow execution info
  const { workflowId: executionId, runId } = workflowInfo();

  // Validate graph structure
  const validation = validateGraph(input);
  if (!validation.valid) {
    throw new Error(`Invalid routine graph:\n${validation.errors.join("\n")}`);
  }

  // Create execution record in Convex
  await createRoutineExecution({
    routineId,
    userId,
    workflowId: executionId,
    runId,
    triggerType: (triggerData as any)?.triggerType || "manual",
    triggerData,
  });

  // Update routine status to running
  await updateRoutineStatus({
    workflowId: executionId,
    routineId,
    status: "running",
    startedAt: Date.now(),
  });

  try {
    // Initialize Graph Iterator
    const graph = buildExecutionGraph(input);
    const iterator = new GraphIterator(graph);

    // Active promises tracker
    // Key: nodeId|contextHash
    const pendingPromises = new Map<string, Promise<void>>();

    // Task buffer (for tasks ready but waiting for concurrency slot)
    const taskBuffer: ExecutionTask[] = [];

    // Main Event Loop
    while (
      !iterator.isDone() ||
      pendingPromises.size > 0 ||
      taskBuffer.length > 0
    ) {
      // 1. Refill Buffer
      // Pull as many as we can to fill buffer up to a reasonable size (e.g. 2x concurrent limit)
      // to avoid calling nextBatch() too often if graph is huge
      if (taskBuffer.length < MAX_CONCURRENT_ACTIVITIES) {
        const newTasks = iterator.nextBatch();
        taskBuffer.push(...newTasks);
      }

      // 2. Schedule Activities
      while (
        pendingPromises.size < MAX_CONCURRENT_ACTIVITIES &&
        taskBuffer.length > 0
      ) {
        const task = taskBuffer.shift()!;
        const taskKey = getTaskKey(task);

        // Create the promise for this node execution
        const promise = executeNode(task, graph, iterator, executionId)
          .then((output) => {
            // Success: Update graph state
            iterator.markNodeCompleted(task, output);
          })
          .catch((err) => {
            // Failure: Mark failed
            iterator.markNodeFailed(task, err);
            throw err; // Re-throw to be caught by Promise.race
          })
          .finally(() => {
            // Cleanup from pending map
            pendingPromises.delete(taskKey);
          });

        pendingPromises.set(taskKey, promise);
      }

      // 3. Wait for progress
      if (pendingPromises.size > 0) {
        // Wait for at least one activity to finish
        // This unblocks the loop to schedule new ready tasks
        await Promise.race(pendingPromises.values());
      } else {
        // No pending activities.
        // If iterator is not done and buffer is empty, we might be deadlocked?
        if (iterator.hasRunningNodes()) {
          // Should be impossible if pendingPromises is empty but runningNodes > 0
          // unless we failed to track a promise.
          throw new ApplicationFailure(
            "Execution stalled: Internal state mismatch",
          );
        }

        // If iterator is done (no queue, no running), we exit loop.
        break;
      }
    }

    // All nodes completed successfully
    await updateRoutineStatus({
      workflowId: executionId,
      routineId,
      status: "completed",
      completedAt: Date.now(),
      executionPath: iterator.getState().executionPath,
    });
  } catch (error: any) {
    // Workflow failed
    await updateRoutineStatus({
      workflowId: executionId,
      routineId,
      status: "failed",
      error: {
        message: error.message,
        stack: error.stack,
      },
      completedAt: Date.now(),
    });

    // Re-throw for Temporal to record
    throw error;
  }
}

function getTaskKey(task: ExecutionTask): string {
  // Simple unique key for the map
  // logic matches GraphIterator.getContextKey roughly but doesn't need to be exact
  // as long as it's unique per execution instance
  if (task.context.loopStack.length === 0) return task.nodeId;
  const hash = task.context.loopStack
    .map((l) => `${l.edgeId}:${l.iteration}`)
    .join("|");
  return `${task.nodeId}|${hash}`;
}

/**
 * Execute a single node
 */
async function executeNode(
  task: ExecutionTask,
  graph: ExecutionGraph,
  iterator: GraphIterator,
  executionId: string,
): Promise<unknown> {
  const node = graph.nodes.get(task.nodeId);

  if (!node) {
    throw new Error(`Node not found: ${task.nodeId}`);
  }

  // Gather inputs using the Iterator's context-aware logic
  const inputs = iterator.gatherInputs(task);

  try {
    // Get innermost loop context for logging/metrics
    const currentLoop =
      task.context.loopStack[task.context.loopStack.length - 1];
    const iteration = currentLoop ? currentLoop.iteration : undefined;
    const accumulator = currentLoop ? currentLoop.accumulator : undefined;

    // Execute plugin as Temporal Activity
    const output = await executePlugin({
      pluginId: node.pluginId,
      config: node.config,
      inputs,
      context: {
        userId: graph.userId,
        routineId: graph.routineId,
        executionId,
        nodeId: task.nodeId,
        triggerData: graph.triggerData,
        loopIteration: iteration,
        loopAccumulator: accumulator,
      },
    });

    // Persist to Convex for observability
    await storeNodeResult({
      workflowId: executionId,
      routineId: graph.routineId,
      nodeId: task.nodeId,
      iteration: iteration,
      status: "completed",
      output,
      completedAt: Date.now(),
    });

    return output;
  } catch (error: any) {
    const rootCause = error.cause || error;
    const errorMessage = rootCause.message || error.message || "Unknown error";
    const errorStack = rootCause.stack || error.stack;

    // Get iteration for error log
    const currentLoop =
      task.context.loopStack[task.context.loopStack.length - 1];
    const iteration = currentLoop ? currentLoop.iteration : undefined;

    // Node execution failed
    await storeNodeResult({
      workflowId: executionId,
      routineId: graph.routineId,
      nodeId: task.nodeId,
      iteration: iteration,
      status: "failed",
      error: {
        message: errorMessage,
        stack: errorStack,
      },
      completedAt: Date.now(),
    });

    // Re-throw to stop execution
    throw new Error(
      `Node ${task.nodeId} (${node.pluginId}) failed: ${errorMessage}`,
    );
  }
}
