import { relations } from "drizzle-orm";
import {
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { productVariants } from "./product-variants.schema";

/**
 * Product Variant Images table
 * Stores images specific to product variants (WebP format, max 150KB)
 */
export const productVariantImages = pgTable(
	"product_variant_images",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		variantId: uuid("variant_id")
			.notNull()
			.references(() => productVariants.id, { onDelete: "cascade" }),

		url: text("url").notNull(), // Cloudinary URL
		publicId: text("public_id").notNull(), // Cloudinary public ID for deletion

		displayOrder: integer("display_order").notNull().default(0), // For ordering images

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => ({
		variantIdIdx: index("idx_product_variant_images_variant_id").on(
			table.variantId,
		),
		orderIdx: index("idx_product_variant_images_order").on(table.displayOrder),
	}),
);

// Relations
export const productVariantImagesRelations = relations(
	productVariantImages,
	({ one }) => ({
		variant: one(productVariants, {
			fields: [productVariantImages.variantId],
			references: [productVariants.id],
		}),
	}),
);

// TypeScript types
export type ProductVariantImage = typeof productVariantImages.$inferSelect;
export type NewProductVariantImage = typeof productVariantImages.$inferInsert;
