import type { Context, Next } from "hono";
import { generateId } from "@/utils/helpers";

/**
 * Request ID middleware
 * Adds a unique request ID to each request for tracing and logging
 */
export const requestId = async (c: Context, next: Next) => {
	// Check if request ID already exists in header, otherwise generate new one
	const existingRequestId = c.req.header("x-request-id");
	const requestId = existingRequestId || generateId(16);

	// Store in context for use in handlers
	c.set("requestId", requestId);

	// Add to response headers
	c.header("x-request-id", requestId);

	await next();
};
