import { z } from "zod";

// Environment schema validation using Zod
const envSchema = z.object({
	// Application
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	APP_PORT: z
		.string()
		.transform(Number)
		.pipe(z.number().min(1).max(65535))
		.default(3000),
	APP_HOST: z.string().default("0.0.0.0"),
	APP_NAME: z.string().default("E-Commerce API"),

	// Database
	DATABASE_URL: z.string().url(),
	DATABASE_POOL_MIN: z
		.string()
		.transform(Number)
		.pipe(z.number().min(1))
		.default(2),
	DATABASE_POOL_MAX: z
		.string()
		.transform(Number)
		.pipe(z.number().min(1))
		.default(10),
	DATABASE_IDLE_TIMEOUT: z
		.string()
		.transform(Number)
		.pipe(z.number().min(1000))
		.default(30000),
	DATABASE_CONNECTION_TIMEOUT: z
		.string()
		.transform(Number)
		.pipe(z.number().min(1000))
		.default(5000),

	// Redis
	REDIS_HOST: z.string().default("localhost"),
	REDIS_PORT: z
		.string()
		.transform(Number)
		.pipe(z.number().min(1).max(65535))
		.default(6379),
	REDIS_PASSWORD: z.string().optional().default(""),
	REDIS_DB: z
		.string()
		.transform(Number)
		.pipe(z.number().min(0).max(15))
		.default(0),
	REDIS_KEY_PREFIX: z.string().default("ecommerce:"),
	REDIS_SESSION_TTL: z
		.string()
		.transform(Number)
		.pipe(z.number().min(60))
		.default(86400),
	REDIS_CACHE_TTL: z
		.string()
		.transform(Number)
		.pipe(z.number().min(60))
		.default(3600),

	// Google OAuth
	GOOGLE_CLIENT_ID: z.string().min(1),
	GOOGLE_CLIENT_SECRET: z.string().min(1),
	GOOGLE_REDIRECT_URI: z.string().url(),
	GOOGLE_OAUTH_SCOPES: z.string().default("openid profile email"),

	// JWT
	JWT_ACCESS_SECRET: z.string().min(32),
	JWT_REFRESH_SECRET: z.string().min(32),
	JWT_ACCESS_EXPIRY: z.string().default("15m"),
	JWT_REFRESH_EXPIRY: z.string().default("7d"),

	// Cloudinary
	CLOUDINARY_CLOUD_NAME: z.string().min(1),
	CLOUDINARY_API_KEY: z.string().min(1),
	CLOUDINARY_API_SECRET: z.string().min(1),
	CLOUDINARY_FOLDER: z.string().default("ecommerce"),

	// Rate Limiting
	RATE_LIMIT_WINDOW_MS: z
		.string()
		.transform(Number)
		.pipe(z.number().min(1000))
		.default(900000),
	RATE_LIMIT_MAX_REQUESTS: z
		.string()
		.transform(Number)
		.pipe(z.number().min(1))
		.default(100),
	RATE_LIMIT_MAX_PUBLIC: z
		.string()
		.transform(Number)
		.pipe(z.number().min(1))
		.default(50),

	// Bulk Operations
	BULK_MAX_ITEMS: z
		.string()
		.transform(Number)
		.pipe(z.number().min(1).max(500))
		.default(500),
	WORKER_POOL_SIZE: z
		.string()
		.transform(Number)
		.pipe(z.number().min(1).max(16))
		.default(4),

	// Image Configuration
	IMAGE_MAX_SIZE_KB: z
		.string()
		.transform(Number)
		.pipe(z.number().min(1))
		.default(150),
	IMAGE_ALLOWED_FORMATS: z.string().default("webp,svg"),

	// Pagination
	PAGINATION_DEFAULT_LIMIT: z
		.string()
		.transform(Number)
		.pipe(z.number().min(1))
		.default(20),
	PAGINATION_MAX_LIMIT: z
		.string()
		.transform(Number)
		.pipe(z.number().min(1))
		.default(100),

	// CORS
	CORS_ORIGIN: z.string().default("http://localhost:3000"),
	CORS_CREDENTIALS: z
		.string()
		.transform((val) => val === "true")
		.default(true),

	// Logging
	LOG_LEVEL: z
		.enum(["fatal", "error", "warn", "info", "debug", "trace"])
		.default("info"),
	LOG_PRETTY: z
		.string()
		.transform((val) => val === "true")
		.default(true),
});

// Parse and validate environment variables
const parseEnv = () => {
	try {
		return envSchema.parse(process.env);
	} catch (error) {
		if (error instanceof z.ZodError) {
			const missingVars = error.issues
				.map((err) => `${err.path.join(".")}: ${err.message}`)
				.join("\n");
			throw new Error(`❌ Environment validation failed:\n${missingVars}`);
		}
		throw error;
	}
};

// Export validated environment configuration
export const env = parseEnv();

// Export configuration object for easy access
export const config = {
	app: {
		env: env.NODE_ENV,
		port: env.APP_PORT,
		host: env.APP_HOST,
		name: env.APP_NAME,
		isDevelopment: env.NODE_ENV === "development",
		isProduction: env.NODE_ENV === "production",
		isTest: env.NODE_ENV === "test",
	},
	database: {
		url: env.DATABASE_URL,
		poolMin: env.DATABASE_POOL_MIN,
		poolMax: env.DATABASE_POOL_MAX,
		idleTimeout: env.DATABASE_IDLE_TIMEOUT,
		connectionTimeout: env.DATABASE_CONNECTION_TIMEOUT,
	},
	redis: {
		host: env.REDIS_HOST,
		port: env.REDIS_PORT,
		password: env.REDIS_PASSWORD,
		db: env.REDIS_DB,
		keyPrefix: env.REDIS_KEY_PREFIX,
		sessionTTL: env.REDIS_SESSION_TTL,
		cacheTTL: env.REDIS_CACHE_TTL,
	},
	google: {
		clientId: env.GOOGLE_CLIENT_ID,
		clientSecret: env.GOOGLE_CLIENT_SECRET,
		redirectUri: env.GOOGLE_REDIRECT_URI,
		scopes: env.GOOGLE_OAUTH_SCOPES.split(" "),
	},
	jwt: {
		accessSecret: env.JWT_ACCESS_SECRET,
		refreshSecret: env.JWT_REFRESH_SECRET,
		accessExpiry: env.JWT_ACCESS_EXPIRY,
		refreshExpiry: env.JWT_REFRESH_EXPIRY,
	},
	cloudinary: {
		cloudName: env.CLOUDINARY_CLOUD_NAME,
		apiKey: env.CLOUDINARY_API_KEY,
		apiSecret: env.CLOUDINARY_API_SECRET,
		folder: env.CLOUDINARY_FOLDER,
	},
	rateLimit: {
		windowMs: env.RATE_LIMIT_WINDOW_MS,
		maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
		maxPublic: env.RATE_LIMIT_MAX_PUBLIC,
	},
	bulk: {
		maxItems: env.BULK_MAX_ITEMS,
		workerPoolSize: env.WORKER_POOL_SIZE,
	},
	image: {
		maxSizeKB: env.IMAGE_MAX_SIZE_KB,
		allowedFormats: env.IMAGE_ALLOWED_FORMATS.split(","),
	},
	pagination: {
		defaultLimit: env.PAGINATION_DEFAULT_LIMIT,
		maxLimit: env.PAGINATION_MAX_LIMIT,
	},
	cors: {
		origin: env.CORS_ORIGIN.split(","),
		credentials: env.CORS_CREDENTIALS,
	},
	logging: {
		level: env.LOG_LEVEL,
		pretty: env.LOG_PRETTY,
	},
} as const;
