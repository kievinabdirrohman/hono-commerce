import { relations } from "drizzle-orm";
import {
	decimal,
	index,
	integer,
	pgTable,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { productVariantImages } from "./product-variant-images.schema";
import { products } from "./products.schema";

/**
 * Product Variants table
 * Stores product variations (Tier 1 and optional Tier 2)
 * Business Rule: Tier 2 can only exist if Tier 1 exists
 */
export const productVariants = pgTable(
	"product_variants",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		productId: uuid("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "cascade" }),

		// Variant identification
		sku: varchar("sku", { length: 100 }).notNull().unique(),

		// Tier 1 is required if variants exist
		tier1Value: varchar("tier1_value", { length: 100 }).notNull(), // e.g., "M", "L", "XL"

		// Tier 2 is optional (but requires Tier 1 to exist)
		tier2Value: varchar("tier2_value", { length: 100 }), // e.g., "Red", "Blue"

		// Pricing and stock for this variant
		price: decimal("price", { precision: 12, scale: 2 }).notNull(),
		stock: integer("stock").notNull().default(0),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => ({
		productIdIdx: index("idx_product_variants_product_id").on(table.productId),
		skuIdx: index("idx_product_variants_sku").on(table.sku),
		tier1Idx: index("idx_product_variants_tier1").on(table.tier1Value),
		tier2Idx: index("idx_product_variants_tier2").on(table.tier2Value),
	}),
);

// Relations
export const productVariantsRelations = relations(
	productVariants,
	({ one, many }) => ({
		product: one(products, {
			fields: [productVariants.productId],
			references: [products.id],
		}),
		images: many(productVariantImages),
	}),
);

// TypeScript types
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
