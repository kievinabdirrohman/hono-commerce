import { Hono } from 'hono';
import { z } from 'zod';
import { authService } from '@application/services/auth.service';
import { authenticate } from '@middlewares/auth.middleware';
import { strictRateLimit, rateLimitByUser } from '@middlewares/rate-limit.middleware';
import { asyncHandler } from '@middlewares/error-handler';
import { successResponse, errorResponse } from '@/utils/response';
import { deviceInfoSchema } from '@/utils/validations';
import { HTTP_STATUS } from '@/utils/constants';
import { log } from '@config/logger';

// Extend Hono context for zod validation
import type { Context } from 'hono';

declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
  }
}

// Manual validation middleware
const validateJson = <T extends z.ZodType>(schema: T) => {
  return async (c: Context, next: () => Promise<void>) => {
    try {
      const body = await c.req.json();
      const result = schema.parse(body);
      (c as any).validatedData = result;
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return errorResponse(
          c,
          'VALIDATION_ERROR',
          'Invalid request data',
          HTTP_STATUS.BAD_REQUEST,
          { issues: error.issues }
        );
      }
      throw error;
    }
  };
};

const authRoutes = new Hono();

/**
 * GET /auth/google
 * Generate Google OAuth URL
 */
authRoutes.get('/google', strictRateLimit(), (c) => {
  const authUrl = authService.generateAuthUrl();
  return successResponse(c, { authUrl });
});

/**
 * GET /auth/google/callback
 * Handle Google OAuth callback (for Google redirects)
 */
authRoutes.get(
  '/google/callback',
  strictRateLimit(),
  asyncHandler(async (c) => {
    const url = new URL(c.req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Handle Google OAuth errors
    if (error) {
      log.warn('Google OAuth error', { error, state });
      return errorResponse(
        c,
        'OAUTH_ERROR',
        `Google OAuth failed: ${error}`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (!code) {
      return errorResponse(
        c,
        'INVALID_REQUEST',
        'Missing authorization code',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Get IP from headers
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip');
    const userAgent = c.req.header('user-agent');

    const deviceInfoData = {
      ip,
      userAgent,
      state,
    };

    const result = await authService.handleOAuthCallback(code, deviceInfoData);

    log.info('User authenticated via OAuth (GET callback)', {
      userId: result.user.id,
      email: result.user.email,
      isNewUser: result.user.isNewUser,
    });

    return successResponse(c, result);
  })
);

/**
 * POST /auth/google/callback
 * Handle Google OAuth callback (for API clients with JSON body)
 */
const callbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  deviceInfo: deviceInfoSchema.optional(),
});

authRoutes.post(
  '/google/callback',
  strictRateLimit(),
  validateJson(callbackSchema),
  asyncHandler(async (c) => {
    const data = (c as any).validatedData as z.infer<typeof callbackSchema>;
    const { code, deviceInfo } = data;

    // Get IP from headers
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip');
    const userAgent = c.req.header('user-agent');

    const deviceInfoData = {
      ...(deviceInfo || {}),
      ip,
      userAgent,
    };

    const result = await authService.handleOAuthCallback(code, deviceInfoData);

    log.info('User authenticated via OAuth (POST callback)', {
      userId: result.user.id,
      email: result.user.email,
      isNewUser: result.user.isNewUser,
    });

    return successResponse(c, result);
  })
);

/**
 * POST /auth/refresh
 * Refresh access token
 */
const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

authRoutes.post(
  '/refresh',
  strictRateLimit(),
  validateJson(refreshSchema),
  asyncHandler(async (c) => {
    const data = (c as any).validatedData as z.infer<typeof refreshSchema>;
    const { refreshToken } = data;

    const tokens = await authService.refreshToken(refreshToken);

    log.info('Tokens refreshed');

    return successResponse(c, tokens);
  })
);

/**
 * POST /auth/logout
 * Logout from current device
 */
authRoutes.post(
  '/logout',
  authenticate,
  rateLimitByUser(),
  asyncHandler(async (c) => {
    const authHeader = c.req.header('Authorization');
    const accessToken = authHeader?.substring(7); // Remove 'Bearer '

    if (!accessToken) {
      return errorResponse(
        c,
        'INVALID_TOKEN',
        'No access token provided',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    await authService.logout(accessToken);

    log.info('User logged out', {
      userId: c.get('userId'),
      sessionId: c.get('sessionId'),
    });

    return successResponse(c, {
      message: 'Logged out successfully',
    });
  })
);

/**
 * POST /auth/logout-all
 * Logout from all devices
 */
authRoutes.post(
  '/logout-all',
  authenticate,
  strictRateLimit(), // Stricter limit for logout-all
  asyncHandler(async (c) => {
    const userId = c.get('userId') as string;

    // Get device info for logging
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip');
    const userAgent = c.req.header('user-agent');

    const result = await authService.logoutAll(userId, {
      ip,
      userAgent,
    });

    log.info('User logged out from all devices', {
      userId,
      sessionsDeleted: result.sessionsDeleted,
    });

    return successResponse(c, {
      message: 'Logged out from all devices successfully',
      sessionsDeleted: result.sessionsDeleted,
    });
  })
);

/**
 * GET /auth/me
 * Get current user information
 */
authRoutes.get(
  '/me',
  authenticate,
  rateLimitByUser(),
  asyncHandler(async (c) => {
    const userId = c.get('userId') as string;

    const user = await authService.getCurrentUser(userId);

    if (!user) {
      return errorResponse(
        c,
        'USER_NOT_FOUND',
        'User not found',
        HTTP_STATUS.NOT_FOUND
      );
    }

    return successResponse(c, { user });
  })
);

/**
 * GET /auth/sessions
 * Get all active sessions for current user
 */
authRoutes.get(
  '/sessions',
  authenticate,
  rateLimitByUser(),
  asyncHandler(async (c) => {
    const userId = c.get('userId') as string;

    const sessions = await authService.getUserSessions(userId);

    return successResponse(c, { sessions });
  })
);

export default authRoutes;