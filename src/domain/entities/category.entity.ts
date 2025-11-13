import { ValidationError } from '@/types/common';

/**
 * Category Domain Entity
 * Represents a product category
 */
export class CategoryEntity {
  constructor(
    public readonly id: string,
    public readonly storeId: string,
    public readonly name: string,
    public readonly description: string | null = null,
    public readonly iconUrl: string | null = null,
    public readonly iconPublicId: string | null = null,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {
    this.validate();
  }

  /**
   * Validate category data
   */
  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new ValidationError('Category name is required');
    }

    if (this.name.length > 255) {
      throw new ValidationError('Category name is too long (max 255 characters)');
    }

    if (this.description && this.description.length > 5000) {
      throw new ValidationError('Category description is too long (max 5000 characters)');
    }
  }

  /**
   * Check if category has icon
   */
  hasIcon(): boolean {
    return !!this.iconUrl;
  }

  /**
   * Update category information
   */
  update(data: {
    name?: string;
    description?: string | null;
  }): CategoryEntity {
    return new CategoryEntity(
      this.id,
      this.storeId,
      data.name ?? this.name,
      data.description !== undefined ? data.description : this.description,
      this.iconUrl,
      this.iconPublicId,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Update category icon
   */
  updateIcon(iconUrl: string, iconPublicId: string): CategoryEntity {
    return new CategoryEntity(
      this.id,
      this.storeId,
      this.name,
      this.description,
      iconUrl,
      iconPublicId,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Remove category icon
   */
  removeIcon(): CategoryEntity {
    return new CategoryEntity(
      this.id,
      this.storeId,
      this.name,
      this.description,
      null,
      null,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Convert to plain object
   */
  toObject(): {
    id: string;
    storeId: string;
    name: string;
    description: string | null;
    iconUrl: string | null;
    iconPublicId: string | null;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.id,
      storeId: this.storeId,
      name: this.name,
      description: this.description,
      iconUrl: this.iconUrl,
      iconPublicId: this.iconPublicId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Convert to public object
   */
  toPublicObject(): {
    id: string;
    name: string;
    description: string | null;
    iconUrl: string | null;
  } {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      iconUrl: this.iconUrl,
    };
  }

  /**
   * Create from database row
   */
  static fromDatabase(data: {
    id: string;
    storeId: string;
    name: string;
    description?: string | null;
    iconUrl?: string | null;
    iconPublicId?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): CategoryEntity {
    return new CategoryEntity(
      data.id,
      data.storeId,
      data.name,
      data.description ?? null,
      data.iconUrl ?? null,
      data.iconPublicId ?? null,
      data.createdAt,
      data.updatedAt
    );
  }

  /**
   * Create new category
   */
  static create(data: {
    id: string;
    storeId: string;
    name: string;
    description?: string | null;
  }): CategoryEntity {
    return new CategoryEntity(
      data.id,
      data.storeId,
      data.name,
      data.description ?? null
    );
  }
}