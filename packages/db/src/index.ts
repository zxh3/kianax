// Main entry point for @kianax/db package

// Export database client
export { db, client } from "./client";

// Export all schemas and types
export * from "./schema";

// Re-export commonly used drizzle-orm utilities
export { eq, and, or, not, sql } from "drizzle-orm";
