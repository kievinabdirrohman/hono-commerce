import { Hono } from 'hono';
import { z } from 'zod';
import { storeService } from '@application/services/store.service';
import { authenticate } from '@middlewares/auth.middleware';
import { requireOwner, requirePermission } from '@middlewares/rbac.middleware';
import { rateLimitByUser, rateLimitByIP } from '@middlewares/rate-limit.middleware';
import { asyncHandler } from '@middlewares/error-handler';
import { successResponse, createdResponse, errorResponse } from '@utils/response';
import { HTTP_STATUS, ENTITY_TYPES, ACTION_TYPES } from '@utils/constants';
import {
  enhancedCreateStoreSchema,
  enhancedUpdateStoreSchema,
  STORE_RATE_LIMITS,
  STORE_SECURITY_HEADERS,
  StoreSanitizer,
  getStoreAuditSeverity,
} from '@utils/store-security';
import { log } from '@config/logger';
import type { Context } from 'hono';

// Manual validation middleware with enhanced error reporting
const validateJson = <T extends z.ZodType>(schema: T) => {
  return async (c: Context, next: () => Promise<void>) => {
    try {
      const body = await c.req.json();
      const result = schema.parse(body);
      (c as any).validatedData = result;
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Enhanced error formatting for better client experience
        const formattedErrors = error.issues.reduce((acc, issue) => {
          const path = issue.path.join('.');
          if (!acc[path]) acc[path] = [];
          acc[path].push(issue.message);
          return acc;
        }, {} as Record<string, string[]>);

        log.warn('Validation failed', { 
          errors: formattedErrors,
          requestId: c.get('requestId'),
        });

        return errorResponse(
          c,
          'VALIDATION_ERROR',
          'Invalid request data',
          HTTP_STATUS.BAD_REQUEST,
          { fields: formattedErrors }
        );
      }
      throw error;
    }
  };
};

// Middleware to add security headers
const addSecurityHeaders = async (c: Context, next: () => Promise<void>) => {
  await next();
  
  // Add security headers to all store responses
  Object.entries(STORE_SECURITY_HEADERS).forEach(([key, value]) => {
    c.header(key, value);
  });
};

const storeRoutes = new Hono();

// Apply security headers to all routes
storeRoutes.use('*', addSecurityHeaders);

/**
 * POST /stores
 * Create a new store (owner only, once per owner)
 * 
 * SECURITY ENHANCEMENTS:
 * - Strict rate limiting (2 attempts per hour)
 * - Input sanitization
 * - Audit logging with CRITICAL severity
 */
storeRoutes.post(
  '/',
  authenticate,
  requireOwner,
  // SECURITY: Very strict rate limit for store creation
  async (c, next) => {
    const userId = c.get('userId') as string;
    const identifier = `store-create:${userId}`;
    
    // Custom rate limit for store creation
    const { rateLimitService } = await import('@infrastructure/cache/rate-limit.service');
    const result = await rateLimitService.checkRateLimit(
      identifier,
      STORE_RATE_LIMITS.CREATE.MAX_REQUESTS,
      STORE_RATE_LIMITS.CREATE.WINDOW_MS
    );

    c.header('X-RateLimit-Limit', STORE_RATE_LIMITS.CREATE.MAX_REQUESTS.toString());
    c.header('X-RateLimit-Remaining', result.remaining.toString());
    c.header('X-RateLimit-Reset', result.resetAt.toISOString());

    if (!result.allowed) {
      c.header('Retry-After', Math.ceil((result.resetAt.getTime() - Date.now()) / 1000).toString());
      return errorResponse(
        c,
        'RATE_LIMIT_EXCEEDED',
        'Too many store creation attempts. Please try again later.',
        HTTP_STATUS.TOO_MANY_REQUESTS
      );
    }

    await next();
  },
  validateJson(enhancedCreateStoreSchema),
  asyncHandler(async (c) => {
    const userId = c.get('userId') as string;
    const data = (c as any).validatedData as z.infer<typeof enhancedCreateStoreSchema>;

    // SECURITY: Additional sanitization layer
    const sanitizedData = {
      name: StoreSanitizer.sanitizeName(data.name),
      description: data.description,
    };

    // Get device info for audit logging
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip');
    const userAgent = c.req.header('user-agent');

    const store = await storeService.createStore(
      userId,
      sanitizedData,
      { ip, userAgent }
    );

    // AUDIT: Log with CRITICAL severity
    log.info('Store created via API', { 
      storeId: store.id, 
      ownerId: userId,
      severity: getStoreAuditSeverity('create'),
      ip,
    });

    return createdResponse(c, {
      store: store.toObject(),
      message: 'Store created successfully',
    });
  })
);

/**
 * GET /stores/me
 * Get current user's store
 * 
 * OPTIMIZATION: Uses cache-first strategy
 */
storeRoutes.get(
  '/me',
  authenticate,
  rateLimitByUser(STORE_RATE_LIMITS.READ.MAX_REQUESTS, STORE_RATE_LIMITS.READ.WINDOW_MS),
  asyncHandler(async (c) => {
    const userId = c.get('userId') as string;

    const store = await storeService.getStoreByOwnerId(userId);

    if (!store) {
      return errorResponse(
        c,
        'STORE_NOT_FOUND',
        'No store found for this user. Please create a store first.',
        HTTP_STATUS.NOT_FOUND
      );
    }

    // OPTIMIZATION: Add cache headers for CDN/browser caching
    c.header('Cache-Control', 'private, max-age=300'); // 5 minutes

    return successResponse(c, {
      store: store.toObject(),
    });
  })
);

/**
 * GET /stores/:id
 * Get store by ID (authenticated users only)
 * 
 * SECURITY: Enforces access control
 * OPTIMIZATION: Cache-first strategy
 */
storeRoutes.get(
  '/:id',
  authenticate,
  rateLimitByUser(STORE_RATE_LIMITS.READ.MAX_REQUESTS, STORE_RATE_LIMITS.READ.WINDOW_MS),
  asyncHandler(async (c) => {
    const storeId = c.req.param('id');
    const userId = c.get('userId') as string;

    // SECURITY: Validate UUID format to prevent SQL injection
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(storeId)) {
      return errorResponse(
        c,
        'INVALID_INPUT',
        'Invalid store ID format',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const store = await storeService.getStoreById(storeId);

    if (!store) {
      return errorResponse(
        c,
        'STORE_NOT_FOUND',
        'Store not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    // SECURITY: Check access (owner or staff with permission)
    const canAccess = await storeService.canAccessStore(userId, storeId);
    if (!canAccess) {
      log.warn('Unauthorized store access attempt', { userId, storeId });
      return errorResponse(
        c,
        'AUTHORIZATION_ERROR',
        'You do not have access to this store',
        HTTP_STATUS.FORBIDDEN
      );
    }

    // OPTIMIZATION: Add cache headers
    c.header('Cache-Control', 'private, max-age=300'); // 5 minutes

    return successResponse(c, {
      store: store.toObject(),
    });
  })
);

/**
 * PATCH /stores/:id
 * Update store information (owner and staff with update permission)
 * 
 * SECURITY ENHANCEMENTS:
 * - Input sanitization
 * - URL validation
 * - Rate limiting
 * - Audit logging
 */
storeRoutes.patch(
  '/:id',
  authenticate,
  requirePermission(ENTITY_TYPES.STORE, ACTION_TYPES.UPDATE),
  // SECURITY: Rate limit for updates
  async (c, next) => {
    const userId = c.get('userId') as string;
    const identifier = `store-update:${userId}`;
    
    const { rateLimitService } = await import('@infrastructure/cache/rate-limit.service');
    const result = await rateLimitService.checkRateLimit(
      identifier,
      STORE_RATE_LIMITS.UPDATE.MAX_REQUESTS,
      STORE_RATE_LIMITS.UPDATE.WINDOW_MS
    );

    c.header('X-RateLimit-Limit', STORE_RATE_LIMITS.UPDATE.MAX_REQUESTS.toString());
    c.header('X-RateLimit-Remaining', result.remaining.toString());
    c.header('X-RateLimit-Reset', result.resetAt.toISOString());

    if (!result.allowed) {
      return errorResponse(
        c,
        'RATE_LIMIT_EXCEEDED',
        'Too many update requests. Please try again later.',
        HTTP_STATUS.TOO_MANY_REQUESTS
      );
    }

    await next();
  },
  validateJson(enhancedUpdateStoreSchema),
  asyncHandler(async (c) => {
    const storeId = c.req.param('id');
    const userId = c.get('userId') as string;
    const userRole = c.get('userRole') as string;
    const data = (c as any).validatedData as z.infer<typeof enhancedUpdateStoreSchema>;

    // SECURITY: Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(storeId)) {
      return errorResponse(
        c,
        'INVALID_INPUT',
        'Invalid store ID format',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // SECURITY: Additional sanitization for URLs
    const sanitizedData = {
      ...data,
      ...StoreSanitizer.sanitizeMarketplaceLinks({
        tokopediaUrl: data.tokopediaUrl,
        tiktokShopUrl: data.tiktokShopUrl,
        shopeeUrl: data.shopeeUrl,
        tocoUrl: data.tocoUrl,
      }),
    };

    // Remove undefined values
    Object.keys(sanitizedData).forEach(key => {
      if (sanitizedData[key as keyof typeof sanitizedData] === undefined) {
        delete sanitizedData[key as keyof typeof sanitizedData];
      }
    });

    // Get device info for audit logging
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip');
    const userAgent = c.req.header('user-agent');

    const updated = await storeService.updateStore(
      storeId,
      userId,
      userRole,
      sanitizedData,
      { ip, userAgent }
    );

    // AUDIT: Log with WARNING severity
    log.info('Store updated via API', { 
      storeId: updated.id, 
      userId,
      severity: getStoreAuditSeverity('update'),
      fieldsUpdated: Object.keys(sanitizedData).length,
    });

    return successResponse(c, {
      store: updated.toObject(),
      message: 'Store updated successfully',
    });
  })
);

/**
 * GET /stores/public/:id
 * Get store public information (no authentication required)
 * 
 * SECURITY ENHANCEMENTS:
 * - Stricter rate limiting (public endpoint)
 * - Returns only safe, public data
 * - Adds public cache headers
 */
storeRoutes.get(
  '/public/:id',
  rateLimitByIP(50, 15 * 60 * 1000), // 50 requests per 15 minutes per IP
  asyncHandler(async (c) => {
    const storeId = c.req.param('id');

    // SECURITY: Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(storeId)) {
      return errorResponse(
        c,
        'INVALID_INPUT',
        'Invalid store ID format',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const store = await storeService.getStoreById(storeId);

    if (!store) {
      return errorResponse(
        c,
        'STORE_NOT_FOUND',
        'Store not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    // OPTIMIZATION: Aggressive caching for public endpoint
    // Public data changes rarely, so cache longer
    c.header('Cache-Control', 'public, max-age=600, s-maxage=3600'); // 10min browser, 1hr CDN
    c.header('Vary', 'Accept-Encoding');

    // SECURITY: Return only public data (no sensitive information)
    return successResponse(c, {
      store: store.toPublicObject(),
    });
  })
);

/**
 * GET /stores/batch
 * Get multiple stores by IDs (authenticated, for efficiency)
 * 
 * OPTIMIZATION: Batch fetching to reduce database round-trips
 * SECURITY: Requires authentication
 */
storeRoutes.post(
  '/batch',
  authenticate,
  rateLimitByUser(STORE_RATE_LIMITS.READ.MAX_REQUESTS, STORE_RATE_LIMITS.READ.WINDOW_MS),
  asyncHandler(async (c) => {
    const body = await c.req.json();
    const storeIdsSchema = z.object({
      storeIds: z.array(z.string().uuid()).min(1).max(50), // Max 50 stores per request
    });

    const { storeIds } = storeIdsSchema.parse(body);
    const userId = c.get('userId') as string;

    // OPTIMIZATION: Batch fetch all stores
    const stores = await storeService.getStoresByIds(storeIds);

    // SECURITY: Filter to only stores user has access to
    const accessibleStores: Array<{ [key: string]: any }> = [];
    
    for (const [storeId, store] of stores.entries()) {
      const canAccess = await storeService.canAccessStore(userId, storeId);
      if (canAccess) {
        accessibleStores.push(store.toObject());
      }
    }

    // OPTIMIZATION: Add cache headers
    c.header('Cache-Control', 'private, max-age=300');

    return successResponse(c, {
      stores: accessibleStores,
      total: accessibleStores.length,
      requested: storeIds.length,
    });
  })
);

export default storeRoutes;