import { config } from "@config/env";
import { log } from "@config/logger";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// PostgreSQL connection configuration
const _connectionConfig = {
	host: new URL(config.database.url).hostname,
	port: parseInt(new URL(config.database.url).port || "5432", 10),
	database: new URL(config.database.url).pathname.slice(1),
	username: new URL(config.database.url).username,
	password: new URL(config.database.url).password,
	max: config.database.poolMax,
	idle_timeout: config.database.idleTimeout / 1000, // Convert to seconds
	connect_timeout: config.database.connectionTimeout / 1000, // Convert to seconds
	ssl: config.app.isProduction ? "require" : false,
	onnotice: () => {}, // Suppress notices in production
	prepare: false, // Disable prepared statements for connection pooling
};

// Create PostgreSQL connection
let sql: postgres.Sql | null = null;

export const createDatabaseConnection = () => {
	try {
		sql = postgres(config.database.url, {
			max: config.database.poolMax,
			idle_timeout: config.database.idleTimeout / 1000,
			connect_timeout: config.database.connectionTimeout / 1000,
			ssl: config.app.isProduction ? "require" : false,
			onnotice: () => {},
			prepare: false,
			transform: {
				undefined: null, // Transform undefined to null
			},
			debug: config.app.isDevelopment,
		});

		log.info("Database connection pool created", {
			poolMax: config.database.poolMax,
			poolMin: config.database.poolMin,
		});

		return sql;
	} catch (error) {
		log.error("Failed to create database connection", error);
		throw error;
	}
};

// Get database connection (singleton)
export const getDatabase = () => {
	if (!sql) {
		sql = createDatabaseConnection();
	}
	return sql;
};

// Create Drizzle ORM instance
export const db = drizzle(getDatabase(), {
	logger: config.app.isDevelopment
		? {
				logQuery: (query, params) => {
					log.debug("Database query", { query, params });
				},
			}
		: false,
});

// Test database connection
export const testDatabaseConnection = async () => {
	try {
		const sql = getDatabase();
		await sql`SELECT 1 as connected`;
		log.info("Database connection test successful");
		return true;
	} catch (error) {
		log.error("Database connection test failed", error);
		return false;
	}
};

// Close database connection
export const closeDatabaseConnection = async () => {
	try {
		if (sql) {
			await sql.end({ timeout: 5 });
			sql = null;
			log.info("Database connection closed");
		}
	} catch (error) {
		log.error("Error closing database connection", error);
		throw error;
	}
};

// Export types
export type Database = typeof db;
