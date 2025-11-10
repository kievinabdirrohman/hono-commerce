import { relations } from "drizzle-orm";
import {
	decimal,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { categories } from "./categories.schema";
import { productImages } from "./product-images.schema";
import { productVariants } from "./product-variants.schema";
import { stores } from "./stores.schema";

/**
 * Products table
 * Main product information
 */
export const products = pgTable(
	"products",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		storeId: uuid("store_id")
			.notNull()
			.references(() => stores.id, { onDelete: "cascade" }),
		categoryId: uuid("category_id").references(() => categories.id, {
			onDelete: "set null",
		}),

		// Basic information
		name: varchar("name", { length: 255 }).notNull(),
		sku: varchar("sku", { length: 100 }).notNull(),
		description: text("description"), // Rich text from editor (sanitized HTML)

		// Pricing and stock (for products without variants)
		price: decimal("price", { precision: 12, scale: 2 }).notNull(),
		stock: integer("stock").notNull().default(0),
		discountPercentage: decimal("discount_percentage", {
			precision: 5,
			scale: 2,
		}), // 0.00 to 100.00

		// Marketplace links
		tokopediaUrl: text("tokopedia_url"),
		tiktokShopUrl: text("tiktok_shop_url"),
		shopeeUrl: text("shopee_url"),
		tocoUrl: text("toco_url"),

		// Variant tier names (if product has variants)
		variantTier1Name: varchar("variant_tier1_name", { length: 100 }), // e.g., "Size"
		variantTier2Name: varchar("variant_tier2_name", { length: 100 }), // e.g., "Color"

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => ({
		storeIdIdx: index("idx_products_store_id").on(table.storeId),
		categoryIdIdx: index("idx_products_category_id").on(table.categoryId),
		skuIdx: index("idx_products_sku").on(table.sku),
		nameIdx: index("idx_products_name").on(table.name),
		priceIdx: index("idx_products_price").on(table.price),
	}),
);

// Relations
export const productsRelations = relations(products, ({ one, many }) => ({
	store: one(stores, {
		fields: [products.storeId],
		references: [stores.id],
	}),
	category: one(categories, {
		fields: [products.categoryId],
		references: [categories.id],
	}),
	variants: many(productVariants),
	images: many(productImages),
}));

// TypeScript types
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
