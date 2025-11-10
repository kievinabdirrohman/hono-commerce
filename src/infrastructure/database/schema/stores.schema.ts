import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { categories } from "./categories.schema";
import { products } from "./products.schema";
import { users } from "./users.schema";

/**
 * Stores table
 * One store per owner user
 */
export const stores = pgTable("stores", {
	id: uuid("id").defaultRandom().primaryKey(),
	ownerId: uuid("owner_id")
		.notNull()
		.unique()
		.references(() => users.id, { onDelete: "cascade" }),
	name: varchar("name", { length: 255 }).notNull(),
	description: text("description"),
	imageUrl: text("image_url"), // WebP image, max 150KB
	imagePublicId: text("image_public_id"), // Cloudinary public ID for deletion

	// Marketplace links
	tokopediaUrl: text("tokopedia_url"),
	tiktokShopUrl: text("tiktok_shop_url"),
	shopeeUrl: text("shopee_url"),
	tocoUrl: text("toco_url"),

	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

// Indexes
export const storesIndexes = {
	ownerIdIdx: "idx_stores_owner_id",
};

// Relations
export const storesRelations = relations(stores, ({ one, many }) => ({
	owner: one(users, {
		fields: [stores.ownerId],
		references: [users.id],
	}),
	categories: many(categories),
	products: many(products),
}));

// TypeScript types
export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;
