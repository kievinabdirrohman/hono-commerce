import { db } from '@infrastructure/database/connection';
import { users, stores } from '@infrastructure/database/schema';
import { eq } from 'drizzle-orm';
import { googleOAuthService } from '@infrastructure/auth/google-oauth.service';
import { jwtService } from '@infrastructure/auth/jwt.service';
import { sessionService } from '@infrastructure/auth/session.service';
import { activityLogService } from './activity-log.service';
import { log } from '@config/logger';
import { USER_ROLES, ACTIVITY_ACTIONS } from '@/utils/constants';
// import { extractIP } from '@/utils/security';
import { AuthenticationError, ConflictError } from '@/types/common';
import type { DeviceInfo } from '@/types/common';

/**
 * Authentication Service
 * Handles user authentication, registration, and session management
 */
export class AuthService {
  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(): string {
    return googleOAuthService.generateAuthUrl();
  }

  /**
   * Handle OAuth callback and create/login user
   */
  async handleOAuthCallback(
    code: string,
    deviceInfo?: DeviceInfo
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      isNewUser: boolean;
    };
  }> {
    try {
      // Exchange code for Google tokens
      const googleTokens = await googleOAuthService.getTokensFromCode(code);

      // Get user info from Google
      const googleUser = await googleOAuthService.getUserInfo(
        googleTokens.accessToken
      );

      // Check if user exists
      let user: typeof users.$inferSelect | undefined = await db
        .select()
        .from(users)
        .where(eq(users.googleId, googleUser.id))
        .limit(1)
        .then(([result]) => result);

      let isNewUser = false;

      // Create user if doesn't exist
      if (!user) {
        // First user becomes owner, rest are staff
        const existingUsers = await db.select().from(users).limit(1);
        const role = existingUsers.length === 0 ? USER_ROLES.OWNER : USER_ROLES.STAFF;

        // Use transaction for user + store creation
        user = await db.transaction(async (tx) => {
          const [newUserResult] = await tx
            .insert(users)
            .values({
              email: googleUser.email,
              name: googleUser.name,
              googleId: googleUser.id,
              avatarUrl: googleUser.picture,
              role,
            })
            .returning();

          isNewUser = true;

          // Create store for owner
          if (role === USER_ROLES.OWNER) {
            await tx.insert(stores).values({
              ownerId: newUserResult!.id,
              name: `${newUserResult!.name}'s Store`,
              description: 'My online store',
            });

            log.info('Store created for new owner', { userId: newUserResult!.id });
          }

          return newUserResult!;
        });

        // Log registration activity
        await activityLogService.logActivity({
          userId: user.id,
          action: ACTIVITY_ACTIONS.LOGIN,
          entityType: 'user',
          entityId: user.id,
          ipAddress: deviceInfo?.ip,
          userAgent: deviceInfo?.userAgent,
          deviceInfo,
        });

        log.info('New user registered', {
          userId: user.id,
          email: user.email,
          role,
        });
      } else {
        // Update avatar if changed
        if (user.avatarUrl !== googleUser.picture) {
          await db
            .update(users)
            .set({ avatarUrl: googleUser.picture })
            .where(eq(users.id, user.id));
        }

        // Log login activity
        await activityLogService.logActivity({
          userId: user.id,
          action: ACTIVITY_ACTIONS.LOGIN,
          entityType: 'user',
          entityId: user.id,
          ipAddress: deviceInfo?.ip,
          userAgent: deviceInfo?.userAgent,
          deviceInfo,
        });

        log.info('User logged in', {
          userId: user.id,
          email: user.email,
        });
      }

      // Create session
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const session = await sessionService.createSession({
        userId: user.id,
        accessToken: googleTokens.accessToken,
        refreshToken: googleTokens.refreshToken,
        deviceInfo,
        expiresAt,
      });

      // Generate JWT tokens
      const accessToken = await jwtService.generateAccessToken({
        userId: user.id,
        sessionId: session.id,
        role: user.role,
      });

      const refreshToken = await jwtService.generateRefreshToken({
        userId: user.id,
        sessionId: session.id,
      });

      // Update session with JWT tokens
      await sessionService.updateSessionTokens(
        session.id,
        accessToken,
        refreshToken,
        expiresAt
      );

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isNewUser,
        },
      };
    } catch (error) {
      log.error('OAuth callback failed', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      // Verify refresh token
      const payload = await jwtService.verifyRefreshToken(refreshToken);

      // Get session
      const session = await sessionService.getSession(payload.sessionId);
      if (!session) {
        throw new AuthenticationError('Session not found');
      }

      // Check if session is expired
      if (session.expiresAt < new Date()) {
        await sessionService.deleteSession(session.id);
        throw new AuthenticationError('Session expired');
      }

      // Get user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      if (!user) {
        throw new AuthenticationError('User not found');
      }

      // Generate new tokens
      const newAccessToken = await jwtService.generateAccessToken({
        userId: user.id,
        sessionId: session.id,
        role: user.role,
      });

      const newRefreshToken = await jwtService.generateRefreshToken({
        userId: user.id,
        sessionId: session.id,
      });

      // Update session
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await sessionService.updateSessionTokens(
        session.id,
        newAccessToken,
        newRefreshToken,
        expiresAt
      );

      log.info('Tokens refreshed', {
        userId: user.id,
        sessionId: session.id,
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      log.error('Token refresh failed', error);
      throw error;
    }
  }

  /**
   * Logout (single device)
   */
  async logout(accessToken: string, deviceInfo?: DeviceInfo): Promise<void> {
    try {
      // Get session by access token
      const session = await sessionService.getSessionByAccessToken(accessToken);
      if (!session) {
        throw new AuthenticationError('Session not found');
      }

      // Get full session for Google token revocation
      const fullSession = await sessionService.getSession(session.id);
      if (fullSession) {
        // Revoke Google tokens
        await googleOAuthService.revokeToken(fullSession.accessToken);
      }

      // Delete session
      await sessionService.deleteSession(session.id);

      // Log logout activity
      await activityLogService.logActivity({
        userId: session.userId,
        action: ACTIVITY_ACTIONS.LOGOUT,
        entityType: 'session',
        entityId: session.id,
        ipAddress: deviceInfo?.ip,
        userAgent: deviceInfo?.userAgent,
        deviceInfo,
      });

      log.info('User logged out', {
        userId: session.userId,
        sessionId: session.id,
      });
    } catch (error) {
      log.error('Logout failed', error);
      throw error;
    }
  }

  /**
   * Logout all devices
   */
  async logoutAll(userId: string, deviceInfo?: DeviceInfo): Promise<{ sessionsDeleted: number }> {
    try {
      // Get all sessions to revoke Google tokens
      const userSessions = await sessionService.getUserSessions(userId);

      // Revoke Google tokens for all sessions (in parallel for performance)
      await Promise.allSettled(
        userSessions.map(async (session) => {
          const fullSession = await sessionService.getSession(session.id);
          if (fullSession) {
            await googleOAuthService.revokeToken(fullSession.accessToken);
          }
        })
      );

      // Delete all sessions
      const deletedCount = await sessionService.deleteAllUserSessions(userId);

      // Log logout-all activity
      await activityLogService.logActivity({
        userId,
        action: ACTIVITY_ACTIONS.LOGOUT_ALL,
        entityType: 'session',
        changes: {
          after: { sessionsDeleted: deletedCount },
        },
        ipAddress: deviceInfo?.ip,
        userAgent: deviceInfo?.userAgent,
        deviceInfo,
      });

      log.info('User logged out from all devices', {
        userId,
        sessionsDeleted: deletedCount,
      });

      return { sessionsDeleted: deletedCount };
    } catch (error) {
      log.error('Logout all failed', error);
      throw error;
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(userId: string): Promise<{
    id: string;
    email: string;
    name: string;
    role: string;
    avatarUrl?: string;
    createdAt: Date;
  } | null> {
    try {
      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          avatarUrl: users.avatarUrl,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return user ? { ...user, avatarUrl: user.avatarUrl || undefined } : null;
    } catch (error) {
      log.error('Failed to get current user', error, { userId });
      return null;
    }
  }

  /**
   * Get user sessions
   */
  async getUserSessions(userId: string) {
    return sessionService.getUserSessions(userId);
  }
}

// Export singleton instance
export const authService = new AuthService();