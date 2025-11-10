import { relations } from "drizzle-orm";
import {
	index,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users.schema";

/**
 * Sessions table
 * Stores user sessions for multi-device support
 * Each device gets its own session
 */
export const sessions = pgTable(
	"sessions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		// Session tokens
		accessToken: text("access_token").notNull(),
		refreshToken: text("refresh_token").notNull(),

		// Device information
		deviceId: varchar("device_id", { length: 100 }),
		userAgent: text("user_agent"),
		ipAddress: varchar("ip_address", { length: 50 }),

		// Expiry
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => ({
		userIdIdx: index("idx_sessions_user_id").on(table.userId),
		accessTokenIdx: index("idx_sessions_access_token").on(table.accessToken),
		refreshTokenIdx: index("idx_sessions_refresh_token").on(table.refreshToken),
		expiresAtIdx: index("idx_sessions_expires_at").on(table.expiresAt),
	}),
);

// Relations
export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id],
	}),
}));

// TypeScript types
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
