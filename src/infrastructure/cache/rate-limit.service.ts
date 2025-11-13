import { getRedisClient } from './connection';
import { log } from '@config/logger';
import { RATE_LIMIT } from '@/utils/constants';
import { RateLimitError } from '@/types/common';

/**
 * Rate Limiting Service
 * Implements token bucket algorithm for rate limiting
 */
export class RateLimitService {
  private redis = getRedisClient();

  /**
   * Check if request is allowed (Token Bucket Algorithm)
   * More efficient than simple counters, allows bursts
   */
  async checkRateLimit(
    identifier: string,
    maxRequests: number = RATE_LIMIT.MAX_REQUESTS,
    windowMs: number = RATE_LIMIT.WINDOW_MS
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
  }> {
    try {
      const key = `ratelimit:${identifier}`;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Use Redis sorted set for sliding window
      const pipeline = this.redis.pipeline();

      // Remove old entries outside the window
      pipeline.zremrangebyscore(key, '-inf', windowStart);

      // Count requests in current window
      pipeline.zcard(key);

      // Add current request
      pipeline.zadd(key, now, `${now}-${Math.random()}`);

      // Set expiry
      pipeline.expire(key, Math.ceil(windowMs / 1000));

      const results = await pipeline.exec();

      // Get count from pipeline results
      const count = (results?.[1]?.[1] as number) || 0;

      const allowed = count < maxRequests;
      const remaining = Math.max(0, maxRequests - count - 1);
      const resetAt = new Date(now + windowMs);

      if (!allowed) {
        log.warn('Rate limit exceeded', {
          identifier,
          count,
          maxRequests,
        });
      }

      return { allowed, remaining, resetAt };
    } catch (error) {
      log.error('Rate limit check failed', error, { identifier });
      // Fail open - allow request if rate limiting fails
      return {
        allowed: true,
        remaining: maxRequests,
        resetAt: new Date(Date.now() + windowMs),
      };
    }
  }

  /**
   * Check rate limit and throw error if exceeded
   */
  async enforceRateLimit(
    identifier: string,
    maxRequests?: number,
    windowMs?: number
  ): Promise<void> {
    const result = await this.checkRateLimit(identifier, maxRequests, windowMs);

    if (!result.allowed) {
      throw new RateLimitError(
        `Rate limit exceeded. Try again at ${result.resetAt.toISOString()}`
      );
    }
  }

  /**
   * Reset rate limit for identifier
   */
  async resetRateLimit(identifier: string): Promise<void> {
    try {
      const key = `ratelimit:${identifier}`;
      await this.redis.del(key);
      log.debug('Rate limit reset', { identifier });
    } catch (error) {
      log.error('Failed to reset rate limit', error, { identifier });
    }
  }

  /**
   * Get remaining requests
   */
  async getRemainingRequests(
    identifier: string,
    maxRequests: number = RATE_LIMIT.MAX_REQUESTS,
    windowMs: number = RATE_LIMIT.WINDOW_MS
  ): Promise<number> {
    try {
      const key = `ratelimit:${identifier}`;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Remove old entries and count
      await this.redis.zremrangebyscore(key, '-inf', windowStart);
      const count = await this.redis.zcard(key);

      return Math.max(0, maxRequests - count);
    } catch (error) {
      log.error('Failed to get remaining requests', error, { identifier });
      return maxRequests;
    }
  }
}

// Export singleton instance
export const rateLimitService = new RateLimitService();