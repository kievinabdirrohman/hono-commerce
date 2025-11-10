import { relations } from "drizzle-orm";
import {
	boolean,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { USER_ROLES } from "@/utils/constants";
import { activityLogs } from "./activity-logs.schema";
import { sessions } from "./sessions.schema";
import { stores } from "./stores.schema";

/**
 * Users table
 * Stores user account information with Google OAuth integration
 */
export const users = pgTable("users", {
	id: uuid("id").defaultRandom().primaryKey(),
	email: varchar("email", { length: 255 }).notNull().unique(),
	name: varchar("name", { length: 255 }).notNull(),
	googleId: varchar("google_id", { length: 255 }).notNull().unique(),
	avatarUrl: text("avatar_url"),
	role: varchar("role", { length: 50 }).notNull().default(USER_ROLES.STAFF),
	isActive: boolean("is_active").notNull().default(true),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

// Indexes for users table
export const usersIndexes = {
	emailIdx: "idx_users_email",
	googleIdIdx: "idx_users_google_id",
	roleIdx: "idx_users_role",
};

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
	store: one(stores, {
		fields: [users.id],
		references: [stores.ownerId],
	}),
	sessions: many(sessions),
	activityLogs: many(activityLogs),
}));

// TypeScript types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
