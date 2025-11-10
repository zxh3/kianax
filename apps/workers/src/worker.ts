/**
 * Temporal Worker
 *
 * Creates and configures Temporal Workers that execute workflows and activities.
 */

// IMPORTANT: Load environment variables BEFORE importing activities
// Activities run in a separate context and need env vars available at module load time
import dotenv from "dotenv";
dotenv.config();

import { NativeConnection, Worker } from "@temporalio/worker";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as activities from "./activities";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function createWorker(taskQueue: string): Promise<Worker> {
  // Connect to Temporal server
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS || "localhost:7233",
  });

  // Create worker
  return await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || "default",
    taskQueue,
    workflowsPath: join(__dirname, "workflows"),
    activities,
  });
}

export async function runWorker(
  taskQueue: string = "kianax-default",
): Promise<void> {
  const worker = await createWorker(taskQueue);
  console.log(`✅ Worker started on task queue: ${taskQueue}`);
  console.log(
    `📍 Temporal server: ${process.env.TEMPORAL_ADDRESS || "localhost:7233"}`,
  );
  console.log(`🔧 Namespace: ${process.env.TEMPORAL_NAMESPACE || "default"}`);

  await worker.run();
}
