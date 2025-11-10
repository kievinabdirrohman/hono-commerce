import type { Context } from "hono";
import type { ApiResponse, PaginationMeta } from "@/types/common";
import { HTTP_STATUS } from "./constants";

/**
 * Standardized response helpers
 */

// Success response with data
export const successResponse = <T>(
	c: Context,
	data: T,
	statusCode: number = HTTP_STATUS.OK,
) => {
	const response: ApiResponse<T> = {
		success: true,
		data,
	};
	return c.json(response, statusCode as any);
};

// Success response with pagination
export const paginatedResponse = <T>(
	c: Context,
	data: T,
	meta: PaginationMeta,
	statusCode: number = HTTP_STATUS.OK,
) => {
	const response: ApiResponse<T> = {
		success: true,
		data,
		meta,
	};
	return c.json(response, statusCode as any);
};

// Created response (201)
export const createdResponse = <T>(c: Context, data: T) => {
	return successResponse(c, data, HTTP_STATUS.CREATED);
};

// No content response (204)
export const noContentResponse = (c: Context) => {
	return c.body(null, HTTP_STATUS.NO_CONTENT);
};

// Error response
export const errorResponse = (
	c: Context,
	code: string,
	message: string,
	statusCode: number = HTTP_STATUS.BAD_REQUEST,
	details?: Record<string, unknown>,
) => {
	const response: ApiResponse = {
		success: false,
		error: {
			code,
			message,
			...(details && { details }),
		},
	};
	return c.json(response, statusCode as any);
};
