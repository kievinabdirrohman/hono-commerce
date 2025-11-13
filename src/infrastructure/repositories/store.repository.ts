import { db } from '@infrastructure/database/connection';
import { stores } from '@infrastructure/database/schema';
import { eq } from 'drizzle-orm';
import { StoreEntity } from '@domain/entities/store.entity';
import { log } from '@config/logger';
import type { IStoreRepository } from '@domain/interfaces/repositories.interface';

/**
 * Store Repository Implementation
 * Handles database operations for stores
 */
export class StoreRepository implements IStoreRepository {
  /**
   * Find store by ID
   */
  async findById(id: string): Promise<StoreEntity | null> {
    try {
      const [store] = await db
        .select()
        .from(stores)
        .where(eq(stores.id, id))
        .limit(1);

      if (!store) {
        return null;
      }

      return StoreEntity.fromDatabase(store);
    } catch (error) {
      log.error('Failed to find store by ID', error, { id });
      throw error;
    }
  }

  /**
   * Find store by owner ID
   */
  async findByOwnerId(ownerId: string): Promise<StoreEntity | null> {
    try {
      const [store] = await db
        .select()
        .from(stores)
        .where(eq(stores.ownerId, ownerId))
        .limit(1);

      if (!store) {
        return null;
      }

      return StoreEntity.fromDatabase(store);
    } catch (error) {
      log.error('Failed to find store by owner ID', error, { ownerId });
      throw error;
    }
  }

  /**
   * Create new store
   */
  async create(store: StoreEntity): Promise<StoreEntity> {
    try {
      const [created] = await db
        .insert(stores)
        .values({
          id: store.id,
          ownerId: store.ownerId,
          name: store.name,
          description: store.description,
          imageUrl: store.imageUrl,
          imagePublicId: store.imagePublicId,
          tokopediaUrl: store.tokopediaUrl,
          tiktokShopUrl: store.tiktokShopUrl,
          shopeeUrl: store.shopeeUrl,
          tocoUrl: store.tocoUrl,
        })
        .returning();

      if (!created) {
        throw new Error('Failed to create store');
      }

      log.info('Store created in database', { 
        storeId: created.id, 
        ownerId: created.ownerId 
      });

      return StoreEntity.fromDatabase(created);
    } catch (error) {
      log.error('Failed to create store', error, { ownerId: store.ownerId });
      throw error;
    }
  }

  /**
   * Update existing store
   */
  async update(store: StoreEntity): Promise<StoreEntity> {
    try {
      const [updated] = await db
        .update(stores)
        .set({
          name: store.name,
          description: store.description,
          imageUrl: store.imageUrl,
          imagePublicId: store.imagePublicId,
          tokopediaUrl: store.tokopediaUrl,
          tiktokShopUrl: store.tiktokShopUrl,
          shopeeUrl: store.shopeeUrl,
          tocoUrl: store.tocoUrl,
          updatedAt: new Date(),
        })
        .where(eq(stores.id, store.id))
        .returning();

      if (!updated) {
        throw new Error('Store not found');
      }

      log.info('Store updated in database', { storeId: updated.id });

      return StoreEntity.fromDatabase(updated);
    } catch (error) {
      log.error('Failed to update store', error, { storeId: store.id });
      throw error;
    }
  }

  /**
   * Check if store exists
   * Optimized: Uses COUNT instead of SELECT to reduce data transfer
   */
  async exists(id: string): Promise<boolean> {
    try {
      const result = await db
        .select({ count: db.$count(stores) })
        .from(stores)
        .where(eq(stores.id, id))
        .limit(1);

      return (result[0]?.count ?? 0) > 0;
    } catch (error) {
      log.error('Failed to check store existence', error, { id });
      return false;
    }
  }

  /**
   * Check if store exists by owner ID
   * Optimized: Uses COUNT instead of SELECT to reduce data transfer
   * Additional optimization: This check happens frequently during store creation,
   * so we could add caching here if needed
   */
  async existsByOwnerId(ownerId: string): Promise<boolean> {
    try {
      const result = await db
        .select({ count: db.$count(stores) })
        .from(stores)
        .where(eq(stores.ownerId, ownerId))
        .limit(1);

      return (result[0]?.count ?? 0) > 0;
    } catch (error) {
      log.error('Failed to check store existence by owner', error, { ownerId });
      return false;
    }
  }

  /**
   * Batch check if multiple owners have stores
   * Performance optimization for bulk operations
   */
  async existsByOwnerIds(ownerIds: string[]): Promise<Map<string, boolean>> {
    try {
      if (ownerIds.length === 0) {
        return new Map();
      }

      const { inArray } = await import('drizzle-orm');
      
      const result = await db
        .select({ ownerId: stores.ownerId })
        .from(stores)
        .where(inArray(stores.ownerId, ownerIds));

      const existingOwners = new Set(result.map(r => r.ownerId));
      
      return new Map(
        ownerIds.map(ownerId => [ownerId, existingOwners.has(ownerId)])
      );
    } catch (error) {
      log.error('Failed to batch check store existence', error, { count: ownerIds.length });
      return new Map();
    }
  }
}

// Export singleton instance
export const storeRepository = new StoreRepository();