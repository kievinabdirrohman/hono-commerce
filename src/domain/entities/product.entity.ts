import { ValidationError } from '@/types/common';
import { Decimal } from 'decimal.js';

/**
 * Product Domain Entity
 * Represents a product with optional variants
 */
export class ProductEntity {
  constructor(
    public readonly id: string,
    public readonly storeId: string,
    public readonly categoryId: string | null,
    public readonly name: string,
    public readonly sku: string,
    public readonly description: string | null,
    public readonly price: Decimal,
    public readonly stock: number,
    public readonly discountPercentage: Decimal | null = null,
    public readonly tokopediaUrl: string | null = null,
    public readonly tiktokShopUrl: string | null = null,
    public readonly shopeeUrl: string | null = null,
    public readonly tocoUrl: string | null = null,
    public readonly variantTier1Name: string | null = null,
    public readonly variantTier2Name: string | null = null,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {
    this.validate();
  }

  /**
   * Validate product data
   */
  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new ValidationError('Product name is required');
    }

    if (this.name.length > 255) {
      throw new ValidationError('Product name is too long (max 255 characters)');
    }

    if (!this.sku || this.sku.trim().length === 0) {
      throw new ValidationError('Product SKU is required');
    }

    if (this.sku.length > 100) {
      throw new ValidationError('Product SKU is too long (max 100 characters)');
    }

    if (this.description && this.description.length > 50000) {
      throw new ValidationError('Product description is too long (max 50000 characters)');
    }

    if (this.price.lessThan(0)) {
      throw new ValidationError('Product price cannot be negative');
    }

    if (this.stock < 0) {
      throw new ValidationError('Product stock cannot be negative');
    }

    if (this.discountPercentage) {
      if (this.discountPercentage.lessThan(0) || this.discountPercentage.greaterThan(100)) {
        throw new ValidationError('Discount percentage must be between 0 and 100');
      }
    }

    // Validate variant tier names
    if (this.variantTier2Name && !this.variantTier1Name) {
      throw new ValidationError('Tier 2 requires Tier 1 to be defined');
    }

    // Validate marketplace URLs if provided
    this.validateMarketplaceUrls();
  }

  /**
   * Validate marketplace URLs
   */
  private validateMarketplaceUrls(): void {
    const urlFields = [
      { name: 'tokopediaUrl', value: this.tokopediaUrl },
      { name: 'tiktokShopUrl', value: this.tiktokShopUrl },
      { name: 'shopeeUrl', value: this.shopeeUrl },
      { name: 'tocoUrl', value: this.tocoUrl },
    ];

    for (const field of urlFields) {
      if (field.value) {
        try {
          new URL(field.value);
        } catch {
          throw new ValidationError(`Invalid ${field.name} format`);
        }
      }
    }
  }

  /**
   * Check if product has variants
   */
  hasVariants(): boolean {
    return !!this.variantTier1Name;
  }

  /**
   * Check if product has two-tier variants
   */
  hasTwoTierVariants(): boolean {
    return !!this.variantTier1Name && !!this.variantTier2Name;
  }

  /**
   * Check if product has discount
   */
  hasDiscount(): boolean {
    return !!this.discountPercentage && this.discountPercentage.greaterThan(0);
  }

  /**
   * Calculate discounted price
   */
  getDiscountedPrice(): Decimal {
    if (!this.hasDiscount() || !this.discountPercentage) {
      return this.price;
    }

    // More efficient: calculate directly without intermediate discount variable
    // (price * (100 - discount%)) / 100
    return this.price.times(new Decimal(100).minus(this.discountPercentage)).dividedBy(100);
  }

  /**
   * Calculate discount amount
   */
  getDiscountAmount(): Decimal {
    if (!this.hasDiscount() || !this.discountPercentage) {
      return new Decimal(0);
    }

    // More efficient: (price * discount%) / 100
    return this.price.times(this.discountPercentage).dividedBy(100);
  }

  /**
   * Check if product is in stock
   */
  isInStock(): boolean {
    return this.stock > 0;
  }

  /**
   * Check if product is low stock
   */
  isLowStock(threshold: number = 10): boolean {
    return this.stock > 0 && this.stock <= threshold;
  }

  /**
   * Update product information
   */
  update(data: {
    name?: string;
    sku?: string;
    description?: string | null;
    price?: Decimal;
    stock?: number;
    discountPercentage?: Decimal | null;
    categoryId?: string | null;
    tokopediaUrl?: string | null;
    tiktokShopUrl?: string | null;
    shopeeUrl?: string | null;
    tocoUrl?: string | null;
    variantTier1Name?: string | null;
    variantTier2Name?: string | null;
  }): ProductEntity {
    // Validate variant tier logic before creating new entity
    const newTier1 = data.variantTier1Name !== undefined ? data.variantTier1Name : this.variantTier1Name;
    const newTier2 = data.variantTier2Name !== undefined ? data.variantTier2Name : this.variantTier2Name;

    if (newTier2 && !newTier1) {
      throw new ValidationError('Cannot set Tier 2 without Tier 1');
    }

    return new ProductEntity(
      this.id,
      this.storeId,
      data.categoryId !== undefined ? data.categoryId : this.categoryId,
      data.name ?? this.name,
      data.sku ?? this.sku,
      data.description !== undefined ? data.description : this.description,
      data.price ?? this.price,
      data.stock ?? this.stock,
      data.discountPercentage !== undefined ? data.discountPercentage : this.discountPercentage,
      data.tokopediaUrl !== undefined ? data.tokopediaUrl : this.tokopediaUrl,
      data.tiktokShopUrl !== undefined ? data.tiktokShopUrl : this.tiktokShopUrl,
      data.shopeeUrl !== undefined ? data.shopeeUrl : this.shopeeUrl,
      data.tocoUrl !== undefined ? data.tocoUrl : this.tocoUrl,
      newTier1,
      newTier2,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Update stock
   */
  updateStock(quantity: number): ProductEntity {
    return new ProductEntity(
      this.id,
      this.storeId,
      this.categoryId,
      this.name,
      this.sku,
      this.description,
      this.price,
      quantity,
      this.discountPercentage,
      this.tokopediaUrl,
      this.tiktokShopUrl,
      this.shopeeUrl,
      this.tocoUrl,
      this.variantTier1Name,
      this.variantTier2Name,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Decrease stock
   */
  decreaseStock(quantity: number): ProductEntity {
    const newStock = this.stock - quantity;
    if (newStock < 0) {
      throw new ValidationError('Insufficient stock');
    }
    return this.updateStock(newStock);
  }

  /**
   * Increase stock
   */
  increaseStock(quantity: number): ProductEntity {
    return this.updateStock(this.stock + quantity);
  }

  /**
   * Convert to plain object
   */
  toObject(): {
    id: string;
    storeId: string;
    categoryId: string | null;
    name: string;
    sku: string;
    description: string | null;
    price: string;
    stock: number;
    discountPercentage: string | null;
    tokopediaUrl: string | null;
    tiktokShopUrl: string | null;
    shopeeUrl: string | null;
    tocoUrl: string | null;
    variantTier1Name: string | null;
    variantTier2Name: string | null;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.id,
      storeId: this.storeId,
      categoryId: this.categoryId,
      name: this.name,
      sku: this.sku,
      description: this.description,
      price: this.price.toFixed(2),
      stock: this.stock,
      discountPercentage: this.discountPercentage?.toFixed(2) ?? null,
      tokopediaUrl: this.tokopediaUrl,
      tiktokShopUrl: this.tiktokShopUrl,
      shopeeUrl: this.shopeeUrl,
      tocoUrl: this.tocoUrl,
      variantTier1Name: this.variantTier1Name,
      variantTier2Name: this.variantTier2Name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Convert to public object
   */
  toPublicObject(): {
    id: string;
    categoryId: string | null;
    name: string;
    sku: string;
    description: string | null;
    price: string;
    discountedPrice?: string;
    discountPercentage: string | null;
    stock: number;
    inStock: boolean;
    marketplaceLinks: {
      tokopedia?: string;
      tiktokShop?: string;
      shopee?: string;
      toco?: string;
    };
    hasVariants: boolean;
    variantTier1Name: string | null;
    variantTier2Name: string | null;
  } {
    const links: Record<string, string> = {};
    if (this.tokopediaUrl) links['tokopedia'] = this.tokopediaUrl;
    if (this.tiktokShopUrl) links['tiktokShop'] = this.tiktokShopUrl;
    if (this.shopeeUrl) links['shopee'] = this.shopeeUrl;
    if (this.tocoUrl) links['toco'] = this.tocoUrl;

    const result: Record<string, unknown> = {
      id: this.id,
      categoryId: this.categoryId,
      name: this.name,
      sku: this.sku,
      description: this.description,
      price: this.price.toFixed(2),
      discountPercentage: this.discountPercentage?.toFixed(2) ?? null,
      stock: this.stock,
      inStock: this.isInStock(),
      marketplaceLinks: links,
      hasVariants: this.hasVariants(),
      variantTier1Name: this.variantTier1Name,
      variantTier2Name: this.variantTier2Name,
    };

    if (this.hasDiscount()) {
      result['discountedPrice'] = this.getDiscountedPrice().toFixed(2);
    }

    return result as ReturnType<ProductEntity['toPublicObject']>;
  }

  /**
   * Create from database row
   */
  static fromDatabase(data: {
    id: string;
    storeId: string;
    categoryId?: string | null;
    name: string;
    sku: string;
    description?: string | null;
    price: string | number;
    stock: number;
    discountPercentage?: string | number | null;
    tokopediaUrl?: string | null;
    tiktokShopUrl?: string | null;
    shopeeUrl?: string | null;
    tocoUrl?: string | null;
    variantTier1Name?: string | null;
    variantTier2Name?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ProductEntity {
    return new ProductEntity(
      data.id,
      data.storeId,
      data.categoryId ?? null,
      data.name,
      data.sku,
      data.description ?? null,
      new Decimal(data.price),
      data.stock,
      data.discountPercentage ? new Decimal(data.discountPercentage) : null,
      data.tokopediaUrl ?? null,
      data.tiktokShopUrl ?? null,
      data.shopeeUrl ?? null,
      data.tocoUrl ?? null,
      data.variantTier1Name ?? null,
      data.variantTier2Name ?? null,
      data.createdAt,
      data.updatedAt
    );
  }

  /**
   * Create new product
   */
  static create(data: {
    id: string;
    storeId: string;
    categoryId?: string | null;
    name: string;
    sku: string;
    description?: string | null;
    price: Decimal | string | number;
    stock: number;
    discountPercentage?: Decimal | string | number | null;
    variantTier1Name?: string | null;
    variantTier2Name?: string | null;
  }): ProductEntity {
    return new ProductEntity(
      data.id,
      data.storeId,
      data.categoryId ?? null,
      data.name,
      data.sku,
      data.description ?? null,
      data.price instanceof Decimal ? data.price : new Decimal(data.price),
      data.stock,
      data.discountPercentage ? 
        (data.discountPercentage instanceof Decimal ? data.discountPercentage : new Decimal(data.discountPercentage)) 
        : null,
      null,
      null,
      null,
      null,
      data.variantTier1Name ?? null,
      data.variantTier2Name ?? null
    );
  }
}