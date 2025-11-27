/**
 * @kianax/config
 *
 * Shared environment variable schemas and validation utilities.
 * Each app loads its own .env.local file and uses these schemas to validate.
 */

import { z } from "zod";

// =============================================================================
// Shared Schemas
// =============================================================================

export const convexSchema = z.object({
  url: z.string().url("CONVEX_URL must be a valid URL"),
});

export const convexPublicSchema = z.object({
  publicUrl: z.string().url("NEXT_PUBLIC_CONVEX_URL must be a valid URL"),
});

export const temporalSchema = z.object({
  address: z.string().default("localhost:7233"),
  namespace: z.string().default("default"),
  clientCert: z.string().optional(),
  clientKey: z.string().optional(),
});

export const googleOAuthSchema = z.object({
  clientId: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  clientSecret: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
});

// =============================================================================
// App-specific Schemas
// =============================================================================

export const webEnvSchema = z.object({
  convex: convexPublicSchema,
  temporal: temporalSchema,
  openaiKey: z.string().optional(),
  siteUrl: z.string().url().default("http://localhost:3000"),
});

export const workerEnvSchema = z.object({
  convex: convexSchema,
  temporal: temporalSchema,
  taskQueue: z.string().default("default"),
});

export const serverEnvSchema = z.object({
  google: googleOAuthSchema,
  siteUrl: z.string().url("SITE_URL must be a valid URL"),
  convexSiteUrl: z.string().url("CONVEX_SITE_URL must be a valid URL"),
});

// =============================================================================
// Type Exports
// =============================================================================

export type WebEnv = z.infer<typeof webEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type TemporalConfig = z.infer<typeof temporalSchema>;
export type GoogleOAuthConfig = z.infer<typeof googleOAuthSchema>;

// =============================================================================
// Validation Utilities
// =============================================================================

/**
 * Parse and validate web app environment variables.
 * Call this after loading your .env.local file via dotenv.
 */
export function parseWebEnv(): WebEnv {
  return webEnvSchema.parse({
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
 * Parse and validate worker environment variables.
 * Call this after loading your .env.local file via dotenv.
 */
export function parseWorkerEnv(): WorkerEnv {
  return workerEnvSchema.parse({
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
 * Parse and validate server (Convex) environment variables.
 * Note: In Convex functions, env vars come from Convex dashboard.
 */
export function parseServerEnv(): ServerEnv {
  return serverEnvSchema.parse({
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    siteUrl: process.env.SITE_URL,
    convexSiteUrl: process.env.CONVEX_SITE_URL,
  });
}

/**
 * Validate environment variables and return errors if any.
 * Useful for startup checks.
 */
export function validateEnv(parser: () => unknown): {
  valid: boolean;
  errors: string[];
} {
  try {
    parser();
    return { valid: true, errors: [] };
  } catch (error: any) {
    const errors: string[] = [];
    if (error.errors) {
      for (const issue of error.errors) {
        errors.push(`${issue.path.join(".")}: ${issue.message}`);
      }
    } else {
      errors.push(error.message);
    }
    return { valid: false, errors };
  }
}
