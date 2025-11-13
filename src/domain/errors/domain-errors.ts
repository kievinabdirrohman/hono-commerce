/**
 * Domain-Specific Errors
 * Provide clear, actionable error messages for domain violations
 */

import { ValidationError } from '@/types/common';

/**
 * Product Domain Errors
 */
export class InvalidPriceError extends ValidationError {
  constructor(price: number | string) {
    super(`Invalid price: ${price}. Price must be a positive number.`);
    this.name = 'InvalidPriceError';
  }
}

export class InvalidStockError extends ValidationError {
  constructor(stock: number) {
    super(`Invalid stock: ${stock}. Stock must be a non-negative integer.`);
    this.name = 'InvalidStockError';
  }
}

export class InsufficientStockError extends ValidationError {
  constructor(requested: number, available: number) {
    super(`Insufficient stock. Requested: ${requested}, Available: ${available}`);
    this.name = 'InsufficientStockError';
  }
}

export class InvalidDiscountError extends ValidationError {
  constructor(discount: number | string) {
    super(`Invalid discount: ${discount}. Discount must be between 0 and 100.`);
    this.name = 'InvalidDiscountError';
  }
}

export class InvalidSKUError extends ValidationError {
  constructor(sku: string) {
    super(`Invalid SKU: "${sku}". SKU must contain only letters, numbers, hyphens, and underscores.`);
    this.name = 'InvalidSKUError';
  }
}

export class DuplicateSKUError extends ValidationError {
  constructor(sku: string) {
    super(`Duplicate SKU: "${sku}". SKU must be unique.`);
    this.name = 'DuplicateSKUError';
  }
}

/**
 * Variant Domain Errors
 */
export class InvalidVariantTierError extends ValidationError {
  constructor(message: string = 'Tier 2 requires Tier 1 to be defined') {
    super(message);
    this.name = 'InvalidVariantTierError';
  }
}

export class DuplicateVariantCombinationError extends ValidationError {
  constructor(combination: string) {
    super(`Duplicate variant combination: "${combination}". Each combination must be unique.`);
    this.name = 'DuplicateVariantCombinationError';
  }
}

export class InconsistentVariantTierError extends ValidationError {
  constructor() {
    super('All variants must have the same tier structure (all with Tier 2 or all without).');
    this.name = 'InconsistentVariantTierError';
  }
}

/**
 * Store Domain Errors
 */
export class StoreAlreadyExistsError extends ValidationError {
  constructor(ownerId: string) {
    super(`Store already exists for owner: ${ownerId}. Each owner can only have one store.`);
    this.name = 'StoreAlreadyExistsError';
  }
}

export class InvalidStoreNameError extends ValidationError {
  constructor() {
    super('Store name is required and cannot be empty.');
    this.name = 'InvalidStoreNameError';
  }
}

/**
 * URL Domain Errors
 */
export class InvalidURLError extends ValidationError {
  constructor(url: string, field: string) {
    super(`Invalid URL for ${field}: "${url}". Must be a valid HTTP/HTTPS URL.`);
    this.name = 'InvalidURLError';
  }
}

/**
 * Email Domain Errors
 */
export class InvalidEmailError extends ValidationError {
  constructor(email: string) {
    super(`Invalid email address: "${email}".`);
    this.name = 'InvalidEmailError';
  }
}

/**
 * Length Validation Errors
 */
export class FieldTooLongError extends ValidationError {
  constructor(field: string, maxLength: number, actualLength: number) {
    super(`${field} is too long. Maximum: ${maxLength} characters, Got: ${actualLength} characters.`);
    this.name = 'FieldTooLongError';
  }
}

export class FieldRequiredError extends ValidationError {
  constructor(field: string) {
    super(`${field} is required and cannot be empty.`);
    this.name = 'FieldRequiredError';
  }
}

/**
 * Helper function to create domain-specific errors
 */
export function createDomainError(type: string, message: string): ValidationError {
  const error = new ValidationError(message);
  error.name = type;
  return error;
}