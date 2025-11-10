import { relations } from "drizzle-orm";
import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users.schema";

/**
 * Activity Logs table
 * Tracks all CRUD operations and important actions (Owner only access)
 */
export const activityLogs = pgTable(
	"activity_logs",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		// Action details
		action: varchar("action", { length: 50 }).notNull(), // create, read, update, delete, login, logout, etc.
		entityType: varchar("entity_type", { length: 50 }).notNull(), // store, category, product, staff, etc.
		entityId: varchar("entity_id", { length: 100 }), // ID of affected entity

		// Changes (before/after for updates)
		changes: jsonb("changes"), // { before: {...}, after: {...} }

		// Request details
		ipAddress: varchar("ip_address", { length: 50 }),
		userAgent: text("user_agent"),
		deviceInfo: jsonb("device_info"), // Additional device metadata

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => ({
		userIdIdx: index("idx_activity_logs_user_id").on(table.userId),
		actionIdx: index("idx_activity_logs_action").on(table.action),
		entityTypeIdx: index("idx_activity_logs_entity_type").on(table.entityType),
		entityIdIdx: index("idx_activity_logs_entity_id").on(table.entityId),
		createdAtIdx: index("idx_activity_logs_created_at").on(table.createdAt),
	}),
);

// Relations
export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
	user: one(users, {
		fields: [activityLogs.userId],
		references: [users.id],
	}),
}));

// TypeScript types
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
