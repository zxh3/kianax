/**
 * Routine Executor Workflow
 *
 * Generic workflow that executes user-defined routine DAGs.
 * This is the ONLY workflow - it interprets ALL user routines at runtime.
 */

import { proxyActivities, workflowInfo } from "@temporalio/workflow";
import type * as activities from "../activities";
import type { RoutineInput } from "@kianax/shared/temporal";
import { topologicalSort } from "./utils/topological-sort";
import { gatherNodeInputs } from "./utils/gather-inputs";

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
 * Main routine executor workflow
 *
 * Executes a user-defined routine by:
 * 1. Sorting nodes into execution levels (topological sort)
 * 2. Executing nodes in each level in parallel
 * 3. Passing outputs to downstream nodes
 * 4. Updating status in Convex
 */
export async function routineExecutor(input: RoutineInput): Promise<void> {
  const { routineId, userId, nodes, connections, triggerData } = input;

  // Get workflow execution ID to use as executionId
  const { workflowId: executionId } = workflowInfo();

  // Update routine status to running
  await updateRoutineStatus({
    routineId,
    status: "running",
    startedAt: Date.now(),
  });

  try {
    // Sort nodes into execution levels - nodes in same level can run in parallel
    const executionLevels = topologicalSort(nodes, connections);

    // Store node outputs for downstream nodes
    const nodeResults = new Map<string, any>();

    // Execute each level sequentially, but nodes within each level in parallel
    for (const level of executionLevels) {
      // Filter out disabled nodes
      const enabledNodes = level.filter((node) => node.enabled);

      if (enabledNodes.length === 0) {
        continue;
      }

      // Execute all nodes in this level in parallel
      const levelExecutions = enabledNodes.map(async (node) => {
        // Gather inputs from connected upstream nodes
        const inputs = gatherNodeInputs(
          node.id,
          connections,
          nodeResults,
          triggerData,
        );

        try {
          // Execute node as activity
          const output = await executePlugin({
            pluginId: node.pluginId,
            config: node.config,
            inputs,
            context: {
              userId,
              routineId,
              executionId,
              nodeId: node.id,
            },
          });

          // Store result for downstream nodes
          nodeResults.set(node.id, output);

          // Update Convex with node completion
          await storeNodeResult({
            routineId,
            nodeId: node.id,
            status: "completed",
            output,
            completedAt: Date.now(),
          });

          return { nodeId: node.id, success: true };
        } catch (error: any) {
          // Node execution failed
          await storeNodeResult({
            routineId,
            nodeId: node.id,
            status: "failed",
            error: {
              message: error.message,
              stack: error.stack,
            },
            completedAt: Date.now(),
          });

          // Re-throw to stop execution
          throw error;
        }
      });

      // Wait for all nodes in this level to complete
      // If any node fails, Promise.all will reject and throw
      await Promise.all(levelExecutions);
    }

    // All nodes completed successfully
    await updateRoutineStatus({
      routineId,
      status: "completed",
      completedAt: Date.now(),
    });
  } catch (error: any) {
    // Workflow failed
    await updateRoutineStatus({
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
