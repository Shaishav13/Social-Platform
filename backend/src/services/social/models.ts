import { Like, Comment, Share, CommentWithReplies, CreateCommentRequest, LikeResponse, ShareResponse, FollowResponse, FollowRequest } from './types';
import { SocialDatabase } from './database';
import { ProfileModel } from '../profile/models';

export class LikeModel {
  static async toggleLike(userId: string, targetId: string, targetType: 'post' | 'comment'): Promise<LikeResponse> {
    // Check if like already exists
    const existingLike = await SocialDatabase.findLike(userId, targetId, targetType);
    
    if (existingLike) {
      // Unlike - remove the like
      await SocialDatabase.deleteLike(userId, targetId, targetType);
      
      // Update like count
      if (targetType === 'comment') {
        await SocialDatabase.updateCommentLikeCount(targetId, false);
      } else if (targetType === 'post') {
        await SocialDatabase.updatePostLikeCount(targetId, false);
      }
      
      const likeCount = await SocialDatabase.getLikeCount(targetId, targetType);
      return { liked: false, likeCount };
    } else {
      // Like - create new like
      await SocialDatabase.createLike(userId, targetId, targetType);
      
      // Update like count
      if (targetType === 'comment') {
        await SocialDatabase.updateCommentLikeCount(targetId, true);
      } else if (targetType === 'post') {
        await SocialDatabase.updatePostLikeCount(targetId, true);
      }
      
      const likeCount = await SocialDatabase.getLikeCount(targetId, targetType);
      return { liked: true, likeCount };
    }
  }

  static async getLikeStatus(userId: string, targetId: string, targetType: 'post' | 'comment'): Promise<LikeResponse> {
    const existingLike = await SocialDatabase.findLike(userId, targetId, targetType);
    const likeCount = await SocialDatabase.getLikeCount(targetId, targetType);
    
    return {
      liked: !!existingLike,
      likeCount
    };
  }

  static async getLikeCount(targetId: string, targetType: 'post' | 'comment'): Promise<number> {
    return SocialDatabase.getLikeCount(targetId, targetType);
  }

  static validateLikeRequest(targetId: string, targetType: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!targetId || targetId.trim().length === 0) {
      errors.push('Target ID is required');
    }

    if (!targetType || !['post', 'comment'].includes(targetType)) {
      errors.push('Target type must be either "post" or "comment"');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export class CommentModel {
  static async createComment(postId: string, authorId: string, commentData: CreateCommentRequest): Promise<Comment> {
    // Validate comment content
    const validation = this.validateCommentContent(commentData.content);
    if (!validation.isValid) {
      throw new Error(`Comment validation failed: ${validation.errors.join(', ')}`);
    }

    // Create the comment
    const comment = await SocialDatabase.createComment(
      postId,
      authorId,
      commentData.content,
      commentData.parentId
    );

    // Update post comment count
    await SocialDatabase.updatePostCommentCount(postId, true);

    return comment;
  }

  static async getCommentsByPost(postId: string): Promise<CommentWithReplies[]> {
    return SocialDatabase.getCommentsByPost(postId);
  }

  static validateCommentContent(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!content || content.trim().length === 0) {
      errors.push('Comment content cannot be empty');
    }

    if (content.length > 2000) {
      errors.push('Comment content cannot exceed 2000 characters');
    }

    // Check for potentially harmful content (basic validation)
    const suspiciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        errors.push('Comment content contains potentially harmful code');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateCommentRequest(postId: string, commentData: CreateCommentRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!postId || postId.trim().length === 0) {
      errors.push('Post ID is required');
    }

    const contentValidation = this.validateCommentContent(commentData.content);
    if (!contentValidation.isValid) {
      errors.push(...contentValidation.errors);
    }

    // Validate parent ID if provided
    if (commentData.parentId && commentData.parentId.trim().length === 0) {
      errors.push('Parent ID cannot be empty if provided');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export class ShareModel {
  static async sharePost(userId: string, postId: string): Promise<ShareResponse> {
    // Check if already shared
    const existingShare = await SocialDatabase.findShare(userId, postId);
    
    if (existingShare) {
      // Already shared, return current status
      const shareCount = await SocialDatabase.getShareCount(postId);
      return { shared: true, shareCount };
    }

    // Create new share
    await SocialDatabase.createShare(userId, postId);
    
    // Update post share count
    await SocialDatabase.updatePostShareCount(postId, true);
    
    const shareCount = await SocialDatabase.getShareCount(postId);
    
    return { shared: true, shareCount };
  }

  static async getShareStatus(userId: string, postId: string): Promise<ShareResponse> {
    const existingShare = await SocialDatabase.findShare(userId, postId);
    const shareCount = await SocialDatabase.getShareCount(postId);
    
    return {
      shared: !!existingShare,
      shareCount
    };
  }

  static async getShareCount(postId: string): Promise<number> {
    return SocialDatabase.getShareCount(postId);
  }

  static validateShareRequest(postId: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!postId || postId.trim().length === 0) {
      errors.push('Post ID is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export class FollowModel {
  static async sendFollowRequest(requesterId: string, targetId: string): Promise<FollowResponse> {
    // Prevent self-following
    if (requesterId === targetId) {
      throw new Error('Users cannot follow themselves');
    }

    // Check if already following
    const existingFollow = await SocialDatabase.findFollow(requesterId, targetId);
    if (existingFollow) {
      const followerCount = await SocialDatabase.getFollowerCount(targetId);
      return { following: true, followerCount };
    }

    // Check if there's already a pending request
    const existingRequest = await SocialDatabase.findFollowRequest(requesterId, targetId);
    if (existingRequest && existingRequest.status === 'pending') {
      const followerCount = await SocialDatabase.getFollowerCount(targetId);
      return { following: false, requested: true, followerCount };
    }

    // Get target user's privacy settings
    const targetUser = await ProfileModel.getPrivateProfile(targetId, targetId);
    if (!targetUser) {
      throw new Error('Target user not found');
    }

    const followerCount = await SocialDatabase.getFollowerCount(targetId);

    // If target user has public account, follow immediately
    if (!targetUser.isPrivate) {
      await SocialDatabase.createFollow(requesterId, targetId);
      return { following: true, followerCount: followerCount + 1 };
    }

    // If target user has private account, send follow request
    await SocialDatabase.createFollowRequest(requesterId, targetId);
    return { following: false, requested: true, followerCount };
  }

  static async acceptFollowRequest(requestId: string, targetId: string): Promise<{ success: boolean; message: string }> {
    // Atomically verify ownership and pending status while updating in the database
    const updatedRequest = await SocialDatabase.updateFollowRequestStatus(requestId, 'accepted', targetId);
    if (!updatedRequest) {
      return { success: false, message: 'Follow request not found, already processed, or unauthorized' };
    }

    // Create the follow relationship
    await SocialDatabase.createFollow(updatedRequest.requesterId, updatedRequest.targetId);

    return { success: true, message: 'Follow request accepted' };
  }

  static async declineFollowRequest(requestId: string, targetId: string): Promise<{ success: boolean; message: string }> {
    // Atomically verify ownership and pending status while updating in the database
    const updatedRequest = await SocialDatabase.updateFollowRequestStatus(requestId, 'declined', targetId);
    if (!updatedRequest) {
      return { success: false, message: 'Follow request not found, already processed, or unauthorized' };
    }

    return { success: true, message: 'Follow request declined' };
  }

  static async cancelFollowRequest(requesterId: string, targetId: string): Promise<{ success: boolean; message: string }> {
    const deleted = await SocialDatabase.deleteFollowRequest(requesterId, targetId);
    if (!deleted) {
      return { success: false, message: 'Follow request not found' };
    }

    return { success: true, message: 'Follow request cancelled' };
  }

  static async unfollow(followerId: string, followingId: string): Promise<FollowResponse> {
    const deleted = await SocialDatabase.deleteFollow(followerId, followingId);
    const followerCount = await SocialDatabase.getFollowerCount(followingId);
    
    return { 
      following: false, 
      followerCount: deleted ? followerCount : followerCount 
    };
  }

  static async getFollowStatus(requesterId: string, targetId: string): Promise<FollowResponse> {
    // Check if already following
    const existingFollow = await SocialDatabase.findFollow(requesterId, targetId);
    if (existingFollow) {
      const followerCount = await SocialDatabase.getFollowerCount(targetId);
      return { following: true, followerCount };
    }

    // Check if there's a pending request
    const existingRequest = await SocialDatabase.findFollowRequest(requesterId, targetId);
    const followerCount = await SocialDatabase.getFollowerCount(targetId);
    
    if (existingRequest && existingRequest.status === 'pending') {
      return { following: false, requested: true, followerCount };
    }

    return { following: false, followerCount };
  }

  static async getPendingFollowRequests(userId: string): Promise<FollowRequest[]> {
    return SocialDatabase.getPendingFollowRequests(userId);
  }

  static validateFollowRequest(requesterId: string, targetId: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!requesterId || requesterId.trim().length === 0) {
      errors.push('Requester ID is required');
    }

    if (!targetId || targetId.trim().length === 0) {
      errors.push('Target ID is required');
    }

    if (requesterId === targetId) {
      errors.push('Users cannot follow themselves');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}