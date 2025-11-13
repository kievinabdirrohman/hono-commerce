import { Context, Next } from 'hono';
import { db, getDatabase } from '@infrastructure/database/connection';
import {
  userPermissions,
  permissions,
  rolePermissions,
  roles,
  users
} from '@infrastructure/database/schema';
import { eq, and } from 'drizzle-orm';
import { cacheService } from '@infrastructure/cache/cache.service';
import { log } from '@config/logger';
import { AuthorizationError } from '@/types/common';
import { USER_ROLES, REDIS_TTL } from '@/utils/constants';
import type { EntityType, ActionType, UserRole } from '@/utils/constants';

/**
 * RBAC Middleware
 * Checks if user has required permission for entity and action
 */
export const requirePermission = (entity: EntityType, action: ActionType) => {
  return async (c: Context, next: Next) => {
    try {
      const userId = c.get('userId') as string | undefined;
      const userRole = c.get('userRole') as string | undefined;

      // Type guard to ensure userRole is a valid UserRole
      const isValidUserRole = (role: string | undefined): role is UserRole => {
        return role === USER_ROLES.OWNER || role === USER_ROLES.STAFF;
      };

      if (!userId || !userRole || !isValidUserRole(userRole)) {
        throw new AuthorizationError('User not authenticated');
      }

      // Owner has all permissions
      if (userRole === USER_ROLES.OWNER) {
        log.debug('Owner access granted', { userId, entity, action });
        await next();
        return;
      }

      // Check staff permissions
      const hasPermission = await checkUserPermission(userId, entity, action);

      if (!hasPermission) {
        log.warn('Permission denied', { userId, entity, action });
        throw new AuthorizationError(
          `You don't have permission to ${action} ${entity}`
        );
      }

      log.debug('Permission granted', { userId, entity, action });
      await next();
    } catch (error) {
      if (error instanceof AuthorizationError) {
        log.debug('Authorization failed', { error: error.message });
      } else {
        log.error('Authorization error', error);
      }
      throw error;
    }
  };
};

/**
 * Require Owner Role
 */
export const requireOwner = async (c: Context, next: Next) => {
  try {
    const userRole = c.get('userRole') as string | undefined;

    // Type guard to ensure userRole is a valid UserRole
    const isValidUserRole = (role: string | undefined): role is UserRole => {
      return role === USER_ROLES.OWNER || role === USER_ROLES.STAFF;
    };

    if (!userRole || !isValidUserRole(userRole) || userRole !== USER_ROLES.OWNER) {
      throw new AuthorizationError('This action requires owner privileges');
    }

    await next();
  } catch (error) {
    log.debug('Owner authorization failed');
    throw error;
  }
};

/**
 * Require Staff Role (staff or owner)
 */
export const requireStaff = async (c: Context, next: Next) => {
  try {
    const userRole = c.get('userRole') as string | undefined;

    // Type guard to ensure userRole is a valid UserRole
    const isValidUserRole = (role: string | undefined): role is UserRole => {
      return role === USER_ROLES.OWNER || role === USER_ROLES.STAFF;
    };

    if (!userRole || !isValidUserRole(userRole)) {
      throw new AuthorizationError('This action requires staff privileges');
    }

    await next();
  } catch (error) {
    log.debug('Staff authorization failed');
    throw error;
  }
};

/**
 * Check if user has specific permission
 */
async function checkUserPermission(
  userId: string,
  entity: EntityType,
  action: ActionType
): Promise<boolean> {
  try {
    // Try cache first
    const cacheKey = `user:${userId}:permission:${entity}:${action}`;
    const cached = await cacheService.get<boolean>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Use proper Drizzle ORM query instead of raw SQL
    const result = await db
      .select({
        hasPermission: userPermissions.userId,
      })
      .from(userPermissions)
      .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
      .where(
        and(
          eq(userPermissions.userId, userId),
          eq(permissions.entity, entity),
          eq(permissions.action, action)
        )
      )
      .limit(1);

    const hasPermission = result.length > 0;

    // Cache result
    await cacheService.set(cacheKey, hasPermission, REDIS_TTL.CACHE_LONG);

    return hasPermission;
  } catch (error) {
    log.error('Failed to check user permission', error, { userId, entity, action });
    return false;
  }
}

/**
 * Get all user permissions (for UI rendering)
 */
export async function getUserPermissions(userId: string): Promise<
  Array<{
    entity: EntityType;
    action: ActionType;
  }>
> {
  try {
    // Try cache first
    const cacheKey = `user:${userId}:permissions`;
    const cached = await cacheService.get<Array<{ entity: EntityType; action: ActionType }>>(
      cacheKey
    );
    if (cached) {
      return cached;
    }

    // Get user role
    const [user] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return [];
    }

    // Owner has all permissions
    if (user.role === USER_ROLES.OWNER) {
      const allPermissions = await db
        .select({
          entity: permissions.entity,
          action: permissions.action,
        })
        .from(permissions);

      const result = allPermissions as Array<{ entity: EntityType; action: ActionType }>;
      await cacheService.set(cacheKey, result, REDIS_TTL.CACHE_LONG);
      return result;
    }

    // Get staff permissions
    const staffPermissions = await db
      .select({
        entity: permissions.entity,
        action: permissions.action,
      })
      .from(userPermissions)
      .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
      .where(eq(userPermissions.userId, userId));

    const result = staffPermissions as Array<{ entity: EntityType; action: ActionType }>;
    await cacheService.set(cacheKey, result, REDIS_TTL.CACHE_LONG);

    return result;
  } catch (error) {
    log.error('Failed to get user permissions', error, { userId });
    return [];
  }
}

/**
 * Clear user permissions cache
 */
export async function clearUserPermissionsCache(userId: string): Promise<void> {
  try {
    await cacheService.deletePattern(`user:${userId}:permission:*`);
    await cacheService.delete(`user:${userId}:permissions`);
    log.debug('User permissions cache cleared', { userId });
  } catch (error) {
    log.error('Failed to clear user permissions cache', error, { userId });
  }
}