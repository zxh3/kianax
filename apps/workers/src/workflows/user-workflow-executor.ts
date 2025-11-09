/**
 * Generic Workflow Executor
 *
 * Executes user-defined workflows represented as DAGs.
 * This is the core workflow engine that orchestrates plugin execution.
 */

import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';
import type { Workflow } from '@kianax/shared';

// Create activity proxies with type safety
const { executePlugin, updateExecutionStatus } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

/**
 * Execute a user-defined workflow DAG
 */
export async function userWorkflowExecutor(workflow: Workflow): Promise<void> {
  console.log(`Starting workflow execution: ${workflow.id}`);

  // TODO: Implement DAG traversal and execution
  // For now, just a simple example
  for (const node of workflow.nodes) {
    await updateExecutionStatus({
      executionId: workflow.id,
      nodeId: node.id,
      status: 'running',
    });

    try {
      const result = await executePlugin({
        pluginId: node.pluginId,
        input: {}, // TODO: Get input from previous nodes
        config: node.config,
        userId: workflow.userId,
        workflowId: workflow.id,
      });

      await updateExecutionStatus({
        executionId: workflow.id,
        nodeId: node.id,
        status: 'completed',
        output: result,
      });
    } catch (error) {
      await updateExecutionStatus({
        executionId: workflow.id,
        nodeId: node.id,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  console.log(`Workflow execution completed: ${workflow.id}`);
}
