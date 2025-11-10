import { config } from "@config/env";
import { log } from "@config/logger";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Migration script
 * Runs database migrations and seeds
 */

const runMigrations = async () => {
	log.info("Starting database migrations...");

	// Create migration connection (max 1 connection)
	const migrationConnection = postgres(config.database.url, { max: 1 });
	const db = drizzle(migrationConnection, { schema });

	try {
		// Run migrations
		await migrate(db, { migrationsFolder: "./migrations" });
		log.info("Migrations completed successfully");

		// Run seed files
		// log.info("Running seed data...");

		// Read and execute seed file
		// const seedFile = await Bun.file(
		//   "./migrations/seeds/001_roles_and_permissions.sql"
		// ).text();
		// await migrationConnection.unsafe(seedFile);

		// log.info("Seed data inserted successfully");

		// Close connection
		await migrationConnection.end();

		log.info("Migration process completed");
		process.exit(0);
	} catch (error) {
		log.error("Migration failed", error);
		await migrationConnection.end();
		process.exit(1);
	}
};

// Run migrations
runMigrations();
