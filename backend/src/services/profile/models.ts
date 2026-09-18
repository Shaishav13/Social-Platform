import { User } from '../auth/types';
import { ProfileSettings, ProfileUpdateRequest, PublicProfile, PrivateProfile } from './types';
import { ProfileDatabase } from './database';
import { AuthDatabase } from '../auth/database';
import { SocialDatabase } from '../social/database';
import { ContentDatabase } from '../content/database';

export class ProfileModel {
  static async searchUsers(query: string, page: number, limit: number): Promise<{ users: any[]; totalCount: number }> {
    return await ProfileDatabase.searchUsers(query, page, limit);
  }
  static validateProfileUpdate(updateData: ProfileUpdateRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (updateData.username !== undefined) {
      if (updateData.username.length < 3) {
        errors.push('Username must be at least 3 characters long');
      }
      if (updateData.username.length > 50) {
        errors.push('Username must be no more than 50 characters long');
      }
      if (!/^[a-zA-Z0-9_]+$/.test(updateData.username)) {
        errors.push('Username can only contain letters, numbers, and underscores');
      }
    }

    if (updateData.bio !== undefined && updateData.bio.length > 500) {
      errors.push('Bio must be no more than 500 characters long');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static async getPublicProfile(userId: string, viewerId?: string): Promise<PublicProfile | null> {
    const user = await AuthDatabase.findUserById(userId);
    if (!user) {
      return null;
    }

    // Get counts
    const followerCount = await SocialDatabase.getFollowerCount(userId);
    const followingCount = await SocialDatabase.getFollowingCount(userId);
    const postCount = await ContentDatabase.getUserPostCount(userId);

    // Check if viewer is following this user
    let isFollowing: boolean | undefined;
    if (viewerId && viewerId !== userId) {
      isFollowing = await SocialDatabase.isFollowing(viewerId, userId);
    }

    const profile: PublicProfile = {
      id: user.id,
      username: user.username,
      bio: user.bio,
      profilePicture: user.profilePicture,
      followerCount,
      followingCount,
      postCount,
      isPrivate: user.isPrivate,
      is18Plus: user.is18Plus,
      dateOfBirth: user.dateOfBirth,
      isFollowing,
      createdAt: user.createdAt,
    };

    return profile;
  }

  static async getPrivateProfile(userId: string, viewerId: string): Promise<PrivateProfile | null> {
    // Only allow users to view their own private profile
    if (userId !== viewerId) {
      return null;
    }

    const user = await AuthDatabase.findUserById(userId);
    if (!user) {
      return null;
    }

    const settings = await ProfileDatabase.getProfileSettings(userId);
    
    // Get counts
    const followerCount = await SocialDatabase.getFollowerCount(userId);
    const followingCount = await SocialDatabase.getFollowingCount(userId);
    const postCount = await ContentDatabase.getUserPostCount(userId);

    const profile: PrivateProfile = {
      id: user.id,
      username: user.username,
      email: user.email,
      bio: user.bio,
      profilePicture: user.profilePicture,
      followerCount,
      followingCount,
      postCount,
      isPrivate: user.isPrivate,
      is18Plus: user.is18Plus,
      dateOfBirth: user.dateOfBirth,
      settings,
      createdAt: user.createdAt,
    };

    return profile;
  }

  static async updateProfile(userId: string, updateData: ProfileUpdateRequest): Promise<User | null> {
    const validation = this.validateProfileUpdate(updateData);
    if (!validation.isValid) {
      throw new Error(`Profile validation failed: ${validation.errors.join(', ')}`);
    }

    // Check if username is already taken (if username is being updated)
    if (updateData.username) {
      const existingUser = await AuthDatabase.findUserByUsername(updateData.username);
      if (existingUser && existingUser.id !== userId) {
        throw new Error('Username is already taken');
      }
    }

    // Update user data
    const updatedUser = await AuthDatabase.updateUser(userId, {
      ...(updateData.username && { username: updateData.username }),
      ...(updateData.bio !== undefined && { bio: updateData.bio }),
      ...(updateData.profilePicture && { profilePicture: updateData.profilePicture }),
      ...(updateData.settings?.isPrivate !== undefined && { isPrivate: updateData.settings.isPrivate }),
      ...(updateData.is18Plus !== undefined && { is18Plus: updateData.is18Plus }),
      ...(updateData.dateOfBirth !== undefined && { dateOfBirth: new Date(updateData.dateOfBirth) }),
    });

    // Update profile settings if provided
    if (updateData.settings) {
      await ProfileDatabase.updateProfileSettings(userId, updateData.settings);
    }

    return updatedUser;
  }

  static async updateProfilePicture(userId: string, pictureUrl: string): Promise<User | null> {
    return AuthDatabase.updateUser(userId, { profilePicture: pictureUrl });
  }

  static async getProfileSettings(userId: string): Promise<ProfileSettings> {
    return ProfileDatabase.getProfileSettings(userId);
  }

  static async updateProfileSettings(userId: string, settings: Partial<ProfileSettings>): Promise<ProfileSettings> {
    return ProfileDatabase.updateProfileSettings(userId, settings);
  }
}