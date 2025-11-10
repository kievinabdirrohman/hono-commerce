import { relations } from "drizzle-orm";
import {
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { rolePermissions } from "./role-permissions.schema";
import { userPermissions } from "./user-permissions.schema";

/**
 * Permissions table
 * Defines granular permissions for entities and actions
 */
export const permissions = pgTable(
	"permissions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		entity: varchar("entity", { length: 50 }).notNull(), // store, category, product, staff
		action: varchar("action", { length: 50 }).notNull(), // create, read, update, delete
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => ({
		entityActionIdx: uniqueIndex("idx_permissions_entity_action").on(
			table.entity,
			table.action,
		),
	}),
);

// Relations
export const permissionsRelations = relations(permissions, ({ many }) => ({
	rolePermissions: many(rolePermissions),
	userPermissions: many(userPermissions),
}));

// TypeScript types
export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
