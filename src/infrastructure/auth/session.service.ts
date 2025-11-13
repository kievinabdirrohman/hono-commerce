import { db } from '@infrastructure/database/connection';
import { sessions } from '@infrastructure/database/schema';
import { eq, and, gt, desc, lt } from 'drizzle-orm';
import { getRedisClient } from '@infrastructure/cache/connection';
import { log } from '@config/logger';
import { SESSION, REDIS_TTL } from '@/utils/constants';
import type { DeviceInfo } from '@/types/common';
import { NotFoundError } from '@/types/common';

/**
 * Session Service
 * Manages user sessions with multi-device support
 */
export class SessionService {
  private redis = getRedisClient();

  /**
   * Create new session
   */
  async createSession(data: {
    userId: string;
    accessToken: string;
    refreshToken: string;
    deviceInfo?: DeviceInfo;
    expiresAt: Date;
  }): Promise<{ id: string }> {
    try {
      // Check session limit - get only count for efficiency
      const userSessionCount = await db
        .select({ count: sessions.id })
        .from(sessions)
        .where(
          and(
            eq(sessions.userId, data.userId),
            gt(sessions.expiresAt, new Date())
          )
        );

      const count = Number(userSessionCount[0]?.count || 0);

      if (count >= SESSION.MAX_SESSIONS_PER_USER) {
        // Delete oldest session
        const [oldestSession] = await db
          .select({ id: sessions.id })
          .from(sessions)
          .where(eq(sessions.userId, data.userId))
          .orderBy(sessions.createdAt)
          .limit(1);

        if (oldestSession) {
          await this.deleteSession(oldestSession.id);
          log.info('Deleted oldest session due to limit', {
            userId: data.userId,
            limit: SESSION.MAX_SESSIONS_PER_USER,
          });
        }
      }

      // Create session in database
      const [session] = await db
        .insert(sessions)
        .values({
          userId: data.userId,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          deviceId: data.deviceInfo?.deviceId,
          userAgent: data.deviceInfo?.userAgent,
          ipAddress: data.deviceInfo?.ip,
          expiresAt: data.expiresAt,
        })
        .returning({ id: sessions.id });

      if (!session) {
        throw new Error('Failed to create session - no session ID returned');
      }

      // Cache session in Redis
      await this.cacheSession(session.id, {
        userId: data.userId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
      });

      log.info('Session created', {
        sessionId: session.id,
        userId: data.userId,
        deviceId: data.deviceInfo?.deviceId,
      });

      return { id: session.id };
    } catch (error) {
      log.error('Failed to create session', error);
      throw error;
    }
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<{
    id: string;
    userId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  } | null> {
    try {
      // Try cache first
      const cached = await this.getCachedSession(sessionId);
      if (cached) {
        return cached;
      }

      // Get from database
      const [session] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .limit(1);

      if (!session) {
        return null;
      }

      // Cache for next time
      await this.cacheSession(sessionId, {
        userId: session.userId,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt,
      });

      return {
        id: session.id,
        userId: session.userId,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt,
      };
    } catch (error) {
      log.error('Failed to get session', error, { sessionId });
      return null;
    }
  }

  /**
   * Get session by access token
   */
  async getSessionByAccessToken(accessToken: string): Promise<{
    id: string;
    userId: string;
    role: string;
  } | null> {
    try {
      const [session] = await db
        .select({
          id: sessions.id,
          userId: sessions.userId,
        })
        .from(sessions)
        .where(eq(sessions.accessToken, accessToken))
        .limit(1);

      if (!session) {
        return null;
      }

      // Get user role
      const { users } = await import('@infrastructure/database/schema');
      const [user] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      return {
        id: session.id,
        userId: session.userId,
        role: user?.role || 'staff',
      };
    } catch (error) {
      log.error('Failed to get session by access token', error);
      return null;
    }
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<Array<{
    id: string;
    deviceId?: string;
    userAgent?: string;
    ipAddress?: string;
    createdAt: Date;
    expiresAt: Date;
  }>> {
    try {
      const userSessions = await db
        .select({
          id: sessions.id,
          deviceId: sessions.deviceId,
          userAgent: sessions.userAgent,
          ipAddress: sessions.ipAddress,
          createdAt: sessions.createdAt,
          expiresAt: sessions.expiresAt,
        })
        .from(sessions)
        .where(
          and(
            eq(sessions.userId, userId),
            gt(sessions.expiresAt, new Date()) // Only non-expired sessions
          )
        )
        .orderBy(sessions.createdAt);

      // Transform null values to undefined for proper typing
      return userSessions.map(session => ({
        ...session,
        deviceId: session.deviceId ?? undefined,
        userAgent: session.userAgent ?? undefined,
        ipAddress: session.ipAddress ?? undefined,
      }));
    } catch (error) {
      log.error('Failed to get user sessions', error, { userId });
      return [];
    }
  }

  /**
   * Update session tokens
   */
  async updateSessionTokens(
    sessionId: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: Date
  ): Promise<void> {
    try {
      await db
        .update(sessions)
        .set({
          accessToken,
          refreshToken,
          expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(sessions.id, sessionId));

      // Update cache
      const session = await this.getSession(sessionId);
      if (session) {
        await this.cacheSession(sessionId, {
          userId: session.userId,
          accessToken,
          refreshToken,
          expiresAt,
        });
      }

      log.info('Session tokens updated', { sessionId });
    } catch (error) {
      log.error('Failed to update session tokens', error, { sessionId });
      throw error;
    }
  }

  /**
   * Delete session (single device logout)
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      // Delete from database
      await db.delete(sessions).where(eq(sessions.id, sessionId));

      // Delete from cache
      await this.deleteCachedSession(sessionId);

      log.info('Session deleted', { sessionId });
    } catch (error) {
      log.error('Failed to delete session', error, { sessionId });
      throw error;
    }
  }

  /**
   * Delete all sessions for a user (logout all devices)
   */
  async deleteAllUserSessions(userId: string): Promise<number> {
    try {
      // Get all session IDs first for cache cleanup
      const userSessions = await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.userId, userId));

      // Delete from database
      await db.delete(sessions).where(eq(sessions.userId, userId));

      // Delete from cache
      for (const session of userSessions) {
        await this.deleteCachedSession(session.id);
      }

      log.info('All user sessions deleted', {
        userId,
        count: userSessions.length,
      });

      return userSessions.length;
    } catch (error) {
      log.error('Failed to delete all user sessions', error, { userId });
      throw error;
    }
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await db
        .delete(sessions)
        .where(lt(sessions.expiresAt, new Date()))
        .returning({ id: sessions.id });

      log.info('Expired sessions cleaned up', { count: result.length });

      return result.length;
    } catch (error) {
      log.error('Failed to cleanup expired sessions', error);
      return 0;
    }
  }

  /**
   * Cache session in Redis
   */
  private async cacheSession(
    sessionId: string,
    data: {
      userId: string;
      accessToken: string;
      refreshToken: string;
      expiresAt: Date;
    }
  ): Promise<void> {
    try {
      const key = `session:${sessionId}`;
      await this.redis.setex(
        key,
        REDIS_TTL.SESSION,
        JSON.stringify(data)
      );
    } catch (error) {
      log.error('Failed to cache session', error, { sessionId });
      // Don't throw - caching failure shouldn't break session creation
    }
  }

  /**
   * Get cached session from Redis
   */
  private async getCachedSession(sessionId: string): Promise<{
    id: string;
    userId: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  } | null> {
    try {
      const key = `session:${sessionId}`;
      const cached = await this.redis.get(key);

      if (!cached) {
        return null;
      }

      const data = JSON.parse(cached);
      return {
        id: sessionId,
        ...data,
        expiresAt: new Date(data.expiresAt),
      };
    } catch (error) {
      log.error('Failed to get cached session', error, { sessionId });
      return null;
    }
  }

  /**
   * Delete cached session from Redis
   */
  private async deleteCachedSession(sessionId: string): Promise<void> {
    try {
      const key = `session:${sessionId}`;
      await this.redis.del(key);
    } catch (error) {
      log.error('Failed to delete cached session', error, { sessionId });
      // Don't throw - cache deletion failure shouldn't break logout
    }
  }
}

// Export singleton instance
export const sessionService = new SessionService();