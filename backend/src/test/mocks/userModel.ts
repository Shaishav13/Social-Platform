import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, Session, AuthTokens, JWTPayload, RegisterRequest } from '../../services/auth/types';
import { MockAuthDatabase } from './database';

export class MockUserModel {
  private static readonly SALT_ROUNDS = 12;
  private static readonly JWT_SECRET = 'test-secret-key';
  private static readonly JWT_REFRESH_SECRET = 'test-refresh-secret-key';
  private static readonly ACCESS_TOKEN_EXPIRY = '15m';
  private static readonly REFRESH_TOKEN_EXPIRY = '7d';

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateUsername(username: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (username.length < 3) {
      errors.push('Username must be at least 3 characters long');
    }

    if (username.length > 50) {
      errors.push('Username must be no more than 50 characters long');
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      errors.push('Username can only contain letters, numbers, and underscores');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateEmail(email: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
    }

    if (email.length > 255) {
      errors.push('Email must be no more than 255 characters long');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static async createUser(userData: RegisterRequest): Promise<User> {
    // Validate input
    const passwordValidation = this.validatePassword(userData.password);
    if (!passwordValidation.isValid) {
      throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
    }

    const usernameValidation = this.validateUsername(userData.username);
    if (!usernameValidation.isValid) {
      throw new Error(`Username validation failed: ${usernameValidation.errors.join(', ')}`);
    }

    const emailValidation = this.validateEmail(userData.email);
    if (!emailValidation.isValid) {
      throw new Error(`Email validation failed: ${emailValidation.errors.join(', ')}`);
    }

    // Check for existing user
    const existingUserByEmail = await MockAuthDatabase.findUserByEmail(userData.email);
    if (existingUserByEmail) {
      throw new Error('User with this email already exists');
    }

    const existingUserByUsername = await MockAuthDatabase.findUserByUsername(userData.username);
    if (existingUserByUsername) {
      throw new Error('User with this username already exists');
    }

    // Hash password and create user
    const passwordHash = await this.hashPassword(userData.password);
    
    const newUser = await MockAuthDatabase.createUser({
      username: userData.username,
      email: userData.email,
      passwordHash,
      bio: userData.bio,
      profilePicture: undefined,
      isPrivate: false,
    });

    return newUser;
  }

  static async authenticateUser(email: string, password: string): Promise<User | null> {
    const user = await MockAuthDatabase.findUserByEmail(email);
    if (!user) {
      return null;
    }

    const isPasswordValid = await this.verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  static generateAccessToken(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
    };

    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });
  }

  static generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  static async generateTokens(user: User): Promise<AuthTokens> {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();

    // Store refresh token in mock database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    await MockAuthDatabase.createSession(user.id, refreshToken, expiresAt);

    return {
      accessToken,
      refreshToken,
    };
  }

  static verifyAccessToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as JWTPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  static async refreshTokens(refreshToken: string): Promise<AuthTokens | null> {
    const session = await MockAuthDatabase.findSessionByRefreshToken(refreshToken);
    if (!session) {
      return null;
    }

    const user = await MockAuthDatabase.findUserById(session.userId);
    if (!user) {
      return null;
    }

    // Invalidate old refresh token
    await MockAuthDatabase.invalidateSession(refreshToken);

    // Generate new tokens
    return this.generateTokens(user);
  }

  static async logout(refreshToken: string): Promise<void> {
    await MockAuthDatabase.invalidateSession(refreshToken);
  }

  static async logoutAllSessions(userId: string): Promise<void> {
    await MockAuthDatabase.invalidateAllUserSessions(userId);
  }
}

export class MockDataExportModel {
  static async exportUserData(userId: string): Promise<any> {
    try {
      // Get user profile data
      const user = await MockAuthDatabase.findUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // For mock testing, return empty arrays for all data sections
      // In a real implementation, these would fetch from respective mock databases
      const posts: any[] = [];
      const comments: any[] = [];
      const likes: any[] = [];
      const shares: any[] = [];
      const following: any[] = [];
      const followers: any[] = [];
      const blogs: any[] = [];
      const notifications: any[] = [];

      // Compile comprehensive export data
      const exportData = {
        exportedAt: new Date().toISOString(),
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          bio: user.bio,
          profilePicture: user.profilePicture,
          isPrivate: user.isPrivate,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        content: {
          posts,
          comments,
          likes,
          shares,
        },
        social: {
          following,
          followers,
        },
        blogs,
        notifications,
        statistics: {
          totalPosts: posts.length,
          totalComments: comments.length,
          totalLikes: likes.length,
          totalShares: shares.length,
          totalFollowing: following.length,
          totalFollowers: followers.length,
          totalBlogs: blogs.length,
          totalNotifications: notifications.length,
        },
      };

      return exportData;
    } catch (error) {
      console.error('Error exporting user data:', error);
      throw new Error('Failed to export user data');
    }
  }

  static async deleteUserAccount(userId: string): Promise<void> {
    try {
      // For mock testing, just delete the user from the auth database
      // In a real implementation, this would cascade through all services
      await MockAuthDatabase.invalidateAllUserSessions(userId);
      await MockAuthDatabase.deleteUser(userId);

      console.log(`Successfully deleted all data for user ${userId}`);
    } catch (error) {
      console.error('Error deleting user account:', error);
      throw new Error('Failed to delete user account');
    }
  }
}