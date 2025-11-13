import type { IDomainEvent } from '../events/domain-events';

/**
 * Aggregate Root Base Class
 * Manages domain events for aggregates
 */
export abstract class AggregateRoot {
  private _domainEvents: IDomainEvent[] = [];

  /**
   * Get all domain events
   */
  get domainEvents(): ReadonlyArray<IDomainEvent> {
    return this._domainEvents;
  }

  /**
   * Add domain event
   */
  protected addDomainEvent(event: IDomainEvent): void {
    this._domainEvents.push(event);
  }

  /**
   * Clear all domain events
   */
  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  /**
   * Check if aggregate has events
   */
  hasDomainEvents(): boolean {
    return this._domainEvents.length > 0;
  }
}

/**
 * Product Aggregate Root
 * Manages Product + ProductVariants as a single aggregate
 */
import { ProductEntity } from './product.entity';
import { ProductVariantEntity } from './product-variant.entity';
import {
  ProductCreatedEvent,
  ProductUpdatedEvent,
  ProductStockChangedEvent,
  ProductLowStockEvent,
  ProductOutOfStockEvent,
} from '../events/domain-events';

export class ProductAggregate extends AggregateRoot {
  constructor(
    public readonly product: ProductEntity,
    public readonly variants: ProductVariantEntity[] = []
  ) {
    super();
  }

  /**
   * Create new product aggregate
   */
  static create(product: ProductEntity, variants: ProductVariantEntity[] = []): ProductAggregate {
    const aggregate = new ProductAggregate(product, variants);
    
    // Validate variants if present
    if (variants.length > 0) {
      ProductVariantEntity.validateVariantSet(
        variants,
        product.variantTier1Name,
        product.variantTier2Name
      );
    }

    // Add domain event
    aggregate.addDomainEvent(
      new ProductCreatedEvent(product.id, product.storeId, product.name)
    );

    return aggregate;
  }

  /**
   * Update product
   */
  updateProduct(updates: Parameters<ProductEntity['update']>[0]): ProductAggregate {
    const updatedProduct = this.product.update(updates);
    const aggregate = new ProductAggregate(updatedProduct, this.variants);

    aggregate.addDomainEvent(
      new ProductUpdatedEvent(this.product.id, updates)
    );

    return aggregate;
  }

  /**
   * Add variant
   */
  addVariant(variant: ProductVariantEntity): ProductAggregate {
    const newVariants = [...this.variants, variant];
    
    // Validate new variant set
    ProductVariantEntity.validateVariantSet(
      newVariants,
      this.product.variantTier1Name,
      this.product.variantTier2Name
    );

    return new ProductAggregate(this.product, newVariants);
  }

  /**
   * Update stock and emit events if needed
   */
  updateStock(newStock: number, lowStockThreshold: number = 10): ProductAggregate {
    const oldStock = this.product.stock;
    const updatedProduct = this.product.updateStock(newStock);
    const aggregate = new ProductAggregate(updatedProduct, this.variants);

    // Emit stock changed event
    aggregate.addDomainEvent(
      new ProductStockChangedEvent(this.product.id, oldStock, newStock)
    );

    // Emit low stock warning
    if (newStock > 0 && newStock <= lowStockThreshold) {
      aggregate.addDomainEvent(
        new ProductLowStockEvent(
          this.product.id,
          this.product.name,
          newStock,
          lowStockThreshold
        )
      );
    }

    // Emit out of stock event
    if (newStock === 0 && oldStock > 0) {
      aggregate.addDomainEvent(
        new ProductOutOfStockEvent(this.product.id, this.product.name)
      );
    }

    return aggregate;
  }

  /**
   * Get total stock (product + all variants)
   */
  getTotalStock(): number {
    if (this.variants.length === 0) {
      return this.product.stock;
    }

    return this.variants.reduce((total, variant) => total + variant.stock, 0);
  }

  /**
   * Check if any variant is in stock
   */
  hasStockAvailable(): boolean {
    if (this.variants.length === 0) {
      return this.product.isInStock();
    }

    return this.variants.some(v => v.isInStock());
  }

  /**
   * Get variant by ID
   */
  getVariant(variantId: string): ProductVariantEntity | undefined {
    return this.variants.find(v => v.id === variantId);
  }

  /**
   * Get variants by tier1 value
   */
  getVariantsByTier1(tier1Value: string): ProductVariantEntity[] {
    return this.variants.filter(v => v.tier1Value === tier1Value);
  }

  /**
   * Get lowest price (considering all variants)
   */
  getLowestPrice(): string {
    if (this.variants.length === 0) {
      return this.product.hasDiscount()
        ? this.product.getDiscountedPrice().toFixed(2)
        : this.product.price.toFixed(2);
    }

    const prices = this.variants.map(v => v.price.toNumber());
    return Math.min(...prices).toFixed(2);
  }

  /**
   * Get highest price (considering all variants)
   */
  getHighestPrice(): string {
    if (this.variants.length === 0) {
      return this.product.price.toFixed(2);
    }

    const prices = this.variants.map(v => v.price.toNumber());
    return Math.max(...prices).toFixed(2);
  }
}

/**
 * Usage Examples:
 * 
 * // Create product aggregate
 * const aggregate = ProductAggregate.create(product, variants);
 * 
 * // Get domain events
 * const events = aggregate.domainEvents; // [ProductCreatedEvent]
 * 
 * // Dispatch events
 * for (const event of events) {
 *   await domainEventDispatcher.dispatch(event);
 * }
 * 
 * // Clear events after dispatching
 * aggregate.clearDomainEvents();
 * 
 * // Update stock with automatic event generation
 * const updated = aggregate.updateStock(5, 10);
 * // Events: [ProductStockChangedEvent, ProductLowStockEvent]
 */