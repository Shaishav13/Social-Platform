import { RedisConnection } from '../../config/redis';
import { Session } from './types';

export class SessionManager {
  private static readonly SESSION_PREFIX = 'session:';
  private static readonly USER_SESSIONS_PREFIX = 'user_sessions:';
  private static readonly SESSION_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

  static async storeSession(session: Session): Promise<void> {
    if (!RedisConnection.isConnected()) return;
    try {
      const sessionKey = `${this.SESSION_PREFIX}${session.refreshToken}`;
      const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${session.userId}`;
      
      const sessionData = JSON.stringify({
        id: session.id,
        userId: session.userId,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt.toISOString(),
        createdAt: session.createdAt.toISOString(),
        isActive: session.isActive,
      });

      // Store session data
      await RedisConnection.set(sessionKey, sessionData, this.SESSION_EXPIRY);
      
      // Add session to user's session set
      const client = RedisConnection.getClient();
      await client.sAdd(userSessionsKey, session.refreshToken);
      await client.expire(userSessionsKey, this.SESSION_EXPIRY);
    } catch {}
  }

  static async getSession(refreshToken: string): Promise<Session | null> {
    if (!RedisConnection.isConnected()) return null;
    const sessionKey = `${this.SESSION_PREFIX}${refreshToken}`;
    const sessionData = await RedisConnection.get(sessionKey);
    
    if (!sessionData) {
      return null;
    }

    try {
      const parsed = JSON.parse(sessionData);
      const session: Session = {
        id: parsed.id,
        userId: parsed.userId,
        refreshToken: parsed.refreshToken,
        expiresAt: new Date(parsed.expiresAt),
        createdAt: new Date(parsed.createdAt),
        isActive: parsed.isActive,
      };

      // Check if session is expired or inactive
      if (!session.isActive || session.expiresAt < new Date()) {
        await this.removeSession(refreshToken);
        return null;
      }

      return session;
    } catch (error) {
      console.error('Error parsing session data:', error);
      return null;
    }
  }

  static async removeSession(refreshToken: string): Promise<void> {
    if (!RedisConnection.isConnected()) return;
    try {
      const sessionKey = `${this.SESSION_PREFIX}${refreshToken}`;
      
      // Get session to find userId
      const sessionData = await RedisConnection.get(sessionKey);
      if (sessionData) {
        try {
          const parsed = JSON.parse(sessionData);
          const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${parsed.userId}`;
          
          // Remove from user's session set
          const client = RedisConnection.getClient();
          await client.sRem(userSessionsKey, refreshToken);
        } catch (error) {
          console.error('Error removing session from user set:', error);
        }
      }

      // Remove session data
      await RedisConnection.del(sessionKey);
    } catch {}
  }

  static async removeAllUserSessions(userId: string): Promise<void> {
    if (!RedisConnection.isConnected()) return;
    try {
      const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${userId}`;
      const client = RedisConnection.getClient();
      
      // Get all refresh tokens for the user
      const refreshTokens = await client.sMembers(userSessionsKey);
      
      // Remove all sessions
      for (const refreshToken of refreshTokens) {
        const sessionKey = `${this.SESSION_PREFIX}${refreshToken}`;
        await RedisConnection.del(sessionKey);
      }
      
      // Clear the user's session set
      await RedisConnection.del(userSessionsKey);
    } catch {}
  }

  static async isSessionActive(refreshToken: string): Promise<boolean> {
    const session = await this.getSession(refreshToken);
    return session !== null && session.isActive;
  }

  static async updateSessionExpiry(refreshToken: string, newExpiryDate: Date): Promise<void> {
    const session = await this.getSession(refreshToken);
    if (!session) {
      return;
    }

    session.expiresAt = newExpiryDate;
    await this.storeSession(session);
  }

  static async getUserActiveSessions(userId: string): Promise<string[]> {
    if (!RedisConnection.isConnected()) return [];
    try {
      const userSessionsKey = `${this.USER_SESSIONS_PREFIX}${userId}`;
      const client = RedisConnection.getClient();
      
      const refreshTokens = await client.sMembers(userSessionsKey);
      const activeSessions: string[] = [];
      
      for (const refreshToken of refreshTokens) {
        const isActive = await this.isSessionActive(refreshToken);
        if (isActive) {
          activeSessions.push(refreshToken);
        } else {
          // Clean up inactive session
          await client.sRem(userSessionsKey, refreshToken);
        }
      }
      
      return activeSessions;
    } catch {
      return [];
    }
  }

  static async cleanupExpiredSessions(): Promise<void> {
    // Handled by Redis TTL
  }
}