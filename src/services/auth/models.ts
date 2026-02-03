import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, Session, AuthTokens, JWTPayload, RegisterRequest } from './types';
import { AuthDatabase } from './database';
import { SessionManager } from './sessionManager';
import { ContentDatabase } from '../content/database';
import { SocialDatabase } from '../social/database';
import { BlogDatabase } from '../blog/database';
import { NotificationDatabase } from '../notification/database';
import { ProfileDatabase } from '../profile/database';

export class UserModel {
  private static readonly SALT_ROUNDS = 12;
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  private static readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
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
    const existingUserByEmail = await AuthDatabase.findUserByEmail(userData.email);
    if (existingUserByEmail) {
      throw new Error('User with this email already exists');
    }

    const existingUserByUsername = await AuthDatabase.findUserByUsername(userData.username);
    if (existingUserByUsername) {
      throw new Error('User with this username already exists');
    }

    // Hash password and create user
    const passwordHash = await this.hashPassword(userData.password);
    
    const newUser = await AuthDatabase.createUser({
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
    const user = await AuthDatabase.findUserByEmail(email);
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

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    const session = await AuthDatabase.createSession(user.id, refreshToken, expiresAt);
    
    // Also store in Redis for fast access
    await SessionManager.storeSession(session);

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
    // Check Redis first for fast access
    let session = await SessionManager.getSession(refreshToken);
    
    // Fallback to database if not in Redis
    if (!session) {
      session = await AuthDatabase.findSessionByRefreshToken(refreshToken);
      if (!session) {
        return null;
      }
    }

    const user = await AuthDatabase.findUserById(session.userId);
    if (!user) {
      return null;
    }

    // Invalidate old refresh token
    await this.logout(refreshToken);

    // Generate new tokens
    return this.generateTokens(user);
  }

  static async logout(refreshToken: string): Promise<void> {
    // Remove from both Redis and database
    await SessionManager.removeSession(refreshToken);
    await AuthDatabase.invalidateSession(refreshToken);
  }

  static async logoutAllSessions(userId: string): Promise<void> {
    // Remove from both Redis and database
    await SessionManager.removeAllUserSessions(userId);
    await AuthDatabase.invalidateAllUserSessions(userId);
  }

  static async findUserById(userId: string): Promise<User | null> {
    return AuthDatabase.findUserById(userId);
  }
}

export class DataExportModel {
  static async exportUserData(userId: string): Promise<any> {
    try {
      // Get user profile data
      const user = await AuthDatabase.findUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get user's posts with media
      const posts = await ContentDatabase.getPostsByAuthor(userId, { limit: 1000, offset: 0 });

      // Get user's comments
      const comments = await SocialDatabase.getUserComments(userId);

      // Get user's likes
      const likes = await SocialDatabase.getUserLikes(userId);

      // Get user's shares
      const shares = await SocialDatabase.getUserShares(userId);

      // Get user's follows (following and followers)
      const following = await SocialDatabase.getUserFollowing(userId);
      const followers = await SocialDatabase.getUserFollowers(userId);

      // Get user's blogs
      const blogs = await BlogDatabase.getUserBlogs(userId);

      // Get user's notifications
      const notifications = await NotificationDatabase.getUserNotifications(userId);

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
          posts: posts || [],
          comments: comments || [],
          likes: likes || [],
          shares: shares || [],
        },
        social: {
          following: following || [],
          followers: followers || [],
        },
        blogs: blogs || [],
        notifications: notifications || [],
        statistics: {
          totalPosts: posts?.length || 0,
          totalComments: comments?.length || 0,
          totalLikes: likes?.length || 0,
          totalShares: shares?.length || 0,
          totalFollowing: following?.length || 0,
          totalFollowers: followers?.length || 0,
          totalBlogs: blogs?.length || 0,
          totalNotifications: notifications?.length || 0,
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
      // Delete user data in reverse dependency order
      
      // 1. Delete notifications (references user)
      await NotificationDatabase.deleteUserNotifications(userId);

      // 2. Delete social interactions (likes, comments, shares, follows, follow requests)
      await SocialDatabase.deleteUserLikes(userId);
      await SocialDatabase.deleteUserComments(userId);
      await SocialDatabase.deleteUserShares(userId);
      await SocialDatabase.deleteUserFollows(userId);
      await SocialDatabase.deleteUserFollowRequests(userId);

      // 3. Delete blogs
      await BlogDatabase.deleteUserBlogs(userId);

      // 4. Delete posts and media
      await ContentDatabase.deleteUserPosts(userId);
      await ContentDatabase.deleteUserMedia(userId);

      // 5. Delete profile settings
      await ProfileDatabase.deleteUserProfile(userId);

      // 6. Delete sessions
      await AuthDatabase.invalidateAllUserSessions(userId);

      // 7. Finally delete the user account
      await AuthDatabase.deleteUser(userId);

      console.log(`Successfully deleted all data for user ${userId}`);
    } catch (error) {
      console.error('Error deleting user account:', error);
      throw new Error('Failed to delete user account');
    }
  }
}