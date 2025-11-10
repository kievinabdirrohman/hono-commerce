// Extension types for Hono Context
import type { Context, Next } from "hono";

declare module "hono" {
	interface ContextVariableMap {
		requestId: string;
	}
}
