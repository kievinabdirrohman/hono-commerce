import { config } from "@config/env";
import { log } from "@config/logger";
import { serve } from "@hono/node-server";
import {
	closeRedisConnection,
	testRedisConnection,
} from "@infrastructure/cache/connection";
import {
	closeDatabaseConnection,
	testDatabaseConnection,
} from "@infrastructure/database/connection";
import { app } from "./app";

// Test connections before starting server
const initializeConnections = async () => {
	log.info("Initializing connections...");

	// Test database connection
	const dbConnected = await testDatabaseConnection();
	if (!dbConnected) {
		throw new Error("Failed to connect to database");
	}

	// Test Redis connection
	const redisConnected = await testRedisConnection();
	if (!redisConnected) {
		throw new Error("Failed to connect to Redis");
	}

	log.info("All connections initialized successfully");
};

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
	log.info(`Received ${signal}, starting graceful shutdown...`);

	try {
		// Close database connection
		await closeDatabaseConnection();

		// Close Redis connection
		await closeRedisConnection();

		log.info("Graceful shutdown completed");
		process.exit(0);
	} catch (error) {
		log.error("Error during graceful shutdown", error);
		process.exit(1);
	}
};

// Register shutdown handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (error) => {
	log.fatal("Uncaught exception", error as Error);
	process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
	log.fatal(
		"Unhandled promise rejection",
		reason instanceof Error ? reason : new Error(String(reason)),
		{
			promise: String(promise),
			reason: reason,
		},
	);
	process.exit(1);
});

// Start server
const startServer = async () => {
	try {
		// Initialize connections
		await initializeConnections();

		// Start HTTP server
		serve({
			fetch: app.fetch,
			port: config.app.port,
			hostname: config.app.host,
		});

		log.info("Server started", {
			host: config.app.host,
			port: config.app.port,
			environment: config.app.env,
			url: `http://${config.app.host}:${config.app.port}`,
		});

		// Log available routes in development
		if (config.app.isDevelopment) {
			log.debug("Available routes:", {
				health: `http://${config.app.host}:${config.app.port}/health`,
				root: `http://${config.app.host}:${config.app.port}/`,
			});
		}
	} catch (error) {
		log.fatal("Failed to start server", error as Error);
		process.exit(1);
	}
};

// Start the application
startServer();
