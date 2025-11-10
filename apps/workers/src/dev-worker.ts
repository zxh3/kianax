/**
 * Development Worker Entry Point
 *
 * Starts a Temporal Worker for local development.
 * In production, workers are deployed with specific task queues.
 */

import dotenv from "dotenv";

dotenv.config();

import { runWorker } from "./worker";

async function main() {
  const taskQueue = process.env.TASK_QUEUE || "default";

  console.log("🚀 Starting Temporal Worker (Development Mode)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📦 Task Queue: ${taskQueue}`);
  console.log(
    `🔗 Convex URL: ${process.env.CONVEX_URL ? "✅ Loaded" : "❌ Not found"}`,
  );
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  await runWorker(taskQueue);
}

main().catch((err) => {
  console.error("❌ Worker failed:", err);
  process.exit(1);
});
