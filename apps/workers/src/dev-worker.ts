/**
 * Development Worker Entry Point
 *
 * Starts a Temporal Worker for local development.
 * In production, workers are deployed with specific task queues.
 */

import { getWorkerConfig, validateEnv } from "@kianax/config";
import { runWorker } from "./worker";

async function main() {
  // Validate env vars before starting
  const validation = validateEnv("worker");
  if (!validation.valid) {
    console.error("❌ Missing required environment variables:");
    for (const error of validation.errors) {
      console.error(`   - ${error}`);
    }
    console.error("\nMake sure .env.local exists at the monorepo root.");
    process.exit(1);
  }

  const config = getWorkerConfig();

  console.log("🚀 Starting Temporal Worker (Development Mode)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📦 Task Queue: ${config.taskQueue}`);
  console.log(`🔗 Convex URL: ✅ ${config.convex.url}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  await runWorker(config.taskQueue);
}

main().catch((err) => {
  console.error("❌ Worker failed:", err);
  process.exit(1);
});
