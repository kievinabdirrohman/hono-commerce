import { relations } from "drizzle-orm";
import {
	index,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { products } from "./products.schema";
import { stores } from "./stores.schema";

/**
 * Categories table
 * Product categories with optional icon
 */
export const categories = pgTable(
	"categories",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		storeId: uuid("store_id")
			.notNull()
			.references(() => stores.id, { onDelete: "cascade" }),
		name: varchar("name", { length: 255 }).notNull(),
		description: text("description"),
		iconUrl: text("icon_url"), // SVG icon
		iconPublicId: text("icon_public_id"), // Cloudinary public ID for deletion
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => ({
		storeIdIdx: index("idx_categories_store_id").on(table.storeId),
		nameIdx: index("idx_categories_name").on(table.name),
	}),
);

// Relations
export const categoriesRelations = relations(categories, ({ one, many }) => ({
	store: one(stores, {
		fields: [categories.storeId],
		references: [stores.id],
	}),
	products: many(products),
}));

// TypeScript types
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
