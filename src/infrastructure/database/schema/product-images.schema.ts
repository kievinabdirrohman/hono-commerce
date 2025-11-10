import { relations } from "drizzle-orm";
import {
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { products } from "./products.schema";

/**
 * Product Images table
 * Stores multiple images for products (WebP format, max 150KB)
 */
export const productImages = pgTable(
	"product_images",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		productId: uuid("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "cascade" }),

		url: text("url").notNull(), // Cloudinary URL
		publicId: text("public_id").notNull(), // Cloudinary public ID for deletion

		displayOrder: integer("display_order").notNull().default(0), // For ordering images

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => ({
		productIdIdx: index("idx_product_images_product_id").on(table.productId),
		orderIdx: index("idx_product_images_order").on(table.displayOrder),
	}),
);

// Relations
export const productImagesRelations = relations(productImages, ({ one }) => ({
	product: one(products, {
		fields: [productImages.productId],
		references: [products.id],
	}),
}));

// TypeScript types
export type ProductImage = typeof productImages.$inferSelect;
export type NewProductImage = typeof productImages.$inferInsert;
