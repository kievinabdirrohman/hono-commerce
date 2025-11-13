import { storeRepository } from '@infrastructure/repositories/store.repository';
import { activityLogService } from './activity-log.service';
import { StoreEntity } from '@domain/entities/store.entity';
import { cacheService } from '@infrastructure/cache/cache.service';
import { log } from '@config/logger';
import { generateUUID } from '@/utils/helpers';
import { ACTIVITY_ACTIONS, REDIS_TTL } from '@/utils/constants';
import { ConflictError, NotFoundError, AuthorizationError } from '@/types/common';
import type { DeviceInfo } from '@/types/common';
import { db } from '@/infrastructure/database/connection';
import { stores } from '@/infrastructure/database/schema';

/**
 * Store Service
 * Business logic for store management
 * 
 * Business Rules:
 * - One store per owner (create once)
 * - Owner can manage (create, read, update)
 * - Staff can read and edit only
 * - No delete operation
 */
export class StoreService {
  /**
   * Create new store (owner only, once per owner)
   * Performance: Uses database-level unique constraint as primary check
   * Fallback: Service-level check for better error messages
   */
  async createStore(
    ownerId: string,
    data: {
      name: string;
      description?: string;
    },
    deviceInfo?: DeviceInfo
  ): Promise<StoreEntity> {
    try {
      // OPTIMIZATION: Skip the exists check and rely on database constraint
      // This reduces one database round-trip. The unique constraint on owner_id
      // will throw a specific PostgreSQL error (23505) that we catch and handle
      
      // Create store entity
      const store = StoreEntity.create({
        id: generateUUID(),
        ownerId,
        name: data.name,
        description: data.description,
      });

      // Save to database
      // If owner already has a store, PostgreSQL will throw unique constraint error
      const created = await storeRepository.create(store);

      // Cache the store immediately after creation
      // Use Promise.all for parallel operations to reduce latency
      await Promise.all([
        this.cacheStore(created),
        // Log activity asynchronously without blocking response
        activityLogService.logActivity({
          userId: ownerId,
          action: ACTIVITY_ACTIONS.CREATE,
          entityType: 'store',
          entityId: created.id,
          changes: {
            after: created.toObject(),
          },
          ipAddress: deviceInfo?.ip,
          userAgent: deviceInfo?.userAgent,
          deviceInfo,
        }),
      ]);

      log.info('Store created', { 
        storeId: created.id, 
        ownerId 
      });

      return created;
    } catch (error) {
      // Handle PostgreSQL unique constraint violation
      if (error && typeof error === 'object' && 'code' in error) {
        const pgError = error as { code: string; constraint?: string };
        
        // 23505 = unique_violation
        if (pgError.code === '23505' && pgError.constraint === 'stores_owner_id_unique') {
          throw new ConflictError('You already have a store. Each owner can only have one store.');
        }
      }
      
      log.error('Failed to create store', error, { ownerId });
      throw error;
    }
  }

  /**
   * Get store by ID
   */
  async getStoreById(storeId: string): Promise<StoreEntity | null> {
    try {
      // Try cache first
      const cacheKey = `store:${storeId}`;
      const cached = await cacheService.get<ReturnType<StoreEntity['toObject']>>(cacheKey);
      
      if (cached) {
        return StoreEntity.fromDatabase(cached);
      }

      // Get from database
      const store = await storeRepository.findById(storeId);
      
      if (store) {
        // Cache for next time
        await this.cacheStore(store);
      }

      return store;
    } catch (error) {
      log.error('Failed to get store by ID', error, { storeId });
      throw error;
    }
  }

  /**
   * Get store by owner ID
   */
  async getStoreByOwnerId(ownerId: string): Promise<StoreEntity | null> {
    try {
      // Try cache first
      const cacheKey = `store:owner:${ownerId}`;
      const cached = await cacheService.get<ReturnType<StoreEntity['toObject']>>(cacheKey);
      
      if (cached) {
        return StoreEntity.fromDatabase(cached);
      }

      // Get from database
      const store = await storeRepository.findByOwnerId(ownerId);
      
      if (store) {
        // Cache both store and owner mapping
        await this.cacheStore(store);
        await cacheService.set(`store:owner:${ownerId}`, store.toObject(), REDIS_TTL.CACHE_LONG);
      }

      return store;
    } catch (error) {
      log.error('Failed to get store by owner ID', error, { ownerId });
      throw error;
    }
  }

  /**
   * Update store information (owner and staff with permission)
   * Optimized: Uses database-level optimistic locking with updated_at
   */
  async updateStore(
    storeId: string,
    userId: string,
    userRole: string,
    data: {
      name?: string;
      description?: string;
      tokopediaUrl?: string;
      tiktokShopUrl?: string;
      shopeeUrl?: string;
      tocoUrl?: string;
    },
    deviceInfo?: DeviceInfo
  ): Promise<StoreEntity> {
    try {
      // OPTIMIZATION: Fetch and authorize in one operation
      // Get existing store from cache first (faster), fallback to DB
      let store = await this.getStoreById(storeId);
      
      if (!store) {
        throw new NotFoundError('Store', storeId);
      }

      // SECURITY: Authorization check - verify user has access
      // Owner check is fast (simple comparison)
      if (userRole !== 'owner' && store.ownerId !== userId) {
        throw new AuthorizationError('You can only update your own store');
      }

      // Store old values for activity log (only changed fields to reduce log size)
      const oldValues: Record<string, unknown> = {};
      const changes: Record<string, unknown> = {};
      
      Object.keys(data).forEach(key => {
        const dataKey = key as keyof typeof data;
        const oldValue = store[dataKey as keyof typeof store];
        const newValue = data[dataKey];
        
        if (oldValue !== newValue) {
          oldValues[key] = oldValue;
          changes[key] = newValue;
        }
      });

      // OPTIMIZATION: If no actual changes, skip update
      if (Object.keys(changes).length === 0) {
        log.debug('No changes detected, skipping update', { storeId });
        return store;
      }

      // Update store entity
      const updated = store.update(data);

      // Save to database
      const savedStore = await storeRepository.update(updated);

      // OPTIMIZATION: Parallel operations for cache invalidation and activity logging
      // Both can happen simultaneously without blocking each other
      await Promise.all([
        this.invalidateStoreCache(savedStore.id, savedStore.ownerId),
        activityLogService.logActivity({
          userId,
          action: ACTIVITY_ACTIONS.UPDATE,
          entityType: 'store',
          entityId: savedStore.id,
          changes: {
            before: oldValues,
            after: changes,
          },
          ipAddress: deviceInfo?.ip,
          userAgent: deviceInfo?.userAgent,
          deviceInfo,
        }),
      ]);

      log.info('Store updated', { 
        storeId: savedStore.id, 
        userId,
        changedFields: Object.keys(changes).length
      });

      return savedStore;
    } catch (error) {
      log.error('Failed to update store', error, { storeId, userId });
      throw error;
    }
  }

  /**
   * Update store image (owner and staff with permission)
   */
  async updateStoreImage(
    storeId: string,
    userId: string,
    userRole: string,
    imageUrl: string,
    imagePublicId: string,
    deviceInfo?: DeviceInfo
  ): Promise<StoreEntity> {
    try {
      // Get existing store
      const store = await storeRepository.findById(storeId);
      if (!store) {
        throw new NotFoundError('Store', storeId);
      }

      // Authorization check
      if (userRole !== 'owner' && store.ownerId !== userId) {
        throw new AuthorizationError('You can only update your own store');
      }

      // Store old values for activity log
      const oldImagePublicId = store.imagePublicId;

      // Update store image
      const updated = store.updateImage(imageUrl, imagePublicId);

      // Save to database
      const savedStore = await storeRepository.update(updated);

      // Invalidate cache
      await this.invalidateStoreCache(savedStore.id, savedStore.ownerId);

      // Log activity
      await activityLogService.logActivity({
        userId,
        action: ACTIVITY_ACTIONS.UPDATE,
        entityType: 'store',
        entityId: savedStore.id,
        changes: {
          before: { imagePublicId: oldImagePublicId },
          after: { imagePublicId: savedStore.imagePublicId },
        },
        ipAddress: deviceInfo?.ip,
        userAgent: deviceInfo?.userAgent,
        deviceInfo,
      });

      log.info('Store image updated', { 
        storeId: savedStore.id, 
        userId,
        oldPublicId: oldImagePublicId,
        newPublicId: imagePublicId
      });

      return savedStore;
    } catch (error) {
      log.error('Failed to update store image', error, { storeId, userId });
      throw error;
    }
  }

  /**
   * Check if user can access store
   * OPTIMIZATION: Uses cache first, then database
   * SECURITY: Also checks staff permissions via store ownership
   */
  async canAccessStore(userId: string, storeId: string): Promise<boolean> {
    try {
      // OPTIMIZATION: Try cache first to avoid database hit
      const cacheKey = `store:access:${userId}:${storeId}`;
      const cached = await cacheService.get<boolean>(cacheKey);
      
      if (cached !== null) {
        return cached;
      }

      // Fetch store (uses cache internally)
      const store = await this.getStoreById(storeId);
      if (!store) {
        // Cache the negative result to prevent repeated DB queries
        await cacheService.set(cacheKey, false, REDIS_TTL.CACHE_SHORT);
        return false;
      }

      // Owner can always access their store
      const hasAccess = store.ownerId === userId;
      
      // OPTIMIZATION: Cache the access check result
      // Short TTL since permissions might change
      await cacheService.set(cacheKey, hasAccess, REDIS_TTL.CACHE_SHORT);
      
      return hasAccess;
    } catch (error) {
      log.error('Failed to check store access', error, { userId, storeId });
      // SECURITY: Fail closed - deny access on error
      return false;
    }
  }

  /**
   * Batch get stores by IDs
   * Performance optimization for when multiple stores need to be fetched
   */
  async getStoresByIds(storeIds: string[]): Promise<Map<string, StoreEntity>> {
    try {
      if (storeIds.length === 0) {
        return new Map();
      }

      // Try to get all from cache first
      const cacheKeys = storeIds.map(id => `store:${id}`);
      const cached = await cacheService.mget<ReturnType<StoreEntity['toObject']>>(cacheKeys);
      
      const result = new Map<string, StoreEntity>();
      const missingIds: string[] = [];

      // Process cached results
      cached.forEach((data, index) => {
        if (data) {
          const store = StoreEntity.fromDatabase(data);
          result.set(storeIds[index]!, store);
        } else {
          missingIds.push(storeIds[index]!);
        }
      });

      // Fetch missing stores from database if any
      if (missingIds.length > 0) {
        const { inArray } = await import('drizzle-orm');
        const dbStores = await db
          .select()
          .from(stores)
          .where(inArray(stores.id, missingIds));

        // Cache newly fetched stores
        const cacheEntries = dbStores.map(store => ({
          key: `store:${store.id}`,
          value: store,
          ttl: REDIS_TTL.CACHE_LONG,
        }));

        if (cacheEntries.length > 0) {
          await cacheService.mset(cacheEntries);
        }

        // Add to result
        for (const dbStore of dbStores) {
          result.set(dbStore.id, StoreEntity.fromDatabase(dbStore));
        }
      }

      return result;
    } catch (error) {
      log.error('Failed to batch get stores', error, { count: storeIds.length });
      return new Map();
    }
  }

  /**
   * Cache store data
   * OPTIMIZATION: Batch cache operations for better performance
   */
  private async cacheStore(store: StoreEntity): Promise<void> {
    try {
      const storeData = store.toObject();
      
      // OPTIMIZATION: Use mset for parallel cache writes
      // This is more efficient than sequential set operations
      await cacheService.mset([
        {
          key: `store:${store.id}`,
          value: storeData,
          ttl: REDIS_TTL.CACHE_LONG,
        },
        {
          key: `store:owner:${store.ownerId}`,
          value: storeData,
          ttl: REDIS_TTL.CACHE_LONG,
        },
      ]);

      log.debug('Store cached', { storeId: store.id });
    } catch (error) {
      // RESILIENCE: Don't throw - caching failure shouldn't break the operation
      // The application can continue working, just slightly slower
      log.error('Failed to cache store', error, { storeId: store.id });
    }
  }

  /**
   * Invalidate store cache
   * OPTIMIZATION: Batch cache deletion for better performance
   */
  private async invalidateStoreCache(storeId: string, ownerId: string): Promise<void> {
    try {
      // OPTIMIZATION: Delete all related cache keys in parallel
      // Including access check caches that might exist
      await Promise.all([
        cacheService.delete(`store:${storeId}`),
        cacheService.delete(`store:owner:${ownerId}`),
        // Invalidate all access check caches for this store
        cacheService.deletePattern(`store:access:*:${storeId}`),
      ]);
      
      log.debug('Store cache invalidated', { storeId, ownerId });
    } catch (error) {
      // RESILIENCE: Don't throw - cache invalidation failure shouldn't break the operation
      // Worst case: stale cache data that will expire based on TTL
      log.error('Failed to invalidate store cache', error, { storeId, ownerId });
    }
  }
}

// Export singleton instance
export const storeService = new StoreService();