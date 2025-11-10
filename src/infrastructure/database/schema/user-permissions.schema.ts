import { relations } from "drizzle-orm";
import { pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { permissions } from "./permissions.schema";
import { users } from "./users.schema";

/**
 * User Permissions junction table
 * Maps users (staff) to specific permissions (many-to-many)
 * Allows granular permission assignment per staff member
 */
export const userPermissions = pgTable(
	"user_permissions",
	{
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		permissionId: uuid("permission_id")
			.notNull()
			.references(() => permissions.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.userId, table.permissionId] }),
	}),
);

// Relations
export const userPermissionsRelations = relations(
	userPermissions,
	({ one }) => ({
		user: one(users, {
			fields: [userPermissions.userId],
			references: [users.id],
		}),
		permission: one(permissions, {
			fields: [userPermissions.permissionId],
			references: [permissions.id],
		}),
	}),
);

// TypeScript types
export type UserPermission = typeof userPermissions.$inferSelect;
export type NewUserPermission = typeof userPermissions.$inferInsert;
