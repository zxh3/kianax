import { z } from "zod";

/**
 * Temporal connection configuration.
 * Used by web (API routes) and workers.
 */
export const temporalSchema = z.object({
  address: z.string().default("localhost:7233"),
  namespace: z.string().default("default"),
  // For Temporal Cloud (mTLS authentication)
  clientCert: z.string().optional(),
  clientKey: z.string().optional(),
});

export type TemporalConfig = z.infer<typeof temporalSchema>;

/**
 * Google OAuth configuration.
 * Used by Convex server for authentication and OAuth credential flows.
 */
export const googleSchema = z.object({
  clientId: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  clientSecret: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
});

export type GoogleConfig = z.infer<typeof googleSchema>;

/**
 * Web app (Next.js) configuration.
 */
export const webConfigSchema = z.object({
  convex: z.object({
    publicUrl: z.string().url("NEXT_PUBLIC_CONVEX_URL must be a valid URL"),
  }),
  temporal: temporalSchema,
  openaiKey: z.string().optional(),
  siteUrl: z.string().url().default("http://localhost:3000"),
});

export type WebConfig = z.infer<typeof webConfigSchema>;

/**
 * Worker app configuration.
 */
export const workerConfigSchema = z.object({
  convex: z.object({
    url: z.string().url("CONVEX_URL must be a valid URL"),
  }),
  temporal: temporalSchema,
  taskQueue: z.string().default("default"),
});

export type WorkerConfig = z.infer<typeof workerConfigSchema>;

/**
 * Convex server configuration.
 * Note: These are used in Convex functions which run in Convex's environment.
 * They must be set via Convex dashboard or `npx convex env set`.
 * This schema is for documentation and validation in scripts/tests.
 */
export const serverConfigSchema = z.object({
  google: googleSchema,
  siteUrl: z.string().url("SITE_URL must be a valid URL"),
  convexSiteUrl: z.string().url("CONVEX_SITE_URL must be a valid URL"),
});

export type ServerConfig = z.infer<typeof serverConfigSchema>;
