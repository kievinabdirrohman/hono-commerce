import { defineConfig } from "drizzle-kit";
import { config } from "./src/config/env";

export default defineConfig({
	schema: "./src/infrastructure/database/schema/index.ts",
	out: "./migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: config.database.url,
	},
	verbose: true,
	strict: true,
	migrations: {
		table: "migrations",
		schema: "public",
	},
});
