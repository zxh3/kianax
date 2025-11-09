/**
 * Routine Executor (Temporal Workflow)
 *
 * Executes user-defined routines represented as DAGs.
 * This is a Temporal Workflow that orchestrates plugin execution.
 *
 * NOTE: "Workflow" here refers to Temporal's execution engine concept.
 *       "Routine" is the user-facing product concept (automation DAG).
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';
import type { Routine } from '@kianax/shared';

// Create activity proxies with type safety
const { executePlugin, updateExecutionStatus } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

/**
 * Execute a user-defined routine DAG
 */
export async function routineExecutor(routine: Routine): Promise<void> {
  console.log(`Starting routine execution: ${routine.id}`);

  // TODO: Implement DAG traversal and execution
  // For now, just a simple example
  for (const node of routine.nodes) {
    await updateExecutionStatus({
      executionId: routine.id,
      nodeId: node.id,
      status: 'running',
    });

    try {
      const result = await executePlugin({
        pluginId: node.pluginId,
        input: {}, // TODO: Get input from previous nodes
        config: node.config,
        userId: routine.userId,
        workflowId: routine.id, // Still called workflowId in context for Temporal
      });

      await updateExecutionStatus({
        executionId: routine.id,
        nodeId: node.id,
        status: 'completed',
        output: result,
      });
    } catch (error) {
      await updateExecutionStatus({
        executionId: routine.id,
        nodeId: node.id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  console.log(`Routine execution completed: ${routine.id}`);
}
