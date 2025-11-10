import { config } from "@config/env";
import { log } from "@config/logger";
import type { Context } from "hono";
import { ZodError } from "zod";
import {
	type ApiResponse,
	AppError,
	AuthenticationError,
	AuthorizationError,
	ConflictError,
	NotFoundError,
	RateLimitError,
	ValidationError,
} from "@/types/common";
import { ERROR_CODES, HTTP_STATUS } from "@/utils/constants";

/**
 * Format Zod validation errors into a readable format
 */
const formatZodError = (error: ZodError): Record<string, string[]> => {
	const formatted: Record<string, string[]> = {};

	for (const issue of error.issues) {
		const path = issue.path.join(".");
		if (!formatted[path]) {
			formatted[path] = [];
		}
		formatted[path].push(issue.message);
	}

	return formatted;
};

/**
 * Global error handler middleware for Hono
 */
export const errorHandler = (err: Error, c: Context) => {
	// Log error with context
	log.error("Request error", err, {
		method: c.req.method,
		path: c.req.path,
		query: c.req.query(),
		ip: c.req.header("x-forwarded-for") || c.req.header("x-real-ip"),
	});

	// Handle Zod validation errors
	if (err instanceof ZodError) {
		const response: ApiResponse = {
			success: false,
			error: {
				code: ERROR_CODES.VALIDATION_ERROR,
				message: "Validation failed",
				details: {
					fields: formatZodError(err),
				},
			},
		};
		return c.json(response, HTTP_STATUS.BAD_REQUEST);
	}

	// Handle custom application errors
	if (err instanceof AppError) {
		const response: ApiResponse = {
			success: false,
			error: {
				code: err.code,
				message: err.message,
				...(err.details && { details: err.details }),
			},
		};
		return c.json(response, err.statusCode as any);
	}

	// Handle specific error types
	if (err instanceof ValidationError) {
		const response: ApiResponse = {
			success: false,
			error: {
				code: ERROR_CODES.VALIDATION_ERROR,
				message: err.message,
				...(err.details && { details: err.details }),
			},
		};
		return c.json(response, HTTP_STATUS.BAD_REQUEST);
	}

	if (err instanceof AuthenticationError) {
		const response: ApiResponse = {
			success: false,
			error: {
				code: ERROR_CODES.AUTHENTICATION_ERROR,
				message: err.message,
			},
		};
		return c.json(response, HTTP_STATUS.UNAUTHORIZED);
	}

	if (err instanceof AuthorizationError) {
		const response: ApiResponse = {
			success: false,
			error: {
				code: ERROR_CODES.AUTHORIZATION_ERROR,
				message: err.message,
			},
		};
		return c.json(response, HTTP_STATUS.FORBIDDEN);
	}

	if (err instanceof NotFoundError) {
		const response: ApiResponse = {
			success: false,
			error: {
				code: ERROR_CODES.NOT_FOUND,
				message: err.message,
			},
		};
		return c.json(response, HTTP_STATUS.NOT_FOUND);
	}

	if (err instanceof ConflictError) {
		const response: ApiResponse = {
			success: false,
			error: {
				code: ERROR_CODES.CONFLICT,
				message: err.message,
				...(err.details && { details: err.details }),
			},
		};
		return c.json(response, HTTP_STATUS.CONFLICT);
	}

	if (err instanceof RateLimitError) {
		const response: ApiResponse = {
			success: false,
			error: {
				code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
				message: err.message,
			},
		};
		return c.json(response, HTTP_STATUS.TOO_MANY_REQUESTS);
	}

	// Handle PostgreSQL errors
	if ("code" in err && typeof err.code === "string") {
		const pgError = err as {
			code: string;
			detail?: string;
			constraint?: string;
		};

		// Unique constraint violation
		if (pgError.code === "23505") {
			const response: ApiResponse = {
				success: false,
				error: {
					code: ERROR_CODES.ALREADY_EXISTS,
					message: "A record with this value already exists",
					...(config.app.isDevelopment &&
						pgError.detail && {
							details: { detail: pgError.detail },
						}),
				},
			};
			return c.json(response, HTTP_STATUS.CONFLICT);
		}

		// Foreign key violation
		if (pgError.code === "23503") {
			const response: ApiResponse = {
				success: false,
				error: {
					code: ERROR_CODES.VALIDATION_ERROR,
					message: "Referenced record does not exist",
					...(config.app.isDevelopment &&
						pgError.detail && {
							details: { detail: pgError.detail },
						}),
				},
			};
			return c.json(response, HTTP_STATUS.BAD_REQUEST);
		}

		// Not null violation
		if (pgError.code === "23502") {
			const response: ApiResponse = {
				success: false,
				error: {
					code: ERROR_CODES.VALIDATION_ERROR,
					message: "Required field is missing",
					...(config.app.isDevelopment &&
						pgError.detail && {
							details: { detail: pgError.detail },
						}),
				},
			};
			return c.json(response, HTTP_STATUS.BAD_REQUEST);
		}
	}

	// Default internal server error
	const response: ApiResponse = {
		success: false,
		error: {
			code: ERROR_CODES.INTERNAL_SERVER_ERROR,
			message: config.app.isDevelopment
				? err.message
				: "An unexpected error occurred",
			...(config.app.isDevelopment &&
				err.stack && {
					details: { stack: err.stack },
				}),
		},
	};

	return c.json(response, HTTP_STATUS.INTERNAL_SERVER_ERROR);
};

/**
 * Async error wrapper for route handlers
 */
export const asyncHandler = <T>(fn: (c: Context) => Promise<T>) => {
	return async (c: Context) => {
		try {
			return await fn(c);
		} catch (error) {
			throw error; // Will be caught by global error handler
		}
	};
};
