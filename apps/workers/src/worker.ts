/**
 * Temporal Worker
 *
 * Creates and configures Temporal Workers that execute workflows and activities.
 */

import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';

export async function createWorker(taskQueue: string): Promise<Worker> {
  // Connect to Temporal server
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  // Create worker
  return await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    taskQueue,
    workflowsPath: require.resolve('./workflows'),
    activities,
  });
}

export async function runWorker(
  taskQueue: string = 'kianax-default'
): Promise<void> {
  const worker = await createWorker(taskQueue);
  console.log(`✅ Worker started on task queue: ${taskQueue}`);
  console.log(`📍 Temporal server: ${process.env.TEMPORAL_ADDRESS || 'localhost:7233'}`);
  console.log(`🔧 Namespace: ${process.env.TEMPORAL_NAMESPACE || 'default'}`);

  await worker.run();
}
