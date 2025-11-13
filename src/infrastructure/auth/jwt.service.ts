import { SignJWT, jwtVerify } from 'jose';
import { config } from '@config/env';
import { log } from '@config/logger';
import { AuthenticationError } from '@/types/common';

/**
 * JWT Service
 * Handles JWT token creation and verification
 */

interface JWTPayload {
  userId: string;
  sessionId: string;
  role: string;
  iat?: number;
  exp?: number;
}

export class JWTService {
  private accessSecret: Uint8Array;
  private refreshSecret: Uint8Array;

  constructor() {
    this.accessSecret = new TextEncoder().encode(config.jwt.accessSecret);
    this.refreshSecret = new TextEncoder().encode(config.jwt.refreshSecret);
  }

  /**
   * Generate access token (short-lived)
   */
  async generateAccessToken(payload: {
    userId: string;
    sessionId: string;
    role: string;
  }): Promise<string> {
    try {
      const jwt = await new SignJWT({
        userId: payload.userId,
        sessionId: payload.sessionId,
        role: payload.role,
      })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt()
        .setExpirationTime(config.jwt.accessExpiry)
        .sign(this.accessSecret);

      log.debug('Access token generated', {
        userId: payload.userId,
        sessionId: payload.sessionId,
      });

      return jwt;
    } catch (error) {
      log.error('Failed to generate access token', error);
      throw new AuthenticationError('Failed to generate access token');
    }
  }

  /**
   * Generate refresh token (long-lived)
   */
  async generateRefreshToken(payload: {
    userId: string;
    sessionId: string;
  }): Promise<string> {
    try {
      const jwt = await new SignJWT({
        userId: payload.userId,
        sessionId: payload.sessionId,
      })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt()
        .setExpirationTime(config.jwt.refreshExpiry)
        .sign(this.refreshSecret);

      log.debug('Refresh token generated', {
        userId: payload.userId,
        sessionId: payload.sessionId,
      });

      return jwt;
    } catch (error) {
      log.error('Failed to generate refresh token', error);
      throw new AuthenticationError('Failed to generate refresh token');
    }
  }

  /**
   * Verify access token
   */
  async verifyAccessToken(token: string): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(token, this.accessSecret);

      return {
        userId: payload['userId'] as string,
        sessionId: payload['sessionId'] as string,
        role: payload['role'] as string,
        iat: payload.iat,
        exp: payload.exp,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('expired')) {
          log.debug('Access token expired');
          throw new AuthenticationError('Access token has expired');
        }
      }
      log.debug('Access token verification failed', { error });
      throw new AuthenticationError('Invalid access token');
    }
  }

  /**
   * Verify refresh token
   */
  async verifyRefreshToken(token: string): Promise<{
    userId: string;
    sessionId: string;
  }> {
    try {
      const { payload } = await jwtVerify(token, this.refreshSecret);

      return {
        userId: payload['userId'] as string,
        sessionId: payload['sessionId'] as string,
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('expired')) {
          log.debug('Refresh token expired');
          throw new AuthenticationError('Refresh token has expired');
        }
      }
      log.debug('Refresh token verification failed', { error });
      throw new AuthenticationError('Invalid refresh token');
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): JWTPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3 || !parts[1]) {
        return null;
      }

      // Use base64url encoding for JWT tokens (RFC 7519)
      // Replace URL-safe characters with standard base64 characters
      const base64Payload = parts[1]
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      
      // Add padding if needed
      const paddedPayload = base64Payload + '='.repeat((4 - base64Payload.length % 4) % 4);

      const decoded = Buffer.from(paddedPayload, 'base64').toString();
      const payload = JSON.parse(decoded);

      return payload as JWTPayload;
    } catch (error) {
      log.debug('Failed to decode token', { error });
      return null;
    }
  }

  /**
   * Check if token is expired without verification
   */
  isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return true;
    }

    return decoded.exp * 1000 < Date.now();
  }
}

// Export singleton instance
export const jwtService = new JWTService();