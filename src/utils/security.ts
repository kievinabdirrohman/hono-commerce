/**
 * Security utility functions
 */

/**
 * Compare strings in constant time to prevent timing attacks
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Hash token for storage (prevents token leakage)
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate cryptographically secure random string
 */
export function generateSecureRandom(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (data.length <= visibleChars * 2) {
    return '***';
  }
  return `${data.slice(0, visibleChars)}***${data.slice(-visibleChars)}`;
}

/**
 * Validate IP address format
 */
export function isValidIP(ip: string): boolean {
  // IPv4
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  // IPv6 (basic validation)
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv6Regex.test(ip);
}

/**
 * Extract and validate IP from headers
 */
export function extractIP(headers: {
  'x-forwarded-for'?: string;
  'x-real-ip'?: string;
}): string | undefined {
  const forwardedFor = headers['x-forwarded-for'];
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    const ip = forwardedFor.split(',')[0]?.trim();
    if (ip && isValidIP(ip)) {
      return ip;
    }
  }

  const realIp = headers['x-real-ip'];
  if (realIp && isValidIP(realIp)) {
    return realIp;
  }

  return undefined;
}

/**
 * Check if user agent looks suspicious
 */
export function isSuspiciousUserAgent(userAgent: string): boolean {
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /java(?!script)/i,
  ];

  return suspiciousPatterns.some(pattern => pattern.test(userAgent));
}

/**
 * Generate fingerprint from device info
 */
export async function generateDeviceFingerprint(data: {
  userAgent?: string;
  ip?: string;
  acceptLanguage?: string;
}): Promise<string> {
  const parts = [
    data.userAgent || '',
    data.ip || '',
    data.acceptLanguage || '',
  ];

  const combined = parts.join('|');
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(combined);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encodedData);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/**
 * Sanitize user input for SQL (additional layer on top of parameterized queries)
 */
export function sanitizeForSQL(input: string): string {
  // Remove potentially dangerous characters
  return input
    .replace(/[\0\x08\x09\x1a\n\r"'\\%]/g, '')
    .trim();
}

/**
 * Validate redirect URL to prevent open redirect attacks
 */
export function isValidRedirectUrl(url: string, allowedDomains: string[]): boolean {
  try {
    const parsed = new URL(url);
    
    // Only allow HTTP(S)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    // Check if domain is in allowlist
    return allowedDomains.some(domain => {
      return parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`);
    });
  } catch {
    return false;
  }
}

/**
 * Check password strength (for future use if adding password auth)
 */
export function checkPasswordStrength(password: string): {
  strong: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (password.length < 8) feedback.push('Password should be at least 8 characters');
  if (!/[a-z]/.test(password)) feedback.push('Add lowercase letters');
  if (!/[A-Z]/.test(password)) feedback.push('Add uppercase letters');
  if (!/[0-9]/.test(password)) feedback.push('Add numbers');
  if (!/[^a-zA-Z0-9]/.test(password)) feedback.push('Add special characters');

  return {
    strong: score >= 5,
    score,
    feedback,
  };
}