import { ValidationError } from '@/types/common';

/**
 * Store Domain Entity
 * Represents an e-commerce store (one per owner)
 */
export class StoreEntity {
  constructor(
    public readonly id: string,
    public readonly ownerId: string,
    public readonly name: string,
    public readonly description: string | null = null,
    public readonly imageUrl: string | null = null,
    public readonly imagePublicId: string | null = null,
    public readonly tokopediaUrl: string | null = null,
    public readonly tiktokShopUrl: string | null = null,
    public readonly shopeeUrl: string | null = null,
    public readonly tocoUrl: string | null = null,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {
    this.validate();
  }

  /**
   * Validate store data
   */
  private validate(): void {
    if (!this.name || this.name.trim().length === 0) {
      throw new ValidationError('Store name is required');
    }

    if (this.name.length > 255) {
      throw new ValidationError('Store name is too long (max 255 characters)');
    }

    if (this.description && this.description.length > 5000) {
      throw new ValidationError('Store description is too long (max 5000 characters)');
    }

    // Validate marketplace URLs if provided
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
   * Check if store has image
   */
  hasImage(): boolean {
    return !!this.imageUrl;
  }

  /**
   * Check if store has marketplace links
   */
  hasMarketplaceLinks(): boolean {
    return !!(
      this.tokopediaUrl ||
      this.tiktokShopUrl ||
      this.shopeeUrl ||
      this.tocoUrl
    );
  }

  /**
   * Get marketplace links
   */
  getMarketplaceLinks(): {
    tokopedia?: string;
    tiktokShop?: string;
    shopee?: string;
    toco?: string;
  } {
    const links: Record<string, string> = {};

    if (this.tokopediaUrl) links['tokopedia'] = this.tokopediaUrl;
    if (this.tiktokShopUrl) links['tiktokShop'] = this.tiktokShopUrl;
    if (this.shopeeUrl) links['shopee'] = this.shopeeUrl;
    if (this.tocoUrl) links['toco'] = this.tocoUrl;

    return links;
  }

  /**
   * Update store information
   */
  update(data: {
    name?: string;
    description?: string | null;
    tokopediaUrl?: string | null;
    tiktokShopUrl?: string | null;
    shopeeUrl?: string | null;
    tocoUrl?: string | null;
  }): StoreEntity {
    return new StoreEntity(
      this.id,
      this.ownerId,
      data.name ?? this.name,
      data.description !== undefined ? data.description : this.description,
      this.imageUrl,
      this.imagePublicId,
      data.tokopediaUrl !== undefined ? data.tokopediaUrl : this.tokopediaUrl,
      data.tiktokShopUrl !== undefined ? data.tiktokShopUrl : this.tiktokShopUrl,
      data.shopeeUrl !== undefined ? data.shopeeUrl : this.shopeeUrl,
      data.tocoUrl !== undefined ? data.tocoUrl : this.tocoUrl,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Update store image
   */
  updateImage(imageUrl: string, imagePublicId: string): StoreEntity {
    return new StoreEntity(
      this.id,
      this.ownerId,
      this.name,
      this.description,
      imageUrl,
      imagePublicId,
      this.tokopediaUrl,
      this.tiktokShopUrl,
      this.shopeeUrl,
      this.tocoUrl,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Remove store image
   */
  removeImage(): StoreEntity {
    return new StoreEntity(
      this.id,
      this.ownerId,
      this.name,
      this.description,
      null,
      null,
      this.tokopediaUrl,
      this.tiktokShopUrl,
      this.shopeeUrl,
      this.tocoUrl,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Convert to plain object
   */
  toObject(): {
    id: string;
    ownerId: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    imagePublicId: string | null;
    tokopediaUrl: string | null;
    tiktokShopUrl: string | null;
    shopeeUrl: string | null;
    tocoUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.id,
      ownerId: this.ownerId,
      name: this.name,
      description: this.description,
      imageUrl: this.imageUrl,
      imagePublicId: this.imagePublicId,
      tokopediaUrl: this.tokopediaUrl,
      tiktokShopUrl: this.tiktokShopUrl,
      shopeeUrl: this.shopeeUrl,
      tocoUrl: this.tocoUrl,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Convert to public object (safe for API responses)
   */
  toPublicObject(): {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    marketplaceLinks: {
      tokopedia?: string;
      tiktokShop?: string;
      shopee?: string;
      toco?: string;
    };
    createdAt: Date;
  } {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      imageUrl: this.imageUrl,
      marketplaceLinks: this.getMarketplaceLinks(),
      createdAt: this.createdAt,
    };
  }

  /**
   * Create from database row
   */
  static fromDatabase(data: {
    id: string;
    ownerId: string;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    imagePublicId?: string | null;
    tokopediaUrl?: string | null;
    tiktokShopUrl?: string | null;
    shopeeUrl?: string | null;
    tocoUrl?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): StoreEntity {
    return new StoreEntity(
      data.id,
      data.ownerId,
      data.name,
      data.description ?? null,
      data.imageUrl ?? null,
      data.imagePublicId ?? null,
      data.tokopediaUrl ?? null,
      data.tiktokShopUrl ?? null,
      data.shopeeUrl ?? null,
      data.tocoUrl ?? null,
      data.createdAt,
      data.updatedAt
    );
  }

  /**
   * Create new store
   */
  static create(data: {
    id: string;
    ownerId: string;
    name: string;
    description?: string | null;
  }): StoreEntity {
    return new StoreEntity(
      data.id,
      data.ownerId,
      data.name,
      data.description ?? null
    );
  }
}