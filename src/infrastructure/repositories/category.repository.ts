import { db } from '@infrastructure/database/connection';
import { categories } from '@infrastructure/database/schema';
import { eq, and, ilike, desc, sql, inArray } from 'drizzle-orm';
import { CategoryEntity } from '@domain/entities/category.entity';
import { log } from '@config/logger';
import type { ICategoryRepository } from '@domain/interfaces/repositories.interface';

/**
 * Category Repository Implementation
 * Handles database operations for categories
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * - Uses indexes on storeId and name for fast lookups
 * - Batch operations for bulk create/delete
 * - COUNT optimization (uses $count instead of SELECT *)
 */
export class CategoryRepository implements ICategoryRepository {
  /**
   * Find category by ID
   */
  async findById(id: string): Promise<CategoryEntity | null> {
    try {
      const [category] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, id))
        .limit(1);

      if (!category) {
        return null;
      }

      return CategoryEntity.fromDatabase(category);
    } catch (error) {
      log.error('Failed to find category by ID', error, { id });
      throw error;
    }
  }

  /**
   * Find categories by store ID with pagination and search
   * OPTIMIZATION: Uses indexed fields (storeId, name) for fast queries
   */
  async findByStoreId(
    storeId: string,
    options: {
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ categories: CategoryEntity[]; total: number }> {
    try {
      const { search, limit = 20, offset = 0 } = options;

      // Build where conditions
      const conditions = [eq(categories.storeId, storeId)];

      if (search) {
        // Full-text search on name (case-insensitive)
        conditions.push(ilike(categories.name, `%${search}%`));
      }

      const whereClause = and(...conditions);

      // OPTIMIZATION: Parallel queries for data and count
      const [categoryList, countResult] = await Promise.all([
        // Get categories
        db
          .select()
          .from(categories)
          .where(whereClause)
          .orderBy(desc(categories.createdAt))
          .limit(limit)
          .offset(offset),
        
        // Get total count
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(categories)
          .where(whereClause)
      ]);

      const total = countResult[0]?.count ?? 0;

      return {
        categories: categoryList.map(cat => CategoryEntity.fromDatabase(cat)),
        total,
      };
    } catch (error) {
      log.error('Failed to find categories by store ID', error, { storeId });
      throw error;
    }
  }

  /**
   * Create new category
   */
  async create(category: CategoryEntity): Promise<CategoryEntity> {
    try {
      const [created] = await db
        .insert(categories)
        .values({
          id: category.id,
          storeId: category.storeId,
          name: category.name,
          description: category.description,
          iconUrl: category.iconUrl,
          iconPublicId: category.iconPublicId,
        })
        .returning();

      if (!created) {
        throw new Error('Failed to create category');
      }

      log.info('Category created in database', { 
        categoryId: created.id, 
        storeId: created.storeId 
      });

      return CategoryEntity.fromDatabase(created);
    } catch (error) {
      log.error('Failed to create category', error, { 
        storeId: category.storeId,
        name: category.name 
      });
      throw error;
    }
  }

  /**
   * Update existing category
   */
  async update(category: CategoryEntity): Promise<CategoryEntity> {
    try {
      const [updated] = await db
        .update(categories)
        .set({
          name: category.name,
          description: category.description,
          iconUrl: category.iconUrl,
          iconPublicId: category.iconPublicId,
          updatedAt: new Date(),
        })
        .where(eq(categories.id, category.id))
        .returning();

      if (!updated) {
        throw new Error('Category not found');
      }

      log.info('Category updated in database', { categoryId: updated.id });

      return CategoryEntity.fromDatabase(updated);
    } catch (error) {
      log.error('Failed to update category', error, { categoryId: category.id });
      throw error;
    }
  }

  /**
   * Delete category
   * IMPORTANT: Cascade delete handled by database FK constraints
   */
  async delete(id: string): Promise<void> {
    try {
      const result = await db
        .delete(categories)
        .where(eq(categories.id, id))
        .returning({ id: categories.id });

      if (result.length === 0) {
        throw new Error('Category not found');
      }

      log.info('Category deleted from database', { categoryId: id });
    } catch (error) {
      log.error('Failed to delete category', error, { categoryId: id });
      throw error;
    }
  }

  /**
   * Bulk create categories
   * OPTIMIZATION: Single INSERT with multiple VALUES for performance
   */
  async bulkCreate(categoryList: CategoryEntity[]): Promise<CategoryEntity[]> {
    try {
      if (categoryList.length === 0) {
        return [];
      }

      const values = categoryList.map(cat => ({
        id: cat.id,
        storeId: cat.storeId,
        name: cat.name,
        description: cat.description,
        iconUrl: cat.iconUrl,
        iconPublicId: cat.iconPublicId,
      }));

      const created = await db
        .insert(categories)
        .values(values)
        .returning();

      log.info('Bulk categories created', { count: created.length });

      return created.map(cat => CategoryEntity.fromDatabase(cat));
    } catch (error) {
      log.error('Failed to bulk create categories', error, { 
        count: categoryList.length 
      });
      throw error;
    }
  }

  /**
   * Bulk delete categories
   * OPTIMIZATION: Single DELETE with IN clause
   */
  async bulkDelete(ids: string[]): Promise<void> {
    try {
      if (ids.length === 0) {
        return;
      }

      const result = await db
        .delete(categories)
        .where(inArray(categories.id, ids))
        .returning({ id: categories.id });

      log.info('Bulk categories deleted', { 
        requested: ids.length,
        deleted: result.length 
      });
    } catch (error) {
      log.error('Failed to bulk delete categories', error, { count: ids.length });
      throw error;
    }
  }

  /**
   * Check if category exists
   * OPTIMIZATION: Uses COUNT instead of SELECT for better performance
   */
  async exists(id: string): Promise<boolean> {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(categories)
        .where(eq(categories.id, id))
        .limit(1);

      return (result[0]?.count ?? 0) > 0;
    } catch (error) {
      log.error('Failed to check category existence', error, { id });
      return false;
    }
  }

  /**
   * Count categories by store ID
   * Used for analytics and validation
   */
  async countByStoreId(storeId: string): Promise<number> {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(categories)
        .where(eq(categories.storeId, storeId));

      return result[0]?.count ?? 0;
    } catch (error) {
      log.error('Failed to count categories', error, { storeId });
      return 0;
    }
  }

  /**
   * Batch check if categories exist
   * OPTIMIZATION: Single query instead of multiple
   */
  async existsByIds(ids: string[]): Promise<Map<string, boolean>> {
    try {
      if (ids.length === 0) {
        return new Map();
      }

      const result = await db
        .select({ id: categories.id })
        .from(categories)
        .where(inArray(categories.id, ids));

      const existingIds = new Set(result.map(r => r.id));
      
      return new Map(
        ids.map(id => [id, existingIds.has(id)])
      );
    } catch (error) {
      log.error('Failed to batch check category existence', error, { 
        count: ids.length 
      });
      return new Map();
    }
  }

  /**
   * Get categories by IDs (for batch operations)
   * OPTIMIZATION: Single query with IN clause
   */
  async findByIds(ids: string[]): Promise<CategoryEntity[]> {
    try {
      if (ids.length === 0) {
        return [];
      }

      const result = await db
        .select()
        .from(categories)
        .where(inArray(categories.id, ids));

      return result.map(cat => CategoryEntity.fromDatabase(cat));
    } catch (error) {
      log.error('Failed to find categories by IDs', error, { count: ids.length });
      return [];
    }
  }
}

// Export singleton instance
export const categoryRepository = new CategoryRepository();