import { db } from '@infrastructure/database/connection';
import { activityLogs } from '@infrastructure/database/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { log } from '@config/logger';
import type { ActivityAction, EntityType } from '@/utils/constants';
import type { DeviceInfo } from '@/types/common';

/**
 * Activity Log Service
 * Logs all CRUD operations and important actions (Owner only access)
 */
export class ActivityLogService {
  /**
   * Log an activity
   */
  async logActivity(data: {
    userId: string;
    action: ActivityAction;
    entityType: EntityType | string;
    entityId?: string;
    changes?: {
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
    };
    ipAddress?: string;
    userAgent?: string;
    deviceInfo?: DeviceInfo;
  }): Promise<void> {
    try {
      await db.insert(activityLogs).values({
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        changes: data.changes ? JSON.parse(JSON.stringify(data.changes)) : null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        deviceInfo: data.deviceInfo ? JSON.parse(JSON.stringify(data.deviceInfo)) : null,
      });

      log.debug('Activity logged', {
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
      });
    } catch (error) {
      // Don't throw - logging failure shouldn't break the main operation
      log.error('Failed to log activity', error, {
        userId: data.userId,
        action: data.action,
      });
    }
  }

  /**
   * Get activity logs (with filters)
   */
  async getActivityLogs(filters: {
    userId?: string;
    action?: ActivityAction;
    entityType?: EntityType;
    entityId?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{
    logs: Array<{
      id: string;
      userId: string;
      action: string;
      entityType: string;
      entityId?: string;
      changes?: unknown;
      ipAddress?: string;
      userAgent?: string;
      deviceInfo?: unknown;
      createdAt: Date;
    }>;
    total: number;
  }> {
    try {
      // Build where conditions
      const conditions = [];

      if (filters.userId) {
        conditions.push(eq(activityLogs.userId, filters.userId));
      }

      if (filters.action) {
        conditions.push(eq(activityLogs.action, filters.action));
      }

      if (filters.entityType) {
        conditions.push(eq(activityLogs.entityType, filters.entityType));
      }

      if (filters.entityId) {
        conditions.push(eq(activityLogs.entityId, filters.entityId));
      }

      if (filters.fromDate) {
        conditions.push(gte(activityLogs.createdAt, filters.fromDate));
      }

      if (filters.toDate) {
        conditions.push(lte(activityLogs.createdAt, filters.toDate));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Get logs
      const logs = await db
        .select()
        .from(activityLogs)
        .where(whereClause)
        .orderBy(desc(activityLogs.createdAt))
        .limit(filters.limit || 50)
        .offset(filters.offset || 0);

      // Get total count using Drizzle's count function
      const countResult = await db
        .select({ count: db.$count(activityLogs) })
        .from(activityLogs)
        .where(whereClause);

      const totalCount = countResult[0]?.count ?? 0;

      return {
        logs: logs.map((log) => ({
          id: log.id,
          userId: log.userId,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId || undefined,
          changes: log.changes || undefined,
          ipAddress: log.ipAddress || undefined,
          userAgent: log.userAgent || undefined,
          deviceInfo: log.deviceInfo || undefined,
          createdAt: log.createdAt,
        })),
        total: totalCount,
      };
    } catch (error) {
      log.error('Failed to get activity logs', error);
      return { logs: [], total: 0 };
    }
  }

  /**
   * Export activity logs (CSV/JSON)
   */
  async exportActivityLogs(
    filters: {
      userId?: string;
      fromDate?: Date;
      toDate?: Date;
    },
    format: 'csv' | 'json' = 'json'
  ): Promise<string> {
    try {
      const { logs } = await this.getActivityLogs({
        ...filters,
        limit: 10000, // Large limit for export
      });

      if (format === 'json') {
        return JSON.stringify(logs, null, 2);
      }

      // CSV format
      const headers = [
        'ID',
        'User ID',
        'Action',
        'Entity Type',
        'Entity ID',
        'IP Address',
        'Created At',
      ];
      const rows = logs.map((log) => [
        log.id,
        log.userId,
        log.action,
        log.entityType,
        log.entityId || '',
        log.ipAddress || '',
        log.createdAt.toISOString(),
      ]);

      const csv = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      ].join('\n');

      return csv;
    } catch (error) {
      log.error('Failed to export activity logs', error);
      throw error;
    }
  }
}

// Export singleton instance
export const activityLogService = new ActivityLogService();