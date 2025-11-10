/**
 * Activities Export
 *
 * Exports all Temporal activities.
 * Activities are imported by workflows via proxyActivities().
 */

/**
 * Load environment variables before activities initialize
 * This ensures env vars are available when activities use lazy initialization
 */
import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from the workers directory (two levels up from src/activities/)
const envPath = resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

export * from './plugins';
export * from './convex';
export * from './example';
