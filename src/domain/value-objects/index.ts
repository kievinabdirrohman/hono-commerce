import { ValidationError } from '@/types/common';

/**
 * Value Objects
 * Immutable objects that represent domain concepts
 */

/**
 * Money Value Object
 */
export class Money {
  constructor(
    public readonly amount: number,
    public readonly currency: string = 'USD'
  ) {
    if (amount < 0) {
      throw new ValidationError('Amount cannot be negative');
    }
    if (!currency || currency.length !== 3) {
      throw new ValidationError('Invalid currency code');
    }
  }

  add(other: Money): Money {
    this.ensureSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.ensureSameCurrency(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return new Money(this.amount * factor, this.currency);
  }

  divide(divisor: number): Money {
    if (divisor === 0) {
      throw new ValidationError('Cannot divide by zero');
    }
    return new Money(this.amount / divisor, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  private ensureSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new ValidationError('Cannot operate on different currencies');
    }
  }

  toString(): string {
    return `${this.currency} ${this.amount.toFixed(2)}`;
  }
}

/**
 * Email Value Object
 */
export class Email {
  private readonly value: string;

  constructor(email: string) {
    if (!this.isValid(email)) {
      throw new ValidationError('Invalid email format');
    }
    this.value = email.toLowerCase().trim();
  }

  private isValid(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value === other.getValue();
  }

  toString(): string {
    return this.value;
  }
}

/**
 * URL Value Object
 */
export class WebUrl {
  private readonly value: string;

  constructor(url: string) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Only HTTP(S) protocols allowed');
      }
      this.value = url;
    } catch (error) {
      throw new ValidationError('Invalid URL format');
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: WebUrl): boolean {
    return this.value === other.getValue();
  }

  toString(): string {
    return this.value;
  }
}

/**
 * SKU Value Object
 */
export class SKU {
  private readonly value: string;

  constructor(sku: string) {
    const cleaned = sku.trim().toUpperCase();

    if (!cleaned || cleaned.length === 0) {
      throw new ValidationError('SKU cannot be empty');
    }

    if (cleaned.length > 100) {
      throw new ValidationError('SKU is too long (max 100 characters)');
    }

    if (!/^[A-Z0-9-_]+$/.test(cleaned)) {
      throw new ValidationError('SKU can only contain letters, numbers, hyphens, and underscores');
    }

    this.value = cleaned;
  }

  getValue(): string {
    return this.value;
  }

  equals(other: SKU): boolean {
    return this.value === other.getValue();
  }

  toString(): string {
    return this.value;
  }
}

/**
 * Percentage Value Object
 */
export class Percentage {
  private readonly value: number;

  constructor(value: number) {
    if (value < 0 || value > 100) {
      throw new ValidationError('Percentage must be between 0 and 100');
    }
    this.value = value;
  }

  getValue(): number {
    return this.value;
  }

  toDecimal(): number {
    return this.value / 100;
  }

  equals(other: Percentage): boolean {
    return this.value === other.getValue();
  }

  toString(): string {
    return `${this.value}%`;
  }
}

/**
 * Stock Quantity Value Object
 */
export class StockQuantity {
  private readonly value: number;

  constructor(quantity: number) {
    if (!Number.isInteger(quantity)) {
      throw new ValidationError('Stock quantity must be an integer');
    }
    if (quantity < 0) {
      throw new ValidationError('Stock quantity cannot be negative');
    }
    this.value = quantity;
  }

  getValue(): number {
    return this.value;
  }

  isAvailable(): boolean {
    return this.value > 0;
  }

  isLow(threshold: number = 10): boolean {
    return this.value > 0 && this.value <= threshold;
  }

  add(amount: number): StockQuantity {
    return new StockQuantity(this.value + amount);
  }

  subtract(amount: number): StockQuantity {
    return new StockQuantity(this.value - amount);
  }

  equals(other: StockQuantity): boolean {
    return this.value === other.getValue();
  }

  toString(): string {
    return this.value.toString();
  }
}

/**
 * Image Value Object
 */
export class Image {
  constructor(
    public readonly url: string,
    public readonly publicId: string,
    public readonly displayOrder: number = 0
  ) {
    if (!url || url.trim().length === 0) {
      throw new ValidationError('Image URL is required');
    }
    if (!publicId || publicId.trim().length === 0) {
      throw new ValidationError('Image public ID is required');
    }
    if (displayOrder < 0) {
      throw new ValidationError('Display order cannot be negative');
    }
  }

  equals(other: Image): boolean {
    return this.publicId === other.publicId;
  }

  toObject(): {
    url: string;
    publicId: string;
    displayOrder: number;
  } {
    return {
      url: this.url,
      publicId: this.publicId,
      displayOrder: this.displayOrder,
    };
  }
}