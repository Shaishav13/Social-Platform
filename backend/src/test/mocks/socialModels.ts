import { LikeResponse, ShareResponse, CreateCommentRequest, Comment } from '../../services/social/types';
import { MockSocialDatabase } from './socialDatabase';

export class MockLikeModel {
  static async toggleLike(userId: string, targetId: string, targetType: 'post' | 'comment'): Promise<LikeResponse> {
    // Check if like already exists
    const existingLike = await MockSocialDatabase.findLike(userId, targetId, targetType);
    
    if (existingLike) {
      // Unlike - remove the like
      await MockSocialDatabase.deleteLike(userId, targetId, targetType);
      
      // Update like count for comments
      if (targetType === 'comment') {
        await MockSocialDatabase.updateCommentLikeCount(targetId, false);
      }
      
      const likeCount = await MockSocialDatabase.getLikeCount(targetId, targetType);
      return { liked: false, likeCount };
    } else {
      // Like - create new like
      await MockSocialDatabase.createLike(userId, targetId, targetType);
      
      // Update like count for comments
      if (targetType === 'comment') {
        await MockSocialDatabase.updateCommentLikeCount(targetId, true);
      }
      
      const likeCount = await MockSocialDatabase.getLikeCount(targetId, targetType);
      return { liked: true, likeCount };
    }
  }

  static async getLikeStatus(userId: string, targetId: string, targetType: 'post' | 'comment'): Promise<LikeResponse> {
    const existingLike = await MockSocialDatabase.findLike(userId, targetId, targetType);
    const likeCount = await MockSocialDatabase.getLikeCount(targetId, targetType);
    
    return {
      liked: !!existingLike,
      likeCount
    };
  }

  static async getLikeCount(targetId: string, targetType: 'post' | 'comment'): Promise<number> {
    return MockSocialDatabase.getLikeCount(targetId, targetType);
  }
}

export class MockCommentModel {
  static async createComment(postId: string, authorId: string, commentData: CreateCommentRequest): Promise<Comment> {
    // Validate comment content (basic validation for mock)
    if (!commentData.content || commentData.content.trim().length === 0) {
      throw new Error('Comment content cannot be empty');
    }

    if (commentData.content.length > 2000) {
      throw new Error('Comment content cannot exceed 2000 characters');
    }

    // Create the comment
    const comment = await MockSocialDatabase.createComment(
      postId,
      authorId,
      commentData.content,
      commentData.parentId
    );

    return comment;
  }
}

export class MockShareModel {
  static async sharePost(userId: string, postId: string): Promise<ShareResponse> {
    // Check if already shared
    const existingShare = await MockSocialDatabase.findShare(userId, postId);
    
    if (existingShare) {
      // Already shared, return current status
      const shareCount = await MockSocialDatabase.getShareCount(postId);
      return { shared: true, shareCount };
    }

    // Create new share
    await MockSocialDatabase.createShare(userId, postId);
    const shareCount = await MockSocialDatabase.getShareCount(postId);
    
    return { shared: true, shareCount };
  }

  static async getShareStatus(userId: string, postId: string): Promise<ShareResponse> {
    const existingShare = await MockSocialDatabase.findShare(userId, postId);
    const shareCount = await MockSocialDatabase.getShareCount(postId);
    
    return {
      shared: !!existingShare,
      shareCount
    };
  }

  static async getShareCount(postId: string): Promise<number> {
    return MockSocialDatabase.getShareCount(postId);
  }
}