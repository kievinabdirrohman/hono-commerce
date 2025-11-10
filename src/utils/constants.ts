/**
 * Application-wide constants
 * Prevents magic numbers and strings throughout the codebase
 */

// Pagination constants
export const PAGINATION = {
	DEFAULT_LIMIT: 20,
	MAX_LIMIT: 100,
	LOAD_MORE_SIZE: 20,
} as const;

// Bulk operation constants
export const BULK_OPERATIONS = {
	MAX_ITEMS: 500,
	MIN_ITEMS: 1,
	CHUNK_SIZE: 50, // Process in chunks for better performance
} as const;

// Image configuration constants
export const IMAGE_CONFIG = {
	MAX_SIZE_KB: 150,
	MAX_SIZE_BYTES: 150 * 1024, // 150KB in bytes
	PRODUCT_FORMATS: ["webp"] as const,
	ICON_FORMATS: ["svg"] as const,
	ALLOWED_MIMETYPES: {
		WEBP: "image/webp",
		SVG: "image/svg+xml",
	} as const,
} as const;

// Session and token constants
export const SESSION = {
	MAX_SESSIONS_PER_USER: 10, // Maximum concurrent sessions per user
	SESSION_ID_LENGTH: 32,
	ACCESS_TOKEN_EXPIRY: "15m",
	REFRESH_TOKEN_EXPIRY: "7d",
} as const;

// Rate limiting constants
export const RATE_LIMIT = {
	WINDOW_MS: 15 * 60 * 1000, // 15 minutes
	MAX_REQUESTS: 100,
	MAX_PUBLIC_REQUESTS: 50,
	MAX_AUTH_REQUESTS: 5, // For login/logout endpoints
	MAX_UPLOAD_REQUESTS: 10, // For file upload endpoints
	MAX_BULK_REQUESTS: 2, // For bulk operation endpoints
} as const;

// Redis key TTL constants (in seconds)
export const REDIS_TTL = {
	SESSION: 24 * 60 * 60, // 24 hours
	CACHE_SHORT: 5 * 60, // 5 minutes
	CACHE_MEDIUM: 30 * 60, // 30 minutes
	CACHE_LONG: 60 * 60, // 1 hour
	RATE_LIMIT: 15 * 60, // 15 minutes
	QUEUE_JOB: 24 * 60 * 60, // 24 hours
} as const;

// Database constants
export const DATABASE = {
	TRANSACTION_TIMEOUT: 30000, // 30 seconds
	QUERY_TIMEOUT: 10000, // 10 seconds
	POOL_MIN: 2,
	POOL_MAX: 10,
	IDLE_TIMEOUT: 30000,
} as const;

// User roles
export const USER_ROLES = {
	OWNER: "owner",
	STAFF: "staff",
} as const;

// Entity types
export const ENTITY_TYPES = {
	STORE: "store",
	CATEGORY: "category",
	PRODUCT: "product",
	STAFF: "staff",
} as const;

// Action types (for RBAC)
export const ACTION_TYPES = {
	CREATE: "create",
	READ: "read",
	UPDATE: "update",
	DELETE: "delete",
} as const;

// Activity log actions
export const ACTIVITY_ACTIONS = {
	// Auth actions
	LOGIN: "login",
	LOGOUT: "logout",
	LOGOUT_ALL: "logout_all",
	REFRESH_TOKEN: "refresh_token",

	// CRUD actions
	CREATE: "create",
	READ: "read",
	UPDATE: "update",
	DELETE: "delete",
	BULK_CREATE: "bulk_create",
	BULK_UPDATE: "bulk_update",
	BULK_DELETE: "bulk_delete",

	// Permission actions
	GRANT_PERMISSION: "grant_permission",
	REVOKE_PERMISSION: "revoke_permission",

	// Export actions
	EXPORT_DATA: "export_data",
} as const;

// HTTP status codes (for better readability)
export const HTTP_STATUS = {
	OK: 200,
	CREATED: 201,
	NO_CONTENT: 204,
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	UNPROCESSABLE_ENTITY: 422,
	TOO_MANY_REQUESTS: 429,
	INTERNAL_SERVER_ERROR: 500,
	SERVICE_UNAVAILABLE: 503,
} as const;

// Error codes
export const ERROR_CODES = {
	// Validation errors
	VALIDATION_ERROR: "VALIDATION_ERROR",
	INVALID_INPUT: "INVALID_INPUT",

	// Authentication errors
	AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
	INVALID_TOKEN: "INVALID_TOKEN",
	TOKEN_EXPIRED: "TOKEN_EXPIRED",

	// Authorization errors
	AUTHORIZATION_ERROR: "AUTHORIZATION_ERROR",
	INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",

	// Resource errors
	NOT_FOUND: "NOT_FOUND",
	ALREADY_EXISTS: "ALREADY_EXISTS",
	CONFLICT: "CONFLICT",

	// Rate limiting
	RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

	// Server errors
	INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
	DATABASE_ERROR: "DATABASE_ERROR",
	CACHE_ERROR: "CACHE_ERROR",
	EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",

	// File/Upload errors
	FILE_TOO_LARGE: "FILE_TOO_LARGE",
	INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
	UPLOAD_FAILED: "UPLOAD_FAILED",

	// Business logic errors
	TIER2_REQUIRES_TIER1: "TIER2_REQUIRES_TIER1",
	BULK_OPERATION_FAILED: "BULK_OPERATION_FAILED",
	MAX_SESSIONS_EXCEEDED: "MAX_SESSIONS_EXCEEDED",
} as const;

// Marketplace platforms
export const MARKETPLACE_PLATFORMS = {
	TOKOPEDIA: "tokopedia",
	TIKTOK_SHOP: "tiktok_shop",
	SHOPEE: "shopee",
	TOCO: "toco",
} as const;

// Export types for TypeScript
export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];
export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];
export type ActivityAction =
	(typeof ACTIVITY_ACTIONS)[keyof typeof ACTIVITY_ACTIONS];
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];
export type MarketplacePlatform =
	(typeof MARKETPLACE_PLATFORMS)[keyof typeof MARKETPLACE_PLATFORMS];
