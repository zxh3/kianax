/**
 * Routine Executor Workflow
 *
 * Generic workflow that executes user-defined routine DAGs.
 * This is the ONLY workflow - it interprets ALL user routines at runtime.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';
import type { RoutineInput } from '@kianax/shared/temporal';
import { topologicalSort } from './utils/topological-sort';
import { gatherNodeInputs } from './utils/gather-inputs';

// Proxy activities with timeout and retry configuration
const {
  executePlugin,
  updateRoutineStatus,
  storeNodeResult,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumInterval: '1m',
    maximumAttempts: 3,
  },
});

/**
 * Main routine executor workflow
 *
 * Executes a user-defined routine by:
 * 1. Sorting nodes topologically
 * 2. Executing each node as an activity
 * 3. Passing outputs to downstream nodes
 * 4. Updating status in Convex
 */
export async function routineExecutor(input: RoutineInput): Promise<void> {
  const { routineId, userId, nodes, connections, triggerData } = input;

  // Update routine status to running
  await updateRoutineStatus({
    routineId,
    status: 'running',
    startedAt: Date.now(),
  });

  try {
    // Sort nodes in execution order (deterministic)
    const sortedNodes = topologicalSort(nodes, connections);

    // Store node outputs for downstream nodes
    const nodeResults = new Map<string, any>();

    // Execute nodes in order
    for (const node of sortedNodes) {
      // Skip disabled nodes
      if (!node.enabled) {
        continue;
      }

      // Gather inputs from connected upstream nodes
      const inputs = gatherNodeInputs(
        node.id,
        connections,
        nodeResults,
        triggerData
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
            nodeId: node.id,
          },
        });

        // Store result for downstream nodes
        nodeResults.set(node.id, output);

        // Update Convex with node completion
        await storeNodeResult({
          routineId,
          nodeId: node.id,
          status: 'completed',
          output,
          completedAt: Date.now(),
        });
      } catch (error: any) {
        // Node execution failed
        await storeNodeResult({
          routineId,
          nodeId: node.id,
          status: 'failed',
          error: {
            message: error.message,
            stack: error.stack,
          },
          completedAt: Date.now(),
        });

        // Stop execution on first failure
        throw error;
      }
    }

    // All nodes completed successfully
    await updateRoutineStatus({
      routineId,
      status: 'completed',
      completedAt: Date.now(),
    });
  } catch (error: any) {
    // Workflow failed
    await updateRoutineStatus({
      routineId,
      status: 'failed',
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
