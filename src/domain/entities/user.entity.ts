import type { UserRole } from '@/utils/constants';

/**
 * User Domain Entity
 * Represents a user in the system (Owner or Staff)
 */
export class UserEntity {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly name: string,
    public readonly googleId: string,
    public readonly role: UserRole,
    public readonly avatarUrl: string | null = null,
    public readonly isActive: boolean = true,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {}

  /**
   * Check if user is owner
   */
  isOwner(): boolean {
    return this.role === 'owner';
  }

  /**
   * Check if user is staff
   */
  isStaff(): boolean {
    return this.role === 'staff';
  }

  /**
   * Check if user can manage other users
   */
  canManageUsers(): boolean {
    return this.isOwner();
  }

  /**
   * Check if user can access activity logs
   */
  canAccessActivityLogs(): boolean {
    return this.isOwner();
  }

  /**
   * Check if user is active
   */
  canLogin(): boolean {
    return this.isActive;
  }

  /**
   * Update user profile
   */
  updateProfile(data: { name?: string; avatarUrl?: string }): UserEntity {
    return new UserEntity(
      this.id,
      this.email,
      data.name ?? this.name,
      this.googleId,
      this.role,
      data.avatarUrl ?? this.avatarUrl,
      this.isActive,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Deactivate user
   */
  deactivate(): UserEntity {
    return new UserEntity(
      this.id,
      this.email,
      this.name,
      this.googleId,
      this.role,
      this.avatarUrl,
      false,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Activate user
   */
  activate(): UserEntity {
    return new UserEntity(
      this.id,
      this.email,
      this.name,
      this.googleId,
      this.role,
      this.avatarUrl,
      true,
      this.createdAt,
      new Date()
    );
  }

  /**
   * Convert to plain object
   */
  toObject(): {
    id: string;
    email: string;
    name: string;
    googleId: string;
    role: UserRole;
    avatarUrl: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      googleId: this.googleId,
      role: this.role,
      avatarUrl: this.avatarUrl,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Convert to public object (safe for API responses)
   */
  toPublicObject(): {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    avatarUrl: string | null;
    createdAt: Date;
  } {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      role: this.role,
      avatarUrl: this.avatarUrl,
      createdAt: this.createdAt,
    };
  }

  /**
   * Create from database row
   */
  static fromDatabase(data: {
    id: string;
    email: string;
    name: string;
    googleId: string;
    role: string;
    avatarUrl?: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): UserEntity {
    return new UserEntity(
      data.id,
      data.email,
      data.name,
      data.googleId,
      data.role as UserRole,
      data.avatarUrl ?? null,
      data.isActive,
      data.createdAt,
      data.updatedAt
    );
  }
}