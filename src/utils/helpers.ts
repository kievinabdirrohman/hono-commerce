import { nanoid } from "nanoid";
import sanitizeHtml from "sanitize-html";

/**
 * Utility helper functions
 */

// Generate unique ID using nanoid (URL-safe, collision-resistant)
export const generateId = (size: number = 21): string => {
	return nanoid(size);
};

// Generate UUID v4
export const generateUUID = (): string => {
	return crypto.randomUUID();
};

// Sleep function for async delays
export const sleep = (ms: number): Promise<void> => {
	return new Promise((resolve) => setTimeout(resolve, ms));
};

// Retry function with exponential backoff
export const retry = async <T>(
	fn: () => Promise<T>,
	options: {
		maxAttempts?: number;
		delay?: number;
		backoff?: number;
	} = {},
): Promise<T> => {
	const { maxAttempts = 3, delay = 1000, backoff = 2 } = options;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (error) {
			if (attempt === maxAttempts) {
				throw error;
			}
			await sleep(delay * backoff ** (attempt - 1));
		}
	}

	throw new Error("Retry failed");
};

// Parse JSON safely
export const parseJSON = <T = unknown>(json: string, defaultValue: T): T => {
	try {
		return JSON.parse(json) as T;
	} catch {
		return defaultValue;
	}
};

// Sanitize string (basic XSS prevention)
export const sanitizeString = (str: string): string => {
	return str
		.replace(/[<>]/g, "")
		.replace(/javascript:/gi, "")
		.replace(/on\w+=/gi, "")
		.trim();
};

// Sanitize HTML content (for rich text fields)
export const sanitizeHtmlContent = (html: string): string => {
	return sanitizeHtml(html, {
		allowedTags: [
			"h1",
			"h2",
			"h3",
			"h4",
			"h5",
			"h6",
			"p",
			"br",
			"hr",
			"strong",
			"em",
			"u",
			"s",
			"del",
			"ins",
			"ul",
			"ol",
			"li",
			"blockquote",
			"pre",
			"code",
			"a",
			"img",
			"table",
			"thead",
			"tbody",
			"tr",
			"th",
			"td",
			"div",
			"span",
		],
		allowedAttributes: {
			a: ["href", "title", "target", "rel"],
			img: ["src", "alt", "title", "width", "height"],
			div: ["class"],
			span: ["class"],
			code: ["class"],
			pre: ["class"],
		},
		allowedSchemes: ["http", "https", "mailto"],
		allowedSchemesByTag: {
			a: ["http", "https", "mailto"],
			img: ["http", "https", "data"],
		},
		transformTags: {
			a: (tagName, attribs) => {
				// Add noopener noreferrer to external links
				return {
					tagName: "a",
					attribs: {
						...attribs,
						rel: "noopener noreferrer",
						target: attribs["target"] || "_blank",
					},
				};
			},
		},
	});
};

// Validate email format
export const isValidEmail = (email: string): boolean => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
};

// Generate random string
export const randomString = (length: number): string => {
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let result = "";
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
};

// Chunk array into smaller arrays
export const chunkArray = <T>(array: T[], size: number): T[][] => {
	const chunks: T[][] = [];
	for (let i = 0; i < array.length; i += size) {
		chunks.push(array.slice(i, i + size));
	}
	return chunks;
};

// Remove undefined values from object
export const removeUndefined = <T extends Record<string, unknown>>(
	obj: T,
): Partial<T> => {
	return Object.fromEntries(
		Object.entries(obj).filter(([_, value]) => value !== undefined),
	) as Partial<T>;
};

// Deep clone object
export const deepClone = <T>(obj: T): T => {
	return JSON.parse(JSON.stringify(obj)) as T;
};

// Debounce function
export const debounce = <T extends (...args: unknown[]) => unknown>(
	fn: T,
	delay: number,
): ((...args: Parameters<T>) => void) => {
	let timeoutId: ReturnType<typeof setTimeout>;
	return (...args: Parameters<T>) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => fn(...args), delay);
	};
};

// Format bytes to human readable
export const formatBytes = (bytes: number, decimals = 2): string => {
	if (bytes === 0) return "0 Bytes";
	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(decimals))} ${sizes[i]}`;
};

// Get file extension
export const getFileExtension = (filename: string): string => {
	return filename
		.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2)
		.toLowerCase();
};

// Validate file type
export const isValidFileType = (
	mimetype: string,
	allowedTypes: string[],
): boolean => {
	return allowedTypes.some((type) => {
		if (type.endsWith("/*")) {
			return mimetype.startsWith(type.replace("/*", "/"));
		}
		return mimetype === type;
	});
};
