import { log } from "@config/logger";
import { REDIS_TTL } from "@/utils/constants";
import type { RedisClient } from "./connection";
import { getRedisClient, RedisKeys } from "./connection";

/**
 * Cache service for Redis operations
 * Provides a centralized interface for caching operations
 */
export class CacheService {
	private redis: RedisClient;

	constructor() {
		this.redis = getRedisClient();
	}

	/**
	 * Get cached value
	 */
	async get<T>(key: string): Promise<T | null> {
		try {
			const cached = await this.redis.get(RedisKeys.cache(key));
			if (!cached) {
				return null;
			}
			return JSON.parse(cached) as T;
		} catch (error) {
			log.error("Cache get error", error, { key });
			return null;
		}
	}

	/**
	 * Set cached value with TTL
	 */
	async set(
		key: string,
		value: unknown,
		ttl: number = REDIS_TTL.CACHE_MEDIUM,
	): Promise<void> {
		try {
			const serialized = JSON.stringify(value);
			await this.redis.setex(RedisKeys.cache(key), ttl, serialized);
		} catch (error) {
			log.error("Cache set error", error, { key, ttl });
		}
	}

	/**
	 * Delete cached value
	 */
	async delete(key: string): Promise<void> {
		try {
			await this.redis.del(RedisKeys.cache(key));
		} catch (error) {
			log.error("Cache delete error", error, { key });
		}
	}

	/**
	 * Delete multiple keys by pattern
	 */
	async deletePattern(pattern: string): Promise<void> {
		try {
			const keys = await this.redis.keys(RedisKeys.cache(`${pattern}*`));
			if (keys.length > 0) {
				await this.redis.del(...keys);
			}
		} catch (error) {
			log.error("Cache delete pattern error", error, { pattern });
		}
	}

	/**
	 * Check if key exists
	 */
	async exists(key: string): Promise<boolean> {
		try {
			const result = await this.redis.exists(RedisKeys.cache(key));
			return result === 1;
		} catch (error) {
			log.error("Cache exists error", error, { key });
			return false;
		}
	}

	/**
	 * Get or set cached value (cache-aside pattern)
	 */
	async getOrSet<T>(
		key: string,
		factory: () => Promise<T>,
		ttl: number = REDIS_TTL.CACHE_MEDIUM,
	): Promise<T> {
		// Try to get from cache
		const cached = await this.get<T>(key);
		if (cached !== null) {
			return cached;
		}

		// Generate value if not in cache
		const value = await factory();

		// Store in cache (don't await to avoid blocking)
		this.set(key, value, ttl).catch((error) => {
			log.error("Cache set error in getOrSet", error, { key });
		});

		return value;
	}

	/**
	 * Increment counter
	 */
	async increment(key: string, amount: number = 1): Promise<number> {
		try {
			return await this.redis.incrby(RedisKeys.cache(key), amount);
		} catch (error) {
			log.error("Cache increment error", error, { key, amount });
			throw error;
		}
	}

	/**
	 * Set expiry on existing key
	 */
	async expire(key: string, ttl: number): Promise<boolean> {
		try {
			const result = await this.redis.expire(RedisKeys.cache(key), ttl);
			return result === 1;
		} catch (error) {
			log.error("Cache expire error", error, { key, ttl });
			return false;
		}
	}

	/**
	 * Get TTL of a key
	 */
	async ttl(key: string): Promise<number> {
		try {
			return await this.redis.ttl(RedisKeys.cache(key));
		} catch (error) {
			log.error("Cache TTL error", error, { key });
			return -1;
		}
	}

	/**
	 * Flush all cache keys (use with caution)
	 */
	async flushAll(): Promise<void> {
		try {
			const keys = await this.redis.keys(RedisKeys.cache("*"));
			if (keys.length > 0) {
				await this.redis.del(...keys);
			}
			log.info("Cache flushed", { keysDeleted: keys.length });
		} catch (error) {
			log.error("Cache flush error", error);
		}
	}

	/**
	 * Get multiple keys at once
	 */
	async mget<T>(keys: string[]): Promise<Array<T | null>> {
		try {
			const cacheKeys = keys.map((key) => RedisKeys.cache(key));
			const values = await this.redis.mget(...cacheKeys);
			return values.map((value) => (value ? (JSON.parse(value) as T) : null));
		} catch (error) {
			log.error("Cache mget error", error, { keys });
			return keys.map(() => null);
		}
	}

	/**
	 * Set multiple keys at once
	 */
	async mset(
		entries: Array<{ key: string; value: unknown; ttl?: number }>,
	): Promise<void> {
		try {
			const pipeline = this.redis.pipeline();

			for (const entry of entries) {
				const serialized = JSON.stringify(entry.value);
				const ttl = entry.ttl || REDIS_TTL.CACHE_MEDIUM;
				pipeline.setex(RedisKeys.cache(entry.key), ttl, serialized);
			}

			await pipeline.exec();
		} catch (error) {
			log.error("Cache mset error", error);
		}
	}
}

// Export singleton instance
export const cacheService = new CacheService();
