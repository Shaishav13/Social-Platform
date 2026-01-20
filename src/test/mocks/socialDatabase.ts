import { Like, Comment, Share, Follow, CommentWithReplies } from '../../services/social/types';

// Mock social database for testing
export class MockSocialDatabase {
  private static likes: Map<string, Like> = new Map();
  private static comments: Map<string, Comment> = new Map();
  private static shares: Map<string, Share> = new Map();
  private static follows: Map<string, Follow> = new Map();

  static reset(): void {
    this.likes.clear();
    this.comments.clear();
    this.shares.clear();
    this.follows.clear();
  }

  static async initializeTables(): Promise<void> {
    // No-op for mock
  }

  // Like operations
  static async createLike(userId: string, targetId: string, targetType: 'post' | 'comment'): Promise<Like> {
    const id = `like_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const like: Like = {
      id,
      userId,
      targetId,
      targetType,
      createdAt: new Date()
    };

    const key = `${userId}_${targetId}_${targetType}`;
    this.likes.set(key, like);
    return like;
  }

  static async deleteLike(userId: string, targetId: string, targetType: 'post' | 'comment'): Promise<boolean> {
    const key = `${userId}_${targetId}_${targetType}`;
    return this.likes.delete(key);
  }

  static async findLike(userId: string, targetId: string, targetType: 'post' | 'comment'): Promise<Like | null> {
    const key = `${userId}_${targetId}_${targetType}`;
    return this.likes.get(key) || null;
  }

  static async getLikeCount(targetId: string, targetType: 'post' | 'comment'): Promise<number> {
    let count = 0;
    for (const like of this.likes.values()) {
      if (like.targetId === targetId && like.targetType === targetType) {
        count++;
      }
    }
    return count;
  }

  // Comment operations
  static async createComment(postId: string, authorId: string, content: string, parentId?: string): Promise<Comment> {
    const id = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const comment: Comment = {
      id,
      postId,
      authorId,
      content,
      likeCount: 0,
      createdAt: now,
      updatedAt: now
    };

    if (parentId) {
      comment.parentId = parentId;
    }

    this.comments.set(id, comment);
    return comment;
  }

  static async getCommentsByPost(postId: string): Promise<CommentWithReplies[]> {
    const comments: CommentWithReplies[] = [];
    const commentMap = new Map<string, CommentWithReplies>();

    // First pass: create all comments
    for (const comment of this.comments.values()) {
      if (comment.postId === postId) {
        const commentWithReplies: CommentWithReplies = {
          ...comment,
          replies: [],
          author: {
            id: comment.authorId,
            username: `user_${comment.authorId}`
          }
        };

        commentMap.set(comment.id, commentWithReplies);

        if (!comment.parentId) {
          comments.push(commentWithReplies);
        }
      }
    }

    // Second pass: organize replies
    for (const comment of commentMap.values()) {
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.replies.push(comment);
        }
      }
    }

    return comments;
  }

  static async updateCommentLikeCount(commentId: string, increment: boolean): Promise<void> {
    const comment = this.comments.get(commentId);
    if (comment) {
      comment.likeCount += increment ? 1 : -1;
      comment.updatedAt = new Date();
    }
  }

  // Share operations
  static async createShare(userId: string, postId: string): Promise<Share> {
    const id = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const share: Share = {
      id,
      userId,
      postId,
      createdAt: new Date()
    };

    const key = `${userId}_${postId}`;
    this.shares.set(key, share);
    return share;
  }

  static async findShare(userId: string, postId: string): Promise<Share | null> {
    const key = `${userId}_${postId}`;
    return this.shares.get(key) || null;
  }

  static async getShareCount(postId: string): Promise<number> {
    let count = 0;
    for (const share of this.shares.values()) {
      if (share.postId === postId) {
        count++;
      }
    }
    return count;
  }

  // Follow operations
  static async createFollow(followerId: string, followingId: string): Promise<Follow> {
    // Prevent self-following
    if (followerId === followingId) {
      throw new Error('Users cannot follow themselves');
    }

    const id = `follow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const follow: Follow = {
      id,
      followerId,
      followingId,
      createdAt: new Date()
    };

    const key = `${followerId}_${followingId}`;
    this.follows.set(key, follow);
    return follow;
  }

  static async deleteFollow(followerId: string, followingId: string): Promise<boolean> {
    const key = `${followerId}_${followingId}`;
    return this.follows.delete(key);
  }

  static async findFollow(followerId: string, followingId: string): Promise<Follow | null> {
    const key = `${followerId}_${followingId}`;
    return this.follows.get(key) || null;
  }

  static async getFollowerCount(userId: string): Promise<number> {
    let count = 0;
    for (const follow of this.follows.values()) {
      if (follow.followingId === userId) {
        count++;
      }
    }
    return count;
  }

  static async getFollowingCount(userId: string): Promise<number> {
    let count = 0;
    for (const follow of this.follows.values()) {
      if (follow.followerId === userId) {
        count++;
      }
    }
    return count;
  }

  static async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follow = await this.findFollow(followerId, followingId);
    return follow !== null;
  }
}