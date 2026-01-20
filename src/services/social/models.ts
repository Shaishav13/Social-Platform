import { Like, Comment, Share, CommentWithReplies, CreateCommentRequest, LikeResponse, ShareResponse } from './types';
import { SocialDatabase } from './database';

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
  static async toggleFollow(followerId: string, followingId: string): Promise<{ following: boolean }> {
    // Prevent self-following
    if (followerId === followingId) {
      throw new Error('Users cannot follow themselves');
    }

    // Check if already following
    const existingFollow = await SocialDatabase.findFollow(followerId, followingId);
    
    if (existingFollow) {
      // Unfollow
      await SocialDatabase.deleteFollow(followerId, followingId);
      return { following: false };
    } else {
      // Follow
      await SocialDatabase.createFollow(followerId, followingId);
      return { following: true };
    }
  }

  static async getFollowStatus(followerId: string, followingId: string): Promise<{ following: boolean }> {
    const existingFollow = await SocialDatabase.findFollow(followerId, followingId);
    return { following: !!existingFollow };
  }

  static validateFollowRequest(followerId: string, followingId: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!followerId || followerId.trim().length === 0) {
      errors.push('Follower ID is required');
    }

    if (!followingId || followingId.trim().length === 0) {
      errors.push('Following ID is required');
    }

    if (followerId === followingId) {
      errors.push('Users cannot follow themselves');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}