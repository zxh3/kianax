import { loadEnv, getMonorepoRoot } from "./load";
import {
  webConfigSchema,
  workerConfigSchema,
  serverConfigSchema,
  type WebConfig,
  type WorkerConfig,
  type ServerConfig,
  type TemporalConfig,
  type GoogleConfig,
} from "./schemas";

export { loadEnv, getMonorepoRoot };
export type {
  WebConfig,
  WorkerConfig,
  ServerConfig,
  TemporalConfig,
  GoogleConfig,
};

/**
 * Get configuration for the Next.js web app.
 * Loads env vars from root .env.local and validates them.
 *
 * @throws {ZodError} if required env vars are missing or invalid
 */
export function getWebConfig(): WebConfig {
  loadEnv();

  return webConfigSchema.parse({
    convex: {
      publicUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
    },
    temporal: {
      address: process.env.TEMPORAL_ADDRESS,
      namespace: process.env.TEMPORAL_NAMESPACE,
      clientCert: process.env.TEMPORAL_CLIENT_CERT,
      clientKey: process.env.TEMPORAL_CLIENT_KEY,
    },
    openaiKey: process.env.OPENAI_API_KEY,
    siteUrl: process.env.SITE_URL,
  });
}

/**
 * Get configuration for Temporal workers.
 * Loads env vars from root .env.local and validates them.
 *
 * @throws {ZodError} if required env vars are missing or invalid
 */
export function getWorkerConfig(): WorkerConfig {
  loadEnv();

  return workerConfigSchema.parse({
    convex: {
      url: process.env.CONVEX_URL,
    },
    temporal: {
      address: process.env.TEMPORAL_ADDRESS,
      namespace: process.env.TEMPORAL_NAMESPACE,
      clientCert: process.env.TEMPORAL_CLIENT_CERT,
      clientKey: process.env.TEMPORAL_CLIENT_KEY,
    },
    taskQueue: process.env.TASK_QUEUE,
  });
}

/**
 * Get configuration for Convex server functions.
 * Note: In actual Convex functions, env vars are loaded from Convex dashboard.
 * This is primarily useful for local scripts and tests.
 *
 * @throws {ZodError} if required env vars are missing or invalid
 */
export function getServerConfig(): ServerConfig {
  loadEnv();

  return serverConfigSchema.parse({
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    siteUrl: process.env.SITE_URL,
    convexSiteUrl: process.env.CONVEX_SITE_URL,
  });
}

/**
 * Validates that all required env vars for an app are set.
 * Returns a list of missing or invalid vars.
 */
export function validateEnv(app: "web" | "worker" | "server"): {
  valid: boolean;
  errors: string[];
} {
  loadEnv();

  const errors: string[] = [];

  try {
    switch (app) {
      case "web":
        getWebConfig();
        break;
      case "worker":
        getWorkerConfig();
        break;
      case "server":
        getServerConfig();
        break;
    }
    return { valid: true, errors: [] };
  } catch (error: any) {
    if (error.errors) {
      // Zod error
      for (const issue of error.errors) {
        errors.push(`${issue.path.join(".")}: ${issue.message}`);
      }
    } else {
      errors.push(error.message);
    }
    return { valid: false, errors };
  }
}
