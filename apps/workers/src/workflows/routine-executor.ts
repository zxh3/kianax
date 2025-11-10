/**
 * Dynamic Routine Executor Workflow
 *
 * Supports conditional branching, parallel execution, and dynamic routing.
 *
 * Key features:
 * - Conditional edge traversal (if-else branches)
 * - BFS-based execution (dynamic path determination)
 * - Better data flow (handle-based input/output mapping)
 */

import { proxyActivities, workflowInfo } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";
import type { RoutineInput } from "@kianax/shared/temporal";
import {
  buildExecutionGraph,
  findEntryNodes,
  findReadyNodes,
  determineNextNodes,
  gatherNodeInputs,
  validateGraph,
  ExecutionState,
  type ExecutionGraph,
} from "../lib/graph-executor.js";

// Proxy activities with timeout and retry configuration
const { executePlugin, updateRoutineStatus, storeNodeResult } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: "5 minutes",
  retry: {
    initialInterval: "1s",
    backoffCoefficient: 2,
    maximumInterval: "1m",
    maximumAttempts: 3,
  },
});

/**
 * Dynamic Routine Executor
 *
 * Executes a user-defined routine with support for:
 * - Conditional branching (if-else, switch)
 * - Parallel execution (independent nodes)
 * - Dynamic routing (runtime path determination)
 */
export async function routineExecutor(input: RoutineInput): Promise<void> {
  const { routineId, userId } = input;

  // Get workflow execution ID
  const { workflowId: executionId } = workflowInfo();

  // Validate graph structure
  const validation = validateGraph(input);
  if (!validation.valid) {
    throw new Error(`Invalid routine graph:\n${validation.errors.join("\n")}`);
  }

  // Update routine status to running
  await updateRoutineStatus({
    workflowId: executionId,
    routineId,
    status: "running",
    startedAt: Date.now(),
  });

  try {
    // Build execution graph
    const graph = buildExecutionGraph(input);
    const state = new ExecutionState();

    // Execute graph with BFS traversal
    await executeBFS(graph, state, executionId);

    // All nodes completed successfully
    await updateRoutineStatus({
      workflowId: executionId,
      routineId,
      status: "completed",
      completedAt: Date.now(),
      executionPath: state.executionPath,
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

/**
 * BFS execution with conditional branching
 */
async function executeBFS(
  graph: ExecutionGraph,
  state: ExecutionState,
  executionId: string,
): Promise<void> {
  // Find entry nodes (no incoming edges)
  const entryNodes = findEntryNodes(graph.nodes, graph.edges);

  if (entryNodes.length === 0) {
    throw new Error("No entry nodes found - routine has no starting point");
  }

  // Initialize queue with entry nodes
  let queue = [...entryNodes];

  while (queue.length > 0) {
    // Find nodes ready to execute (all dependencies satisfied)
    const ready = findReadyNodes(queue, graph.edges, state);

    if (ready.length === 0) {
      // No nodes ready - check if we're done or have a deadlock
      if (queue.length > 0) {
        throw new Error(
          `Execution deadlock: ${queue.length} nodes waiting but none are ready`,
        );
      }
      break;
    }

    // Execute ready nodes in parallel
    await Promise.all(
      ready.map((nodeId) => executeNode(nodeId, graph, state, executionId)),
    );

    // Remove executed nodes from queue
    queue = queue.filter((id) => !state.executed.has(id));

    // Determine next nodes based on outputs (handles conditional branching)
    const nextNodes = new Set<string>();

    for (const nodeId of ready) {
      const nodeOutput = state.nodeOutputs.get(nodeId);
      const next = determineNextNodes(
        nodeId,
        nodeOutput,
        graph.nodes,
        graph.edges,
      );

      // Add to queue if not already executed or queued
      for (const nextId of next) {
        if (!state.executed.has(nextId) && !queue.includes(nextId)) {
          nextNodes.add(nextId);
        }
      }
    }

    // Add next nodes to queue
    queue.push(...Array.from(nextNodes));
  }
}

/**
 * Execute a single node
 */
async function executeNode(
  nodeId: string,
  graph: ExecutionGraph,
  state: ExecutionState,
  executionId: string,
): Promise<void> {
  const node = graph.nodes.get(nodeId);

  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  // Gather inputs from upstream nodes
  const inputs = gatherNodeInputs(nodeId, graph.edges, state);

  try {
    // Execute plugin as Temporal Activity
    const output = await executePlugin({
      pluginId: node.pluginId,
      config: node.config,
      inputs,
      context: {
        userId: graph.userId,
        routineId: graph.routineId,
        executionId,
        nodeId,
        triggerData: graph.triggerData,
      },
    });

    // Store output for downstream nodes
    state.nodeOutputs.set(nodeId, output);
    state.executed.add(nodeId);
    state.executionPath.push(nodeId);

    // Persist to Convex for observability
    await storeNodeResult({
      workflowId: executionId,
      routineId: graph.routineId,
      nodeId,
      status: "completed",
      output,
      completedAt: Date.now(),
    });
  } catch (error: any) {
    // Node execution failed
    await storeNodeResult({
      workflowId: executionId,
      routineId: graph.routineId,
      nodeId,
      status: "failed",
      error: {
        message: error.message,
        stack: error.stack,
      },
      completedAt: Date.now(),
    });

    // Re-throw to stop execution
    throw new Error(
      `Node ${nodeId} (${node.pluginId}) failed: ${error.message}`,
    );
  }
}
