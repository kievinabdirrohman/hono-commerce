import pino from "pino";
import { config } from "./env";

// Redact sensitive fields from logs
const REDACT_FIELDS = [
	"password",
	"token",
	"accessToken",
	"refreshToken",
	"authorization",
	"cookie",
	"secret",
	"apiKey",
	"api_key",
	"client_secret",
	"DATABASE_URL",
	"REDIS_PASSWORD",
	"JWT_ACCESS_SECRET",
	"JWT_REFRESH_SECRET",
	"CLOUDINARY_API_SECRET",
	"GOOGLE_CLIENT_SECRET",
];

// Create Pino logger instance
export const logger = pino({
	level: config.logging.level,
	redact: {
		paths: REDACT_FIELDS,
		censor: "[REDACTED]",
	},
	serializers: {
		req: (req) => ({
			method: req.method,
			url: req.url,
			headers: {
				host: req.headers?.host,
				"user-agent": req.headers?.["user-agent"],
			},
			remoteAddress: req.socket?.remoteAddress,
		}),
		res: (res) => ({
			statusCode: res.statusCode,
		}),
		err: pino.stdSerializers.err,
	},
	transport:
		config.logging.pretty && config.app.isDevelopment
			? {
					target: "pino-pretty",
					options: {
						colorize: true,
						translateTime: "HH:MM:ss",
						ignore: "pid,hostname",
						singleLine: false,
					},
				}
			: undefined,
	base: {
		env: config.app.env,
		app: config.app.name,
	},
	timestamp: pino.stdTimeFunctions.isoTime,
	formatters: {
		level: (label) => {
			return { level: label };
		},
	},
});

// Create child loggers for different contexts
export const createLogger = (context: string) => {
	return logger.child({ context });
};

// Export typed logger methods
export const log = {
	fatal: (
		message: string,
		error?: Error | unknown,
		data?: Record<string, unknown>,
	) => {
		if (error instanceof Error) {
			logger.fatal({ ...data, err: error }, message);
		} else {
			logger.fatal({ ...data, error }, message);
		}
	},
	error: (
		message: string,
		error?: Error | unknown,
		data?: Record<string, unknown>,
	) => {
		if (error instanceof Error) {
			logger.error({ ...data, err: error }, message);
		} else {
			logger.error({ ...data, error }, message);
		}
	},
	warn: (message: string, data?: Record<string, unknown>) =>
		logger.warn(data, message),
	info: (message: string, data?: Record<string, unknown>) =>
		logger.info(data, message),
	debug: (message: string, data?: Record<string, unknown>) =>
		logger.debug(data, message),
	trace: (message: string, data?: Record<string, unknown>) =>
		logger.trace(data, message),
};

// Export logger type for dependency injection
export type Logger = typeof logger;
