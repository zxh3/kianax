/**
 * Development Worker Entry Point
 *
 * Starts a Temporal Worker for local development.
 * In production, workers are deployed with specific task queues.
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local in the workers directory
config({ path: resolve(import.meta.dirname || __dirname, "../.env.local") });

import { runWorker } from "./worker";

async function main() {
  const taskQueue = process.env.TASK_QUEUE || "default";

  console.log("🚀 Starting Temporal Worker (Development Mode)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📦 Task Queue: ${taskQueue}`);
  console.log(
    `🔗 Convex URL: ${process.env.CONVEX_URL ? "✅ Loaded" : "❌ Not found"}`
  );
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  await runWorker(taskQueue);
}

main().catch((err) => {
  console.error("❌ Worker failed:", err);
  process.exit(1);
});
