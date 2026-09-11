import { DatabaseConnection } from '../../config/database';
import { Like, Comment, Share, CommentWithReplies, Follow, FollowRequest } from './types';
import { v4 as uuidv4 } from 'uuid';

export class SocialDatabase {
  // Initialize database tables
  static async initializeTables(): Promise<void> {
    const client = await DatabaseConnection.getClient();
    
    try {
      // Create likes table
      await client.query(`
        CREATE TABLE IF NOT EXISTS likes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          target_id UUID NOT NULL,
          target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('post', 'comment')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, target_id, target_type)
        )
      `);

      // Create comments table
      await client.query(`
        CREATE TABLE IF NOT EXISTS comments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
          author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
          like_count INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create shares table
      await client.query(`
        CREATE TABLE IF NOT EXISTS shares (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, post_id)
        )
      `);

      // Create follows table
      await client.query(`
        CREATE TABLE IF NOT EXISTS follows (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(follower_id, following_id),
          CHECK (follower_id != following_id)
        )
      `);

      // Create follow_requests table
      await client.query(`
        CREATE TABLE IF NOT EXISTS follow_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          target_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(requester_id, target_id),
          CHECK (requester_id != target_id)
        )
      `);

      // Create indexes for better performance
      await client.query('CREATE INDEX IF NOT EXISTS idx_likes_target ON likes(target_id, target_type)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_shares_post ON shares(post_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_shares_user ON shares(user_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_follow_requests_requester ON follow_requests(requester_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_follow_requests_target ON follow_requests(target_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_follow_requests_status ON follow_requests(status)');

    } finally {
      client.release();
    }
  }

  // Like operations
  static async createLike(userId: string, targetId: string, targetType: 'post' | 'comment'): Promise<Like> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        `INSERT INTO likes (user_id, target_id, target_type) 
         VALUES ($1, $2, $3) 
         RETURNING id, user_id, target_id, target_type, created_at`,
        [userId, targetId, targetType]
      );

      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        targetId: row.target_id,
        targetType: row.target_type,
        createdAt: row.created_at
      };
    } finally {
      client.release();
    }
  }

  static async deleteLike(userId: string, targetId: string, targetType: 'post' | 'comment'): Promise<boolean> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        'DELETE FROM likes WHERE user_id = $1 AND target_id = $2 AND target_type = $3',
        [userId, targetId, targetType]
      );

      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  static async findLike(userId: string, targetId: string, targetType: 'post' | 'comment'): Promise<Like | null> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        'SELECT id, user_id, target_id, target_type, created_at FROM likes WHERE user_id = $1 AND target_id = $2 AND target_type = $3',
        [userId, targetId, targetType]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        targetId: row.target_id,
        targetType: row.target_type,
        createdAt: row.created_at
      };
    } finally {
      client.release();
    }
  }

  static async getLikeCount(targetId: string, targetType: 'post' | 'comment'): Promise<number> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        'SELECT COUNT(*) as count FROM likes WHERE target_id = $1 AND target_type = $2',
        [targetId, targetType]
      );

      return parseInt(result.rows[0].count);
    } finally {
      client.release();
    }
  }

  // Comment operations
  static async createComment(postId: string, authorId: string, content: string, parentId?: string): Promise<Comment> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        `INSERT INTO comments (post_id, author_id, content, parent_id) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, post_id, author_id, content, parent_id, like_count, created_at, updated_at`,
        [postId, authorId, content, parentId || null]
      );

      const row = result.rows[0];
      return {
        id: row.id,
        postId: row.post_id,
        authorId: row.author_id,
        content: row.content,
        parentId: row.parent_id,
        likeCount: row.like_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } finally {
      client.release();
    }
  }

  static async getCommentsByPost(postId: string): Promise<CommentWithReplies[]> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        `SELECT c.id, c.post_id, c.author_id, c.content, c.parent_id, c.like_count, 
                c.created_at, c.updated_at, u.username, u.profile_picture
         FROM comments c
         JOIN users u ON c.author_id = u.id
         WHERE c.post_id = $1
         ORDER BY c.created_at ASC`,
        [postId]
      );

      const comments: CommentWithReplies[] = [];
      const commentMap = new Map<string, CommentWithReplies>();

      // First pass: create all comments
      for (const row of result.rows) {
        const comment: CommentWithReplies = {
          id: row.id,
          postId: row.post_id,
          authorId: row.author_id,
          content: row.content,
          parentId: row.parent_id,
          likeCount: row.like_count,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          replies: [],
          author: {
            id: row.author_id,
            username: row.username,
            profilePicture: row.profile_picture
          }
        };

        commentMap.set(comment.id, comment);

        if (!comment.parentId) {
          comments.push(comment);
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
    } finally {
      client.release();
    }
  }

  static async updateCommentLikeCount(commentId: string, increment: boolean): Promise<void> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const operation = increment ? '+' : '-';
      await client.query(
        `UPDATE comments SET like_count = like_count ${operation} 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [commentId]
      );
    } finally {
      client.release();
    }
  }

  // Update post counts
  static async updatePostLikeCount(postId: string, increment: boolean): Promise<void> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const operation = increment ? '+' : '-';
      await client.query(
        `UPDATE posts SET like_count = like_count ${operation} 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [postId]
      );
    } finally {
      client.release();
    }
  }

  static async updatePostCommentCount(postId: string, increment: boolean): Promise<void> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const operation = increment ? '+' : '-';
      await client.query(
        `UPDATE posts SET comment_count = comment_count ${operation} 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [postId]
      );
    } finally {
      client.release();
    }
  }

  static async updatePostShareCount(postId: string, increment: boolean): Promise<void> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const operation = increment ? '+' : '-';
      await client.query(
        `UPDATE posts SET share_count = share_count ${operation} 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [postId]
      );
    } finally {
      client.release();
    }
  }

  // Share operations
  static async createShare(userId: string, postId: string): Promise<Share> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        `INSERT INTO shares (user_id, post_id) 
         VALUES ($1, $2) 
         RETURNING id, user_id, post_id, created_at`,
        [userId, postId]
      );

      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        postId: row.post_id,
        createdAt: row.created_at
      };
    } finally {
      client.release();
    }
  }

  static async findShare(userId: string, postId: string): Promise<Share | null> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        'SELECT id, user_id, post_id, created_at FROM shares WHERE user_id = $1 AND post_id = $2',
        [userId, postId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        postId: row.post_id,
        createdAt: row.created_at
      };
    } finally {
      client.release();
    }
  }

  static async getShareCount(postId: string): Promise<number> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        'SELECT COUNT(*) as count FROM shares WHERE post_id = $1',
        [postId]
      );

      return parseInt(result.rows[0].count);
    } finally {
      client.release();
    }
  }

  // Follow operations
  static async createFollow(followerId: string, followingId: string): Promise<Follow> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        `INSERT INTO follows (follower_id, following_id) 
         VALUES ($1, $2) 
         RETURNING id, follower_id, following_id, created_at`,
        [followerId, followingId]
      );

      const row = result.rows[0];
      return {
        id: row.id,
        followerId: row.follower_id,
        followingId: row.following_id,
        createdAt: row.created_at
      };
    } finally {
      client.release();
    }
  }

  static async deleteFollow(followerId: string, followingId: string): Promise<boolean> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
        [followerId, followingId]
      );

      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  static async findFollow(followerId: string, followingId: string): Promise<Follow | null> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        'SELECT id, follower_id, following_id, created_at FROM follows WHERE follower_id = $1 AND following_id = $2',
        [followerId, followingId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        followerId: row.follower_id,
        followingId: row.following_id,
        createdAt: row.created_at
      };
    } finally {
      client.release();
    }
  }

  static async getFollowerCount(userId: string): Promise<number> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        'SELECT COUNT(*) as count FROM follows WHERE following_id = $1',
        [userId]
      );

      return parseInt(result.rows[0].count);
    } finally {
      client.release();
    }
  }

  static async getFollowingCount(userId: string): Promise<number> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        'SELECT COUNT(*) as count FROM follows WHERE follower_id = $1',
        [userId]
      );

      return parseInt(result.rows[0].count);
    } finally {
      client.release();
    }
  }

  static async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follow = await this.findFollow(followerId, followingId);
    return follow !== null;
  }

  static async getFollowersList(userId: string): Promise<any[]> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        `SELECT u.id, u.username, u.email, u.bio, u.profile_picture as "profilePicture", u.is_private as "isPrivate", u.is_18_plus as "is18Plus"
         FROM follows f
         JOIN users u ON f.follower_id = u.id
         WHERE f.following_id = $1
         ORDER BY f.created_at DESC`,
        [userId]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  static async getFollowingList(userId: string): Promise<any[]> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        `SELECT u.id, u.username, u.email, u.bio, u.profile_picture as "profilePicture", u.is_private as "isPrivate", u.is_18_plus as "is18Plus"
         FROM follows f
         JOIN users u ON f.following_id = u.id
         WHERE f.follower_id = $1
         ORDER BY f.created_at DESC`,
        [userId]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Data export methods
  static async getUserComments(userId: string): Promise<Comment[]> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        `SELECT id, post_id, author_id, content, parent_id, like_count, created_at, updated_at
         FROM comments 
         WHERE author_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows.map(row => ({
        id: row.id,
        postId: row.post_id,
        authorId: row.author_id,
        content: row.content,
        parentId: row.parent_id,
        likeCount: row.like_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } finally {
      client.release();
    }
  }

  static async getUserLikes(userId: string): Promise<Like[]> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        `SELECT id, user_id, target_id, target_type, created_at
         FROM likes 
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        targetId: row.target_id,
        targetType: row.target_type,
        createdAt: row.created_at
      }));
    } finally {
      client.release();
    }
  }

  static async getUserShares(userId: string): Promise<Share[]> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        `SELECT id, user_id, post_id, created_at
         FROM shares 
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        postId: row.post_id,
        createdAt: row.created_at
      }));
    } finally {
      client.release();
    }
  }

  static async getUserFollowing(userId: string): Promise<Follow[]> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        `SELECT id, follower_id, following_id, created_at
         FROM follows 
         WHERE follower_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows.map(row => ({
        id: row.id,
        followerId: row.follower_id,
        followingId: row.following_id,
        createdAt: row.created_at
      }));
    } finally {
      client.release();
    }
  }

  static async getUserFollowers(userId: string): Promise<Follow[]> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        `SELECT id, follower_id, following_id, created_at
         FROM follows 
         WHERE following_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows.map(row => ({
        id: row.id,
        followerId: row.follower_id,
        followingId: row.following_id,
        createdAt: row.created_at
      }));
    } finally {
      client.release();
    }
  }

  // Data deletion methods
  static async deleteUserLikes(userId: string): Promise<void> {
    await DatabaseConnection.query(
      'DELETE FROM likes WHERE user_id = $1',
      [userId]
    );
  }

  static async deleteUserComments(userId: string): Promise<void> {
    await DatabaseConnection.query(
      'DELETE FROM comments WHERE author_id = $1',
      [userId]
    );
  }

  static async deleteUserShares(userId: string): Promise<void> {
    await DatabaseConnection.query(
      'DELETE FROM shares WHERE user_id = $1',
      [userId]
    );
  }

  static async deleteUserFollows(userId: string): Promise<void> {
    await DatabaseConnection.query(
      'DELETE FROM follows WHERE follower_id = $1 OR following_id = $1',
      [userId]
    );
  }

  // Follow Request operations
  static async createFollowRequest(requesterId: string, targetId: string): Promise<FollowRequest> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        `INSERT INTO follow_requests (requester_id, target_id, status) 
         VALUES ($1, $2, 'pending') 
         RETURNING id, requester_id, target_id, status, created_at, updated_at`,
        [requesterId, targetId]
      );

      const row = result.rows[0];
      return {
        id: row.id,
        requesterId: row.requester_id,
        targetId: row.target_id,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } finally {
      client.release();
    }
  }

  static async findFollowRequest(requesterId: string, targetId: string): Promise<FollowRequest | null> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        'SELECT id, requester_id, target_id, status, created_at, updated_at FROM follow_requests WHERE requester_id = $1 AND target_id = $2',
        [requesterId, targetId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        requesterId: row.requester_id,
        targetId: row.target_id,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } finally {
      client.release();
    }
  }

  static async updateFollowRequestStatus(requestId: string, status: 'accepted' | 'declined', targetId?: string): Promise<FollowRequest | null> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const query = targetId
        ? `UPDATE follow_requests 
           SET status = $1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2 AND target_id = $3 AND status = 'pending'
           RETURNING id, requester_id, target_id, status, created_at, updated_at`
        : `UPDATE follow_requests 
           SET status = $1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2 AND status = 'pending'
           RETURNING id, requester_id, target_id, status, created_at, updated_at`;

      const params = targetId ? [status, requestId, targetId] : [status, requestId];
      const result = await client.query(query, params);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        requesterId: row.requester_id,
        targetId: row.target_id,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } finally {
      client.release();
    }
  }

  static async deleteFollowRequest(requesterId: string, targetId: string): Promise<boolean> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        'DELETE FROM follow_requests WHERE requester_id = $1 AND target_id = $2',
        [requesterId, targetId]
      );

      return (result.rowCount ?? 0) > 0;
    } finally {
      client.release();
    }
  }

  static async getPendingFollowRequests(userId: string): Promise<FollowRequest[]> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(
        `SELECT id, requester_id, target_id, status, created_at, updated_at
         FROM follow_requests 
         WHERE target_id = $1 AND status = 'pending'
         ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows.map(row => ({
        id: row.id,
        requesterId: row.requester_id,
        targetId: row.target_id,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } finally {
      client.release();
    }
  }

  static async deleteUserFollowRequests(userId: string): Promise<void> {
    await DatabaseConnection.query(
      'DELETE FROM follow_requests WHERE requester_id = $1 OR target_id = $1',
      [userId]
    );
  }
}