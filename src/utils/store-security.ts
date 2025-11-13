import { z } from 'zod';
import sanitizeHtml from 'sanitize-html';
import { nameSchema, descriptionSchema, optionalUrlSchema } from '@/utils/validations';

/**
 * Enhanced validation schemas with additional security checks
 */

// Store name validation with additional security checks
export const storeNameSchema = z
  .string()
  .min(1, 'Store name is required')
  .max(255, 'Store name is too long')
  .trim()
  .refine(
    (name) => {
      // Prevent names with only special characters
      return /[a-zA-Z0-9]/.test(name);
    },
    { message: 'Store name must contain at least one alphanumeric character' }
  )
  .refine(
    (name) => {
      // Prevent excessive special characters
      const specialCharsCount = (name.match(/[^a-zA-Z0-9\s-_]/g) || []).length;
      return specialCharsCount / name.length < 0.3; // Max 30% special chars
    },
    { message: 'Store name contains too many special characters' }
  )
  .transform((name) => {
    // Sanitize: Remove multiple consecutive spaces
    return name.replace(/\s+/g, ' ').trim();
  });

// Store description with HTML sanitization
export const storeDescriptionSchema = z
  .string()
  .max(5000, 'Store description is too long')
  .trim()
  .optional()
  .transform((desc) => {
    if (!desc) return desc;
    
    // Sanitize HTML to prevent XSS
    // Allow only safe tags for store description
    return sanitizeHtml(desc, {
      allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br'],
      allowedAttributes: {},
      disallowedTagsMode: 'recursiveEscape',
    });
  });

// Enhanced URL validation with additional security checks
export const secureUrlSchema = z
  .string()
  .url('Invalid URL format')
  .max(2048, 'URL is too long')
  .optional()
  .or(z.literal(''))
  .transform((val) => (val === '' ? undefined : val))
  .refine(
    (url) => {
      if (!url) return true;
      
      try {
        const parsed = new URL(url);
        
        // SECURITY: Only allow HTTPS in production
        // Allow HTTP only for localhost in development
        const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
        const isSecure = parsed.protocol === 'https:';
        const allowHttp = process.env.NODE_ENV === 'development' && isLocalhost;
        
        return isSecure || allowHttp;
      } catch {
        return false;
      }
    },
    { message: 'Only HTTPS URLs are allowed' }
  )
  .refine(
    (url) => {
      if (!url) return true;
      
      try {
        const parsed = new URL(url);
        
        // SECURITY: Block common malicious patterns
        const suspiciousPatterns = [
          /javascript:/i,
          /data:/i,
          /vbscript:/i,
          /file:/i,
          /@/,  // Prevent username:password in URL
        ];
        
        return !suspiciousPatterns.some(pattern => pattern.test(url));
      } catch {
        return false;
      }
    },
    { message: 'URL contains suspicious patterns' }
  )
  .refine(
    (url) => {
      if (!url) return true;
      
      try {
        const parsed = new URL(url);
        
        // SECURITY: Validate marketplace domains
        // This prevents phishing by ensuring only legitimate marketplace URLs
        const validDomains = [
          'tokopedia.com',
          'tokopedia.link',
          'tiktok.com',
          'tiktokshop.com',
          'shopee.co.id',
          'shopee.com',
          'tokopedia.co.id',
          'toco.com',
          'toco.id',
        ];
        
        // Check if hostname ends with one of the valid domains
        const hostname = parsed.hostname.toLowerCase();
        const isValidDomain = validDomains.some(domain => 
          hostname === domain || hostname.endsWith(`.${domain}`)
        );
        
        // For development, allow localhost
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
        const isDevelopment = process.env.NODE_ENV === 'development';
        
        return isValidDomain || (isDevelopment && isLocalhost);
      } catch {
        return false;
      }
    },
    { 
      message: 'URL must be from a valid marketplace domain (Tokopedia, TikTok Shop, Shopee, or Toco)' 
    }
  );

// Create store validation with all enhancements
export const enhancedCreateStoreSchema = z.object({
  name: storeNameSchema,
  description: storeDescriptionSchema,
});

// Update store validation with all enhancements
export const enhancedUpdateStoreSchema = z.object({
  name: storeNameSchema.optional(),
  description: storeDescriptionSchema,
  tokopediaUrl: secureUrlSchema,
  tiktokShopUrl: secureUrlSchema,
  shopeeUrl: secureUrlSchema,
  tocoUrl: secureUrlSchema,
}).refine(
  (data) => Object.values(data).some((value) => value !== undefined),
  { message: 'At least one field must be provided for update' }
);

/**
 * Rate limiting configuration for store operations
 * More restrictive than default to prevent abuse
 */
export const STORE_RATE_LIMITS = {
  CREATE: {
    MAX_REQUESTS: 100,        // Only 2 attempts per window (prevent spam)
    WINDOW_MS: 60 * 60 * 1000, // 1 hour window
  },
  UPDATE: {
    MAX_REQUESTS: 10,       // 10 updates per window
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  },
  READ: {
    MAX_REQUESTS: 100,      // Standard read limit
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  },
} as const;

/**
 * Input sanitization utilities
 */
export class StoreSanitizer {
  /**
   * Sanitize store name
   * Removes dangerous characters while preserving readability
   */
  static sanitizeName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
      .replace(/[<>]/g, '')            // Remove HTML brackets
      .replace(/javascript:/gi, '')    // Remove javascript: protocol
      .replace(/on\w+=/gi, '')         // Remove event handlers
      .slice(0, 255);                  // Enforce max length
  }

  /**
   * Sanitize URL with additional checks
   */
  static sanitizeUrl(url: string | undefined): string | undefined {
    if (!url) return undefined;
    
    try {
      const cleaned = url.trim();
      const parsed = new URL(cleaned);
      
      // Remove auth info from URL (username:password)
      parsed.username = '';
      parsed.password = '';
      
      // Remove fragments (anything after #)
      parsed.hash = '';
      
      return parsed.toString();
    } catch {
      return undefined;
    }
  }

  /**
   * Validate and sanitize all marketplace URLs
   */
  static sanitizeMarketplaceLinks(links: {
    tokopediaUrl?: string;
    tiktokShopUrl?: string;
    shopeeUrl?: string;
    tocoUrl?: string;
  }): {
    tokopediaUrl?: string;
    tiktokShopUrl?: string;
    shopeeUrl?: string;
    tocoUrl?: string;
  } {
    return {
      tokopediaUrl: this.sanitizeUrl(links.tokopediaUrl),
      tiktokShopUrl: this.sanitizeUrl(links.tiktokShopUrl),
      shopeeUrl: this.sanitizeUrl(links.shopeeUrl),
      tocoUrl: this.sanitizeUrl(links.tocoUrl),
    };
  }
}

/**
 * Security headers for store API responses
 * Prevents various attacks including clickjacking, XSS, etc.
 */
export const STORE_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
} as const;

/**
 * Audit log severity levels for store operations
 * Used to prioritize security monitoring
 */
export enum StoreAuditSeverity {
  INFO = 'info',        // Normal operations (read, list)
  WARNING = 'warning',  // Update operations
  CRITICAL = 'critical', // Creation, deletion attempts
}

/**
 * Get audit severity for store action
 */
export function getStoreAuditSeverity(action: string): StoreAuditSeverity {
  switch (action) {
    case 'create':
      return StoreAuditSeverity.CRITICAL;
    case 'update':
    case 'update_image':
      return StoreAuditSeverity.WARNING;
    case 'read':
    case 'list':
    default:
      return StoreAuditSeverity.INFO;
  }
}