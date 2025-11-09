/**
 * Production Worker Entry Point
 *
 * Runs a Temporal worker for production.
 * Connects to Temporal Cloud with TLS.
 */

import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

async function run() {
  // For production with Temporal Cloud
  let connection: NativeConnection | undefined;

  if (process.env.TEMPORAL_CLIENT_CERT && process.env.TEMPORAL_CLIENT_KEY) {
    connection = await NativeConnection.connect({
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
      tls: {
        clientCertPair: {
          crt: Buffer.from(process.env.TEMPORAL_CLIENT_CERT, 'base64'),
          key: Buffer.from(process.env.TEMPORAL_CLIENT_KEY, 'base64'),
        },
      },
    });
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const worker = await Worker.create({
    connection,
    workflowsPath: join(__dirname, 'workflows'),
    activities,
    taskQueue: 'kianax-workflows',
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
  });

  console.log('🚀 Temporal worker started (production mode)');
  console.log(`   Task Queue: kianax-workflows`);
  console.log(`   Namespace: ${process.env.TEMPORAL_NAMESPACE || 'default'}`);
  console.log(`   Temporal Server: ${process.env.TEMPORAL_ADDRESS}`);

  await worker.run();
}

run().catch((err) => {
  console.error('Worker failed:', err);
  process.exit(1);
});
