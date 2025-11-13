import type { ProductEntity } from '../entities/product.entity';
import { Decimal } from 'decimal.js';

/**
 * Specification Pattern
 * Encapsulates complex business rules for reusability and testability
 */

export interface ISpecification<T> {
  isSatisfiedBy(entity: T): boolean;
  and(other: ISpecification<T>): ISpecification<T>;
  or(other: ISpecification<T>): ISpecification<T>;
  not(): ISpecification<T>;
}

/**
 * Base Specification
 */
abstract class Specification<T> implements ISpecification<T> {
  abstract isSatisfiedBy(entity: T): boolean;

  and(other: ISpecification<T>): ISpecification<T> {
    return new AndSpecification(this, other);
  }

  or(other: ISpecification<T>): ISpecification<T> {
    return new OrSpecification(this, other);
  }

  not(): ISpecification<T> {
    return new NotSpecification(this);
  }
}

class AndSpecification<T> extends Specification<T> {
  constructor(
    private left: ISpecification<T>,
    private right: ISpecification<T>
  ) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return this.left.isSatisfiedBy(entity) && this.right.isSatisfiedBy(entity);
  }
}

class OrSpecification<T> extends Specification<T> {
  constructor(
    private left: ISpecification<T>,
    private right: ISpecification<T>
  ) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return this.left.isSatisfiedBy(entity) || this.right.isSatisfiedBy(entity);
  }
}

class NotSpecification<T> extends Specification<T> {
  constructor(private spec: ISpecification<T>) {
    super();
  }

  isSatisfiedBy(entity: T): boolean {
    return !this.spec.isSatisfiedBy(entity);
  }
}

/**
 * Product Specifications
 */

export class ProductInStockSpecification extends Specification<ProductEntity> {
  isSatisfiedBy(product: ProductEntity): boolean {
    return product.isInStock();
  }
}

export class ProductLowStockSpecification extends Specification<ProductEntity> {
  constructor(private threshold: number = 10) {
    super();
  }

  isSatisfiedBy(product: ProductEntity): boolean {
    return product.isLowStock(this.threshold);
  }
}

export class ProductHasDiscountSpecification extends Specification<ProductEntity> {
  isSatisfiedBy(product: ProductEntity): boolean {
    return product.hasDiscount();
  }
}

export class ProductPriceRangeSpecification extends Specification<ProductEntity> {
  constructor(
    private minPrice: Decimal,
    private maxPrice: Decimal
  ) {
    super();
  }

  isSatisfiedBy(product: ProductEntity): boolean {
    const price = product.hasDiscount() 
      ? product.getDiscountedPrice() 
      : product.price;
    return price.greaterThanOrEqualTo(this.minPrice) && price.lessThanOrEqualTo(this.maxPrice);
  }
}

export class ProductInCategorySpecification extends Specification<ProductEntity> {
  constructor(private categoryId: string) {
    super();
  }

  isSatisfiedBy(product: ProductEntity): boolean {
    return product.categoryId === this.categoryId;
  }
}

export class ProductHasVariantsSpecification extends Specification<ProductEntity> {
  isSatisfiedBy(product: ProductEntity): boolean {
    return product.hasVariants();
  }
}

export class ProductDiscountAboveSpecification extends Specification<ProductEntity> {
  constructor(private minDiscount: Decimal) {
    super();
  }

  isSatisfiedBy(product: ProductEntity): boolean {
    if (!product.hasDiscount() || !product.discountPercentage) {
      return false;
    }
    return product.discountPercentage.greaterThanOrEqualTo(this.minDiscount);
  }
}

/**
 * Complex Product Specifications (Composite)
 */

export class FeaturedProductSpecification extends Specification<ProductEntity> {
  private spec: ISpecification<ProductEntity>;

  constructor() {
    super();
    // Featured products: In stock AND has discount above 10%
    this.spec = new ProductInStockSpecification().and(
      new ProductDiscountAboveSpecification(new Decimal(10))
    );
  }

  isSatisfiedBy(product: ProductEntity): boolean {
    return this.spec.isSatisfiedBy(product);
  }
}

export class AvailableForSaleSpecification extends Specification<ProductEntity> {
  private spec: ISpecification<ProductEntity>;

  constructor() {
    super();
    // Available for sale: In stock AND (no variants OR has variants)
    this.spec = new ProductInStockSpecification();
  }

  isSatisfiedBy(product: ProductEntity): boolean {
    return this.spec.isSatisfiedBy(product);
  }
}

export class ClearanceProductSpecification extends Specification<ProductEntity> {
  private spec: ISpecification<ProductEntity>;

  constructor(lowStockThreshold: number = 10) {
    super();
    // Clearance: Low stock AND has discount
    this.spec = new ProductLowStockSpecification(lowStockThreshold).and(
      new ProductHasDiscountSpecification()
    );
  }

  isSatisfiedBy(product: ProductEntity): boolean {
    return this.spec.isSatisfiedBy(product);
  }
}

/**
 * Usage Examples:
 * 
 * // Single specification
 * const inStock = new ProductInStockSpecification();
 * if (inStock.isSatisfiedBy(product)) {
 *   // Product is in stock
 * }
 * 
 * // Composite specification
 * const availableWithDiscount = new ProductInStockSpecification()
 *   .and(new ProductHasDiscountSpecification());
 * 
 * // Complex specification
 * const featured = new FeaturedProductSpecification();
 * const featuredProducts = products.filter(p => featured.isSatisfiedBy(p));
 * 
 * // Price range specification
 * const priceRange = new ProductPriceRangeSpecification(
 *   new Decimal(10),
 *   new Decimal(50)
 * );
 */