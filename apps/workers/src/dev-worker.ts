/**
 * Development Worker Entry Point
 *
 * Starts a Temporal Worker for local development.
 * In production, workers are deployed with specific task queues.
 */

import { runWorker } from "./worker";

async function main() {
  const taskQueue = process.env.TASK_QUEUE || "default";

  console.log("🚀 Starting Temporal Worker (Development Mode)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  await runWorker(taskQueue);
}

main().catch((err) => {
  console.error("❌ Worker failed:", err);
  process.exit(1);
});
