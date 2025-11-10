import { config } from "@config/env";
import { log } from "@config/logger";
import Redis, { type Redis as RedisClient, type RedisOptions } from "ioredis";

// Redis connection configuration
const redisConfig: RedisOptions = {
	host: config.redis.host,
	port: config.redis.port,
	password: config.redis.password || undefined,
	db: config.redis.db,
	keyPrefix: config.redis.keyPrefix,
	retryStrategy: (times: number) => {
		const delay = Math.min(times * 50, 2000);
		log.warn("Redis connection retry", { attempt: times, delay });
		return delay;
	},
	maxRetriesPerRequest: 3,
	enableReadyCheck: true,
	lazyConnect: false,
	showFriendlyErrorStack: config.app.isDevelopment,
};

// Create Redis client instance
let redisClient: RedisClient | null = null;

export const createRedisConnection = () => {
	try {
		redisClient = new Redis(redisConfig);

		// Event handlers
		redisClient.on("connect", () => {
			log.info("Redis connecting...");
		});

		redisClient.on("ready", () => {
			log.info("Redis connection established", {
				host: config.redis.host,
				port: config.redis.port,
				db: config.redis.db,
			});
		});

		redisClient.on("error", (error) => {
			log.error("Redis connection error", error);
		});

		redisClient.on("close", () => {
			log.warn("Redis connection closed");
		});

		redisClient.on("reconnecting", (delay: number) => {
			log.info("Redis reconnecting", { delay });
		});

		return redisClient;
	} catch (error) {
		log.error("Failed to create Redis connection", error);
		throw error;
	}
};

// Get Redis client (singleton)
export const getRedisClient = (): RedisClient => {
	if (!redisClient) {
		redisClient = createRedisConnection();
	}
	return redisClient;
};

// Test Redis connection
export const testRedisConnection = async (): Promise<boolean> => {
	try {
		const client = getRedisClient();
		await client.ping();
		log.info("Redis connection test successful");
		return true;
	} catch (error) {
		log.error("Redis connection test failed", error);
		return false;
	}
};

// Close Redis connection
export const closeRedisConnection = async (): Promise<void> => {
	try {
		if (redisClient) {
			await redisClient.quit();
			redisClient = null;
			log.info("Redis connection closed");
		}
	} catch (error) {
		log.error("Error closing Redis connection", error);
		throw error;
	}
};

// Redis key helpers
export const RedisKeys = {
	session: (sessionId: string) => `session:${sessionId}`,
	userSessions: (userId: string) => `user:${userId}:sessions`,
	cache: (key: string) => `cache:${key}`,
	rateLimit: (identifier: string) => `ratelimit:${identifier}`,
	queue: (name: string) => `queue:${name}`,
} as const;

// Export Redis client type
export type { RedisClient };
