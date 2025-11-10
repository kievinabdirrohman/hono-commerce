import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { rolePermissions } from "./role-permissions.schema";

/**
 * Roles table
 * Defines user roles (Owner, Staff)
 */
export const roles = pgTable("roles", {
	id: uuid("id").defaultRandom().primaryKey(),
	name: varchar("name", { length: 50 }).notNull().unique(),
	description: text("description"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

// Relations
export const rolesRelations = relations(roles, ({ many }) => ({
	rolePermissions: many(rolePermissions),
}));

// TypeScript types
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
