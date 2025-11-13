import type { UserEntity } from '../entities/user.entity';
import type { StoreEntity } from '../entities/store.entity';
import type { CategoryEntity } from '../entities/category.entity';
import type { ProductEntity } from '../entities/product.entity';
import type { ProductVariantEntity } from '../entities/product-variant.entity';

/**
 * Repository Interfaces (Ports)
 * Define contracts for data access without implementation details
 */

export interface IUserRepository {
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  findByGoogleId(googleId: string): Promise<UserEntity | null>;
  findAll(filters?: {
    role?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ users: UserEntity[]; total: number }>;
  create(user: UserEntity): Promise<UserEntity>;
  update(user: UserEntity): Promise<UserEntity>;
  delete(id: string): Promise<void>;
  exists(id: string): Promise<boolean>;
}

export interface IStoreRepository {
  findById(id: string): Promise<StoreEntity | null>;
  findByOwnerId(ownerId: string): Promise<StoreEntity | null>;
  create(store: StoreEntity): Promise<StoreEntity>;
  update(store: StoreEntity): Promise<StoreEntity>;
  exists(id: string): Promise<boolean>;
  existsByOwnerId(ownerId: string): Promise<boolean>;
}

export interface ICategoryRepository {
  findById(id: string): Promise<CategoryEntity | null>;
  findByStoreId(
    storeId: string,
    options?: {
      search?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ categories: CategoryEntity[]; total: number }>;
  create(category: CategoryEntity): Promise<CategoryEntity>;
  update(category: CategoryEntity): Promise<CategoryEntity>;
  delete(id: string): Promise<void>;
  bulkCreate(categories: CategoryEntity[]): Promise<CategoryEntity[]>;
  bulkDelete(ids: string[]): Promise<void>;
  exists(id: string): Promise<boolean>;
  countByStoreId(storeId: string): Promise<number>;
}

export interface IProductRepository {
  findById(id: string): Promise<ProductEntity | null>;
  findByStoreId(
    storeId: string,
    options?: {
      search?: string;
      categoryId?: string;
      minPrice?: number;
      maxPrice?: number;
      inStock?: boolean;
      limit?: number;
      offset?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<{ products: ProductEntity[]; total: number }>;
  findBySku(sku: string, storeId: string): Promise<ProductEntity | null>;
  create(product: ProductEntity): Promise<ProductEntity>;
  update(product: ProductEntity): Promise<ProductEntity>;
  delete(id: string): Promise<void>;
  bulkCreate(products: ProductEntity[]): Promise<ProductEntity[]>;
  bulkUpdate(products: ProductEntity[]): Promise<ProductEntity[]>;
  bulkDelete(ids: string[]): Promise<void>;
  exists(id: string): Promise<boolean>;
  existsBySku(sku: string, storeId: string, excludeId?: string): Promise<boolean>;
  countByStoreId(storeId: string): Promise<number>;
  countByCategoryId(categoryId: string): Promise<number>;
}

export interface IProductVariantRepository {
  findById(id: string): Promise<ProductVariantEntity | null>;
  findByProductId(productId: string): Promise<ProductVariantEntity[]>;
  findBySku(sku: string): Promise<ProductVariantEntity | null>;
  create(variant: ProductVariantEntity): Promise<ProductVariantEntity>;
  update(variant: ProductVariantEntity): Promise<ProductVariantEntity>;
  delete(id: string): Promise<void>;
  bulkCreate(variants: ProductVariantEntity[]): Promise<ProductVariantEntity[]>;
  bulkUpdate(variants: ProductVariantEntity[]): Promise<ProductVariantEntity[]>;
  bulkDeleteByProductId(productId: string): Promise<void>;
  exists(id: string): Promise<boolean>;
  existsBySku(sku: string, excludeId?: string): Promise<boolean>;
  countByProductId(productId: string): Promise<number>;
}

/**
 * Unit of Work Interface
 * Manages transactions across multiple repositories
 */
export interface IUnitOfWork {
  users: IUserRepository;
  stores: IStoreRepository;
  categories: ICategoryRepository;
  products: IProductRepository;
  productVariants: IProductVariantRepository;

  /**
   * Begin transaction
   */
  begin(): Promise<void>;

  /**
   * Commit transaction
   */
  commit(): Promise<void>;

  /**
   * Rollback transaction
   */
  rollback(): Promise<void>;

  /**
   * Execute within transaction
   */
  transaction<T>(work: (uow: IUnitOfWork) => Promise<T>): Promise<T>;
}