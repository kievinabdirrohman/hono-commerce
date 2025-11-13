import { google } from 'googleapis';
import { config } from '@config/env';
import { log } from '@config/logger';
import { AuthenticationError } from '@/types/common';

/**
 * Google OAuth Service
 * Handles Google OAuth 2.0 authentication flow
 */
export class GoogleOAuthService {
  private oauth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );
  }

  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(state?: string): string {
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Request refresh token
      scope: config.google.scopes,
      prompt: 'consent', // Force consent screen to get refresh token
      state: state || this.generateState(),
    });

    log.debug('Generated OAuth URL', { hasState: !!state });
    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);

      if (!tokens.access_token) {
        throw new AuthenticationError('No access token received from Google');
      }

      if (!tokens.refresh_token) {
        throw new AuthenticationError('No refresh token received from Google');
      }

      log.info('Tokens obtained from Google', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiresIn: tokens.expiry_date,
      });

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expiry_date || Date.now() + 3600 * 1000,
      };
    } catch (error) {
      log.error('Failed to exchange code for tokens', error);
      throw new AuthenticationError('Failed to authenticate with Google');
    }
  }

  /**
   * Get user information from Google
   */
  async getUserInfo(accessToken: string): Promise<{
    id: string;
    email: string;
    name: string;
    picture?: string;
  }> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const { data } = await oauth2.userinfo.get();

      if (!data.id || !data.email) {
        throw new AuthenticationError('Incomplete user data from Google');
      }

      log.debug('Retrieved user info from Google', {
        id: data.id,
        email: data.email,
      });

      return {
        id: data.id,
        email: data.email,
        name: data.name || data.email,
        picture: data.picture ?? undefined,
      };
    } catch (error) {
      log.error('Failed to get user info from Google', error);
      throw new AuthenticationError('Failed to retrieve user information');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresIn: number;
  }> {
    try {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      if (!credentials.access_token) {
        throw new AuthenticationError('No access token received during refresh');
      }

      log.info('Access token refreshed', {
        expiresIn: credentials.expiry_date,
      });

      return {
        accessToken: credentials.access_token,
        expiresIn: credentials.expiry_date || Date.now() + 3600 * 1000,
      };
    } catch (error) {
      log.error('Failed to refresh access token', error);
      throw new AuthenticationError('Failed to refresh access token');
    }
  }

  /**
   * Revoke access token (for logout)
   */
  async revokeToken(token: string): Promise<void> {
    try {
      await this.oauth2Client.revokeToken(token);
      log.info('Token revoked successfully');
    } catch (error) {
      log.error('Failed to revoke token', error);
      // Don't throw error - continue with logout even if revocation fails
    }
  }

  /**
   * Validate access token
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      this.oauth2Client.setCredentials({ access_token: accessToken });
      
      const tokenInfo = await this.oauth2Client.getTokenInfo(accessToken);
      
      // Check if token is expired
      if (tokenInfo.expiry_date && tokenInfo.expiry_date < Date.now()) {
        return false;
      }

      return true;
    } catch (error) {
      log.debug('Token validation failed', { error });
      return false;
    }
  }

  /**
   * Generate secure state parameter for CSRF protection
   */
  private generateState(): string {
    return crypto.randomUUID();
  }
}

// Export singleton instance
export const googleOAuthService = new GoogleOAuthService();