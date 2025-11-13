import { Context, Next } from 'hono';
import { jwtService } from '@infrastructure/auth/jwt.service';
import { sessionService } from '@infrastructure/auth/session.service';
import { log } from '@config/logger';
import { AuthenticationError } from '@/types/common';

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user info to context
 */
export const authenticate = async (c: Context, next: Next) => {
  try {
    // Get token from Authorization header
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No authorization token provided');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const payload = await jwtService.verifyAccessToken(token);

    // Get session from database
    const session = await sessionService.getSession(payload.sessionId);
    if (!session) {
      throw new AuthenticationError('Session not found');
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      await sessionService.deleteSession(session.id);
      throw new AuthenticationError('Session expired');
    }

    // Verify token matches session
    if (session.accessToken !== token) {
      throw new AuthenticationError('Invalid token');
    }

    // Attach user info to context
    c.set('userId', payload.userId);
    c.set('sessionId', payload.sessionId);
    c.set('userRole', payload.role);

    log.debug('User authenticated', {
      userId: payload.userId,
      sessionId: payload.sessionId,
      role: payload.role,
    });

    await next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      log.debug('Authentication failed', { error: error.message });
    } else {
      log.error('Authentication error', error);
    }
    throw error;
  }
};

/**
 * Optional Authentication Middleware
 * Tries to authenticate but doesn't fail if no token provided
 */
export const optionalAuth = async (c: Context, next: Next) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      await next();
      return;
    }

    const token = authHeader.substring(7);
    const payload = await jwtService.verifyAccessToken(token);

    const session = await sessionService.getSession(payload.sessionId);
    if (session && session.expiresAt >= new Date()) {
      c.set('userId', payload.userId);
      c.set('sessionId', payload.sessionId);
      c.set('userRole', payload.role);
    }

    await next();
  } catch (error) {
    // Ignore errors in optional auth
    await next();
  }
};