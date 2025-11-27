import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

let loaded = false;

/**
 * Loads environment variables from the monorepo root .env.local file.
 *
 * Searches upward from the current working directory to find the monorepo root
 * (identified by the presence of turbo.json), then loads .env.local from there.
 *
 * This function is idempotent - calling it multiple times has no effect.
 */
export function loadEnv(): void {
  if (loaded) return;

  const root = findMonorepoRoot(process.cwd());

  if (!root) {
    console.warn(
      "[@kianax/config] Could not find monorepo root. Falling back to default dotenv behavior.",
    );
    config();
    loaded = true;
    return;
  }

  // Try .env.local first, then .env
  const envLocalPath = resolve(root, ".env.local");
  const envPath = resolve(root, ".env");

  if (existsSync(envLocalPath)) {
    config({ path: envLocalPath });
  } else if (existsSync(envPath)) {
    config({ path: envPath });
  } else {
    console.warn(
      `[@kianax/config] No .env.local or .env found at monorepo root: ${root}`,
    );
  }

  loaded = true;
}

/**
 * Finds the monorepo root by walking up the directory tree looking for turbo.json.
 */
function findMonorepoRoot(startDir: string): string | null {
  let dir = startDir;
  const root = resolve("/");

  while (dir !== root) {
    if (existsSync(resolve(dir, "turbo.json"))) {
      return dir;
    }
    dir = resolve(dir, "..");
  }

  return null;
}

/**
 * Returns the path to the monorepo root, or null if not found.
 */
export function getMonorepoRoot(): string | null {
  return findMonorepoRoot(process.cwd());
}
