import { Context, Next } from 'hono';
import { rateLimitService } from '@infrastructure/cache/rate-limit.service';
import { log } from '@config/logger';
import { RATE_LIMIT } from '@/utils/constants';
import { RateLimitError } from '@/types/common';

/**
 * Rate Limiting Middleware
 * Implements sliding window rate limiting with different tiers
 */

/**
 * General API rate limiter (per IP)
 */
export const rateLimitByIP = (
  maxRequests: number = RATE_LIMIT.MAX_REQUESTS,
  windowMs: number = RATE_LIMIT.WINDOW_MS
) => {
  return async (c: Context, next: Next) => {
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
    const identifier = `ip:${ip}`;

    try {
      const result = await rateLimitService.checkRateLimit(identifier, maxRequests, windowMs);

      // Add rate limit headers
      c.header('X-RateLimit-Limit', maxRequests.toString());
      c.header('X-RateLimit-Remaining', result.remaining.toString());
      c.header('X-RateLimit-Reset', result.resetAt.toISOString());

      if (!result.allowed) {
        c.header('Retry-After', Math.ceil((result.resetAt.getTime() - Date.now()) / 1000).toString());
        throw new RateLimitError('Too many requests, please try again later');
      }

      await next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }
      // Fail open - allow request if rate limiting service fails
      log.error('Rate limiting middleware error', error);
      await next();
    }
  };
};

/**
 * User-based rate limiter (requires authentication)
 */
export const rateLimitByUser = (
  maxRequests: number = RATE_LIMIT.MAX_REQUESTS,
  windowMs: number = RATE_LIMIT.WINDOW_MS
) => {
  return async (c: Context, next: Next) => {
    const userId = c.get('userId') as string | undefined;

    if (!userId) {
      // Fall back to IP-based if not authenticated
      return rateLimitByIP(maxRequests, windowMs)(c, next);
    }

    const identifier = `user:${userId}`;

    try {
      const result = await rateLimitService.checkRateLimit(identifier, maxRequests, windowMs);

      c.header('X-RateLimit-Limit', maxRequests.toString());
      c.header('X-RateLimit-Remaining', result.remaining.toString());
      c.header('X-RateLimit-Reset', result.resetAt.toISOString());

      if (!result.allowed) {
        c.header('Retry-After', Math.ceil((result.resetAt.getTime() - Date.now()) / 1000).toString());
        throw new RateLimitError('Too many requests, please try again later');
      }

      await next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }
      log.error('Rate limiting middleware error', error);
      await next();
    }
  };
};

/**
 * Strict rate limiter for sensitive operations (auth, logout, etc.)
 */
export const strictRateLimit = () => {
  return rateLimitByIP(RATE_LIMIT.MAX_AUTH_REQUESTS, RATE_LIMIT.WINDOW_MS);
};

/**
 * Upload rate limiter for file uploads
 */
export const uploadRateLimit = () => {
  return rateLimitByUser(RATE_LIMIT.MAX_UPLOAD_REQUESTS, RATE_LIMIT.WINDOW_MS);
};

/**
 * Bulk operation rate limiter
 */
export const bulkRateLimit = () => {
  return rateLimitByUser(RATE_LIMIT.MAX_BULK_REQUESTS, RATE_LIMIT.WINDOW_MS);
};