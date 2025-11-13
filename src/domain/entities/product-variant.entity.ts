import { ValidationError } from '@/types/common';
import { Decimal } from 'decimal.js';

/**
 * Product Variant Domain Entity
 * Represents a product variation (Tier 1 required, Tier 2 optional)
 */
export class ProductVariantEntity {
  constructor(
    public readonly id: string,
    public readonly productId: string,
    public readonly sku: string,
    public readonly tier1Value: string,
    public readonly tier2Value: string | null,
    public readonly price: Decimal,
    public readonly stock: number,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {
    this.validate();
  }

  /**
   * Validate variant data
   */
  private validate(): void {
    if (!this.sku || this.sku.trim().length === 0) {
      throw new ValidationError('Variant SKU is required');
    }

    if (this.sku.length > 100) {
      throw new ValidationError('Variant SKU is too long (max 100 characters)');
    }

    if (!this.tier1Value || this.tier1Value.trim().length === 0) {
      throw new ValidationError('Tier 1 value is required for variants');
    }

    if (this.tier1Value.length > 100) {
      throw new ValidationError('Tier 1 value is too long (max 100 characters)');
    }

    if (this.tier2Value && this.tier2Value.length > 100) {
      throw new ValidationError('Tier 2 value is too long (max 100 characters)');
    }

    if (this.price.isNegative()) {
      throw new ValidationError('Variant price cannot be negative');
    }

    if (this.stock < 0) {
      throw new ValidationError('Variant stock cannot be negative');
    }
  }

  /**
   * Check if variant has tier 2
   */
  hasTier2(): boolean {
    return !!this.tier2Value;
  }

  /**
   * Check if variant is in stock
   */
  isInStock(): boolean {
    return this.stock > 0;
  }

  /**
   * Check if variant is low stock
   */
  isLowStock(threshold: number = 10): boolean {
    return this.stock > 0 && this.stock <= threshold;
  }

  /**
   * Get variant display name
   */
  getDisplayName(): string {
    if (this.tier2Value) {
      return `${this.tier1Value} - ${this.tier2Value}`;
    }
    return this.tier1Value;
  }

  /**
   * Update variant information
   */
  update(data: {
    sku?: string;
    tier1Value?: string;
    tier2Value?: string | null;
    price?: Decimal;
    stock?: number;
  }): ProductVariantEntity {
    return new ProductVariantEntity(
      this.id,
      this.productId,
      data.sku ?? this.sku,
      data.tier1Value ?? this.tier1Value,
      data.tier2Value !== undefined ? data.tier2Value : this.tier2Value,
      data.price ?? this.price,
      data.stock ?? this.stock,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Update stock
   */
  updateStock(quantity: number): ProductVariantEntity {
    return new ProductVariantEntity(
      this.id,
      this.productId,
      this.sku,
      this.tier1Value,
      this.tier2Value,
      this.price,
      quantity,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Decrease stock
   */
  decreaseStock(quantity: number): ProductVariantEntity {
    const newStock = this.stock - quantity;
    if (newStock < 0) {
      throw new ValidationError('Insufficient stock for variant');
    }
    return this.updateStock(newStock);
  }

  /**
   * Increase stock
   */
  increaseStock(quantity: number): ProductVariantEntity {
    return this.updateStock(this.stock + quantity);
  }

  /**
   * Convert to plain object
   */
  toObject(): {
    id: string;
    productId: string;
    sku: string;
    tier1Value: string;
    tier2Value: string | null;
    price: string;
    stock: number;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.id,
      productId: this.productId,
      sku: this.sku,
      tier1Value: this.tier1Value,
      tier2Value: this.tier2Value,
      price: this.price.toFixed(2),
      stock: this.stock,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Convert to public object
   */
  toPublicObject(): {
    id: string;
    sku: string;
    tier1Value: string;
    tier2Value: string | null;
    displayName: string;
    price: string;
    stock: number;
    inStock: boolean;
  } {
    return {
      id: this.id,
      sku: this.sku,
      tier1Value: this.tier1Value,
      tier2Value: this.tier2Value,
      displayName: this.getDisplayName(),
      price: this.price.toFixed(2),
      stock: this.stock,
      inStock: this.isInStock(),
    };
  }

  /**
   * Create from database row
   */
  static fromDatabase(data: {
    id: string;
    productId: string;
    sku: string;
    tier1Value: string;
    tier2Value?: string | null;
    price: string | number;
    stock: number;
    createdAt: Date;
    updatedAt: Date;
  }): ProductVariantEntity {
    return new ProductVariantEntity(
      data.id,
      data.productId,
      data.sku,
      data.tier1Value,
      data.tier2Value ?? null,
      new Decimal(data.price),
      data.stock,
      data.createdAt,
      data.updatedAt
    );
  }

  /**
   * Create new variant
   */
  static create(data: {
    id: string;
    productId: string;
    sku: string;
    tier1Value: string;
    tier2Value?: string | null;
    price: Decimal | string | number;
    stock: number;
  }): ProductVariantEntity {
    return new ProductVariantEntity(
      data.id,
      data.productId,
      data.sku,
      data.tier1Value,
      data.tier2Value ?? null,
      data.price instanceof Decimal ? data.price : new Decimal(data.price),
      data.stock
    );
  }

  /**
   * Validate variant set for a product
   * Ensures business rule: Tier 2 can only exist if Tier 1 exists
   * Optimized for performance with early exits
   */
  static validateVariantSet(
    variants: ProductVariantEntity[],
    productTier1Name: string | null,
    productTier2Name: string | null
  ): void {
    // Early exit for empty variants
    if (variants.length === 0) {
      return;
    }

    // Pre-allocate Sets for O(1) lookups
    const skus = new Set<string>();
    const combinations = new Set<string>();
    let hasTier2 = false;

    // Single pass validation - O(n) instead of multiple O(n) passes
    for (const variant of variants) {
      // Validate tier1Value
      if (!variant.tier1Value) {
        throw new ValidationError('All variants must have Tier 1 value');
      }

      // Check SKU uniqueness
      if (skus.has(variant.sku)) {
        throw new ValidationError(`Duplicate variant SKU: ${variant.sku}`);
      }
      skus.add(variant.sku);

      // Check tier2 consistency
      if (variant.tier2Value) {
        hasTier2 = true;
        if (!productTier2Name) {
          throw new ValidationError('Product must have Tier 2 name if variants have Tier 2 values');
        }
      }

      // Check combination uniqueness
      const combination = variant.tier2Value 
        ? `${variant.tier1Value}|${variant.tier2Value}` 
        : variant.tier1Value;
      
      if (combinations.has(combination)) {
        throw new ValidationError(`Duplicate variant combination: ${combination}`);
      }
      combinations.add(combination);
    }

    // If any variant has tier2, all must have it (only checked if hasTier2 is true)
    if (hasTier2) {
      for (const variant of variants) {
        if (!variant.tier2Value) {
          throw new ValidationError('All variants must have Tier 2 value when Tier 2 is defined');
        }
      }
    }
  }
}