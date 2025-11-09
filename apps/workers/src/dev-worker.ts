/**
 * Development Worker Entry Point
 *
 * Runs a Temporal worker for local development.
 * Uses localhost Temporal server.
 */

import { Worker } from '@temporalio/worker';
import * as activities from './activities';

async function run() {
  const worker = await Worker.create({
    workflowsPath: new URL('./workflows/index.ts', import.meta.url).pathname,
    activities,
    taskQueue: 'kianax-workflows',
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
  });

  console.log('🚀 Temporal worker started (development mode)');
  console.log(`   Task Queue: kianax-workflows`);
  console.log(`   Namespace: ${process.env.TEMPORAL_NAMESPACE || 'default'}`);
  console.log(`   Temporal Server: ${process.env.TEMPORAL_ADDRESS || 'localhost:7233'}`);

  await worker.run();
}

run().catch((err) => {
  console.error('Worker failed:', err);
  process.exit(1);
});
