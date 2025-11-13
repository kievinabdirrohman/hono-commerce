import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import { config } from '@config/env';
import { log } from '@config/logger';
import { errorHandler } from '@middlewares/error-handler';
import { requestId } from '@middlewares/request-id';
import { HTTP_STATUS } from '@/utils/constants';

// Create Hono application
export const app = new Hono();

// Request ID middleware (first to ensure all requests have an ID)
app.use('*', requestId);

// Global middlewares
app.use('*', async (c, next) => {
  // Request logging
  const start = Date.now();
  const requestId = c.get('requestId');
  
  await next();
  
  const duration = Date.now() - start;

  log.info('HTTP Request', {
    requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    duration: `${duration}ms`,
    ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
    userAgent: c.req.header('user-agent'),
  });
});

// Security headers
app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
  },
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
  referrerPolicy: 'strict-origin-when-cross-origin',
  strictTransportSecurity: 'max-age=31536000; includeSubDomains',
}));

// CORS configuration
app.use('*', cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
}));

// Pretty JSON in development
if (config.app.isDevelopment) {
  app.use('*', prettyJSON());
}

// Health check endpoint
app.get('/health', async (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.app.env,
  });
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    message: 'E-Commerce API',
    version: '1.0.0',
    environment: config.app.env,
    documentation: '/api/docs',
  });
});

// API Routes
import authRoutes from '@presentation/routes/auth.routes';
import storeRoutes from '@presentation/routes/store.routes';

app.route('/api/auth', authRoutes);
app.route('/api/stores', storeRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
      path: c.req.path,
    },
  }, HTTP_STATUS.NOT_FOUND);
});

// Global error handler (using our custom error handler)
app.onError(errorHandler);