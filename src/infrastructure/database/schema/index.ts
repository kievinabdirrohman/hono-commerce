/**
 * Database schema exports
 * Central export point for all schema definitions
 */

// Activity logging schema
export * from "./activity-logs.schema";
export * from "./categories.schema";
export * from "./permissions.schema";
export * from "./product-images.schema";
export * from "./product-variant-images.schema";
export * from "./product-variants.schema";
export * from "./products.schema";
export * from "./role-permissions.schema";
export * from "./roles.schema";
export * from "./sessions.schema";
// Store and products schemas
export * from "./stores.schema";
export * from "./user-permissions.schema";
// User and authentication schemas
export * from "./users.schema";

import { activityLogsRelations } from "./activity-logs.schema";
import { categoriesRelations } from "./categories.schema";
import { permissionsRelations } from "./permissions.schema";
import { productImagesRelations } from "./product-images.schema";
import { productVariantImagesRelations } from "./product-variant-images.schema";
import { productVariantsRelations } from "./product-variants.schema";
import { productsRelations } from "./products.schema";
import { rolePermissionsRelations } from "./role-permissions.schema";
import { rolesRelations } from "./roles.schema";
import { sessionsRelations } from "./sessions.schema";
import { storesRelations } from "./stores.schema";
import { userPermissionsRelations } from "./user-permissions.schema";
// Export all relations for Drizzle ORM
import { usersRelations } from "./users.schema";

export const relations = {
	usersRelations,
	rolesRelations,
	permissionsRelations,
	rolePermissionsRelations,
	userPermissionsRelations,
	sessionsRelations,
	storesRelations,
	categoriesRelations,
	productsRelations,
	productVariantsRelations,
	productImagesRelations,
	productVariantImagesRelations,
	activityLogsRelations,
};
