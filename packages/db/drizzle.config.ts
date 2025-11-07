import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/schema/index.ts",
	out: "./src/migrations",
	dbCredentials: {
		host: process.env.DATABASE_HOST || "localhost",
		port: Number(process.env.DATABASE_PORT) || 5432,
		user: process.env.DATABASE_USER || "postgres",
		password: process.env.DATABASE_PASSWORD || "postgres",
		database: process.env.DATABASE_NAME || "kianax",
		ssl: false,
	},
	verbose: true,
	strict: true,
});
