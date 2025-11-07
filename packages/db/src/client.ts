import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Connection string from environment variables
const connectionString =
	process.env.DATABASE_URL ||
	`postgresql://${process.env.DATABASE_USER || "postgres"}:${process.env.DATABASE_PASSWORD || "postgres"}@${process.env.DATABASE_HOST || "localhost"}:${process.env.DATABASE_PORT || "5432"}/${process.env.DATABASE_NAME || "kianax"}`;

// Create postgres client
const client = postgres(connectionString, {
	max: 10, // Connection pool size
	idle_timeout: 20,
	connect_timeout: 10,
});

// Create drizzle instance with schema
export const db = drizzle(client, { schema });

// Export client for manual queries if needed
export { client };
