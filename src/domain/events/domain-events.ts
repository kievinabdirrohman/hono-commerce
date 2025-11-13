/**
 * Domain Events
 * Events that represent something that happened in the domain
 */

export interface IDomainEvent {
  readonly occurredOn: Date;
  readonly eventName: string;
  readonly aggregateId: string;
}

/**
 * Base Domain Event
 */
abstract class DomainEvent implements IDomainEvent {
  public readonly occurredOn: Date;

  constructor(
    public readonly eventName: string,
    public readonly aggregateId: string
  ) {
    this.occurredOn = new Date();
  }
}

/**
 * Product Domain Events
 */

export class ProductCreatedEvent extends DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly storeId: string,
    public readonly productName: string
  ) {
    super('ProductCreated', productId);
  }
}

export class ProductUpdatedEvent extends DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly changes: Record<string, unknown>
  ) {
    super('ProductUpdated', productId);
  }
}

export class ProductDeletedEvent extends DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly storeId: string
  ) {
    super('ProductDeleted', productId);
  }
}

export class ProductStockChangedEvent extends DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly oldStock: number,
    public readonly newStock: number
  ) {
    super('ProductStockChanged', productId);
  }
}

export class ProductOutOfStockEvent extends DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly productName: string
  ) {
    super('ProductOutOfStock', productId);
  }
}

export class ProductLowStockEvent extends DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly productName: string,
    public readonly currentStock: number,
    public readonly threshold: number
  ) {
    super('ProductLowStock', productId);
  }
}

export class ProductPriceChangedEvent extends DomainEvent {
  constructor(
    public readonly productId: string,
    public readonly oldPrice: string,
    public readonly newPrice: string
  ) {
    super('ProductPriceChanged', productId);
  }
}

/**
 * Variant Domain Events
 */

export class ProductVariantCreatedEvent extends DomainEvent {
  constructor(
    public readonly variantId: string,
    public readonly productId: string,
    public readonly sku: string
  ) {
    super('ProductVariantCreated', variantId);
  }
}

export class ProductVariantStockChangedEvent extends DomainEvent {
  constructor(
    public readonly variantId: string,
    public readonly productId: string,
    public readonly oldStock: number,
    public readonly newStock: number
  ) {
    super('ProductVariantStockChanged', variantId);
  }
}

/**
 * Store Domain Events
 */

export class StoreCreatedEvent extends DomainEvent {
  constructor(
    public readonly storeId: string,
    public readonly ownerId: string,
    public readonly storeName: string
  ) {
    super('StoreCreated', storeId);
  }
}

export class StoreUpdatedEvent extends DomainEvent {
  constructor(
    public readonly storeId: string,
    public readonly changes: Record<string, unknown>
  ) {
    super('StoreUpdated', storeId);
  }
}

/**
 * Category Domain Events
 */

export class CategoryCreatedEvent extends DomainEvent {
  constructor(
    public readonly categoryId: string,
    public readonly storeId: string,
    public readonly categoryName: string
  ) {
    super('CategoryCreated', categoryId);
  }
}

export class CategoryDeletedEvent extends DomainEvent {
  constructor(
    public readonly categoryId: string,
    public readonly storeId: string,
    public readonly productCount: number
  ) {
    super('CategoryDeleted', categoryId);
  }
}

/**
 * Domain Event Dispatcher
 */
type EventHandler<T extends IDomainEvent> = (event: T) => void | Promise<void>;

export class DomainEventDispatcher {
  private handlers: Map<string, EventHandler<IDomainEvent>[]> = new Map();

  /**
   * Register event handler
   */
  register<T extends IDomainEvent>(eventName: string, handler: EventHandler<T>): void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName)!.push(handler as EventHandler<IDomainEvent>);
  }

  /**
   * Dispatch event to all registered handlers
   */
  async dispatch(event: IDomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventName) || [];
    
    await Promise.all(
      handlers.map(handler => Promise.resolve(handler(event)))
    );
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * Clear handlers for specific event
   */
  clearEvent(eventName: string): void {
    this.handlers.delete(eventName);
  }
}

// Export singleton dispatcher
export const domainEventDispatcher = new DomainEventDispatcher();

/**
 * Usage Examples:
 * 
 * // Register handler
 * domainEventDispatcher.register('ProductCreated', async (event) => {
 *   await activityLogService.log({
 *     action: 'create',
 *     entityType: 'product',
 *     entityId: event.productId,
 *   });
 * });
 * 
 * // Dispatch event
 * const event = new ProductCreatedEvent(product.id, product.storeId, product.name);
 * await domainEventDispatcher.dispatch(event);
 * 
 * // Register low stock alert
 * domainEventDispatcher.register('ProductLowStock', async (event) => {
 *   await notificationService.sendLowStockAlert(event.productId, event.currentStock);
 * });
 */