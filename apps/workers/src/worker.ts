/**
 * Temporal Worker
 *
 * Creates and configures Temporal Workers that execute workflows and activities.
 */

import { getWorkerConfig } from "@kianax/config";
import { NativeConnection, Worker } from "@temporalio/worker";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as activities from "./activities";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function createWorker(taskQueue: string): Promise<Worker> {
  const config = getWorkerConfig();

  // Connect to Temporal server
  const connection = await NativeConnection.connect({
    address: config.temporal.address,
  });

  // Create worker
  return await Worker.create({
    connection,
    namespace: config.temporal.namespace,
    taskQueue,
    workflowsPath: join(__dirname, "workflows"),
    activities,
  });
}

export async function runWorker(
  taskQueue: string = "kianax-default",
): Promise<void> {
  const config = getWorkerConfig();
  const worker = await createWorker(taskQueue);

  console.log(`✅ Worker started on task queue: ${taskQueue}`);
  console.log(`📍 Temporal server: ${config.temporal.address}`);
  console.log(`🔧 Namespace: ${config.temporal.namespace}`);

  await worker.run();
}
