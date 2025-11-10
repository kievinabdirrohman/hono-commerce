import { z } from "zod";
import { BULK_OPERATIONS, IMAGE_CONFIG, PAGINATION } from "./constants";

/**
 * Common Zod validation schemas used throughout the application
 */

// Pagination schemas
export const paginationSchema = z.object({
	limit: z.coerce
		.number()
		.int()
		.min(1)
		.max(PAGINATION.MAX_LIMIT)
		.default(PAGINATION.DEFAULT_LIMIT)
		.optional(),
	cursor: z.string().optional(),
});

// ID validation schemas
export const uuidSchema = z.string().uuid("Invalid UUID format");
export const nanoidSchema = z.string().min(1).max(50);

// Email schema
export const emailSchema = z
	.string()
	.email("Invalid email format")
	.toLowerCase()
	.trim()
	.max(255);

// URL schema
export const urlSchema = z.string().url("Invalid URL format").max(2048);

// Optional URL schema (allows empty string or null)
export const optionalUrlSchema = z
	.string()
	.url("Invalid URL format")
	.max(2048)
	.optional()
	.or(z.literal(""))
	.transform((val) => (val === "" ? undefined : val));

// Image file validation
export const imageFileSchema = z.object({
	filename: z.string().min(1),
	mimetype: z.enum([IMAGE_CONFIG.ALLOWED_MIMETYPES.WEBP]),
	size: z
		.number()
		.max(
			IMAGE_CONFIG.MAX_SIZE_BYTES,
			`File size must not exceed ${IMAGE_CONFIG.MAX_SIZE_KB}KB`,
		),
});

// SVG icon validation
export const svgFileSchema = z.object({
	filename: z.string().min(1).endsWith(".svg", "File must be SVG format"),
	mimetype: z.enum([IMAGE_CONFIG.ALLOWED_MIMETYPES.SVG]),
	size: z
		.number()
		.max(
			IMAGE_CONFIG.MAX_SIZE_BYTES,
			`File size must not exceed ${IMAGE_CONFIG.MAX_SIZE_KB}KB`,
		),
});

// Marketplace links schema
export const marketplaceLinksSchema = z
	.object({
		tokopedia: optionalUrlSchema,
		tiktokShop: optionalUrlSchema,
		shopee: optionalUrlSchema,
		toco: optionalUrlSchema,
	})
	.optional();

// Price validation
export const priceSchema = z.coerce
	.number()
	.nonnegative("Price must be non-negative")
	.finite("Price must be a finite number")
	.multipleOf(0.01, "Price can have at most 2 decimal places");

// Stock validation
export const stockSchema = z.coerce
	.number()
	.int("Stock must be an integer")
	.nonnegative("Stock must be non-negative");

// Discount percentage validation
export const discountPercentageSchema = z.coerce
	.number()
	.min(0, "Discount must be at least 0%")
	.max(100, "Discount cannot exceed 100%")
	.multipleOf(0.01, "Discount can have at most 2 decimal places")
	.optional();

// SKU validation
export const skuSchema = z
	.string()
	.min(1, "SKU is required")
	.max(100, "SKU is too long")
	.regex(
		/^[a-zA-Z0-9-_]+$/,
		"SKU can only contain letters, numbers, hyphens, and underscores",
	)
	.trim();

// Sort order validation
export const sortOrderSchema = z.enum(["asc", "desc"]).default("desc");

// Date range validation
export const dateRangeSchema = z
	.object({
		from: z.coerce.date(),
		to: z.coerce.date(),
	})
	.refine((data) => data.from <= data.to, {
		message: "Start date must be before or equal to end date",
	});

// Bulk operation validation
export const bulkItemsSchema = <T extends z.ZodType>(itemSchema: T) =>
	z
		.array(itemSchema)
		.min(
			BULK_OPERATIONS.MIN_ITEMS,
			`At least ${BULK_OPERATIONS.MIN_ITEMS} item is required`,
		)
		.max(
			BULK_OPERATIONS.MAX_ITEMS,
			`Cannot process more than ${BULK_OPERATIONS.MAX_ITEMS} items at once`,
		);

// Search query validation
export const searchQuerySchema = z
	.string()
	.max(255, "Search query is too long")
	.trim()
	.optional();

// Device info validation
export const deviceInfoSchema = z
	.object({
		userAgent: z.string().max(500).optional(),
		ip: z
			.string()
			.regex(
				/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}$/i,
				"Invalid IP address format",
			)
			.max(50)
			.optional(),
		deviceId: z.string().max(100).optional(),
	})
	.optional();

// Name validation (for products, categories, etc.)
export const nameSchema = z
	.string()
	.min(1, "Name is required")
	.max(255, "Name is too long")
	.trim();

// Description validation
export const descriptionSchema = z
	.string()
	.max(5000, "Description is too long")
	.trim()
	.optional();

// Rich text description validation (allows HTML)
export const richTextDescriptionSchema = z
	.string()
	.max(50000, "Description is too long")
	.trim()
	.optional();

// Generic filter validation
export const createFilterSchema = <T extends Record<string, z.ZodType>>(
	filters: T,
) =>
	z.object({
		...filters,
		search: searchQuerySchema,
		sortBy: z.string().optional(),
		sortOrder: sortOrderSchema,
		...paginationSchema.shape,
	});

// IP address validation
export const ipAddressSchema = z
	.string()
	.regex(
		/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}$/i,
		"Invalid IP address format",
	);

// Validate at least one field is provided
export const atLeastOneFieldSchema = <T extends z.ZodRawShape>(shape: T) => {
	const schema = z.object(shape).partial();
	return schema.refine(
		(data) => Object.values(data).some((value) => value !== undefined),
		{ message: "At least one field must be provided" },
	);
};

// File buffer validation
export const fileBufferSchema = z
	.instanceof(Buffer)
	.or(z.instanceof(Uint8Array));

// Export helper type for inferred schemas
export type InferSchema<T extends z.ZodType> = z.infer<T>;
