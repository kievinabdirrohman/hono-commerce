// Common types used throughout the application

// API Response types
export interface ApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: ApiError;
	meta?: PaginationMeta;
}

export interface ApiError {
	code: string;
	message: string;
	details?: Record<string, unknown>;
}

// Pagination types
export interface PaginationMeta {
	total: number;
	limit: number;
	hasMore: boolean;
	nextCursor?: string;
}

export interface PaginationParams {
	limit?: number;
	cursor?: string;
}

// User and Authentication types
export type UserRole = "owner" | "staff";

export interface User {
	id: string;
	email: string;
	name: string;
	role: UserRole;
	googleId: string;
	avatarUrl?: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface Session {
	id: string;
	userId: string;
	accessToken: string;
	refreshToken: string;
	deviceInfo?: DeviceInfo;
	expiresAt: Date;
	createdAt: Date;
}

export interface DeviceInfo {
	userAgent?: string;
	ip?: string;
	deviceId?: string;
}

// Permission types
export type EntityType = "store" | "category" | "product" | "staff";
export type ActionType = "create" | "read" | "update" | "delete";

export interface Permission {
	id: string;
	entity: EntityType;
	action: ActionType;
}

// Filter and search types
export interface SearchParams {
	query?: string;
	filters?: Record<string, unknown>;
	sort?: SortParams;
	pagination?: PaginationParams;
}

export interface SortParams {
	field: string;
	order: "asc" | "desc";
}

// Bulk operation types
export interface BulkOperation<T> {
	items: T[];
	operation: "create" | "update" | "delete";
}

export interface BulkResult<T> {
	successful: T[];
	failed: Array<{
		item: T;
		error: string;
	}>;
	total: number;
	successCount: number;
	failureCount: number;
}

// Image types
export interface ImageUpload {
	file: File | Buffer;
	filename: string;
	mimetype: string;
	size: number;
}

export interface ImageMetadata {
	url: string;
	publicId: string;
	width?: number;
	height?: number;
	format: string;
	size: number;
}

// Activity log types
export interface ActivityLog {
	id: string;
	userId: string;
	action: string;
	entityType: string;
	entityId: string;
	changes?: Record<string, unknown>;
	ipAddress?: string;
	deviceInfo?: DeviceInfo;
	createdAt: Date;
}

// Error types
export class AppError extends Error {
	constructor(
		message: string,
		public code: string,
		public statusCode: number = 500,
		public details?: Record<string, unknown>,
	) {
		super(message);
		this.name = "AppError";
		Error.captureStackTrace(this, this.constructor);
	}
}

export class ValidationError extends AppError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, "VALIDATION_ERROR", 400, details);
		this.name = "ValidationError";
	}
}

export class AuthenticationError extends AppError {
	constructor(message: string = "Authentication failed") {
		super(message, "AUTHENTICATION_ERROR", 401);
		this.name = "AuthenticationError";
	}
}

export class AuthorizationError extends AppError {
	constructor(message: string = "Insufficient permissions") {
		super(message, "AUTHORIZATION_ERROR", 403);
		this.name = "AuthorizationError";
	}
}

export class NotFoundError extends AppError {
	constructor(resource: string, identifier?: string) {
		super(
			`${resource}${
				identifier ? ` with identifier '${identifier}'` : ""
			} not found`,
			"NOT_FOUND",
			404,
		);
		this.name = "NotFoundError";
	}
}

export class ConflictError extends AppError {
	constructor(message: string, details?: Record<string, unknown>) {
		super(message, "CONFLICT", 409, details);
		this.name = "ConflictError";
	}
}

export class RateLimitError extends AppError {
	constructor(message: string = "Too many requests") {
		super(message, "RATE_LIMIT_EXCEEDED", 429);
		this.name = "RateLimitError";
	}
}
