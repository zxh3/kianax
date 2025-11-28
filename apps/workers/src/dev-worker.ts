/**
 * Development Worker Entry Point
 *
 * Starts a Temporal Worker for local development.
 * In production, workers are deployed with specific task queues.
 */

// Load env vars FIRST before any other imports that might use them
import "dotenv/config";

import { parseWorkerEnv, validateEnv } from "@kianax/config";
import { runWorker } from "./worker.js";

async function main() {
  // Validate env vars before starting
  const validation = validateEnv(parseWorkerEnv);
  if (!validation.valid) {
    console.error("❌ Missing required environment variables:");
    for (const error of validation.errors) {
      console.error(`   - ${error}`);
    }
    console.error("\nMake sure .env.local exists in apps/workers/");
    process.exit(1);
  }

  const env = parseWorkerEnv();

  console.log("🚀 Starting Temporal Worker (Development Mode)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📦 Task Queue: ${env.taskQueue}`);
  console.log(`🔗 Convex URL: ✅ ${env.convex.url}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  await runWorker(env.taskQueue);
}

main().catch((err) => {
  console.error("❌ Worker failed:", err);
  process.exit(1);
});
