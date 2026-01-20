import { DatabaseConnection } from '../../config/database';
import { Post, MediaFile, CreatePostRequest, PostWithMedia } from './types';
import { v4 as uuidv4 } from 'uuid';

export class ContentDatabase {
  static async searchPosts(query: string, page: number, limit: number): Promise<{ posts: any[]; totalCount: number }> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const offset = (page - 1) * limit;
      
      const searchQuery = `
        SELECT 
          p.*,
          u.username as author_username,
          u.profile_picture as author_profile_picture,
          COALESCE(
            json_agg(
              json_build_object(
                'id', mf.id,
                'filename', mf.filename,
                'originalName', mf.original_name,
                'mimeType', mf.mime_type,
                'size', mf.size_bytes,
                'url', mf.url
              )
            ) FILTER (WHERE mf.id IS NOT NULL), 
            '[]'
          ) as media
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN post_media pm ON p.id = pm.post_id
        LEFT JOIN media_files mf ON pm.media_id = mf.id
        WHERE p.is_public = true 
          AND LOWER(p.content) LIKE LOWER('%' || $1 || '%')
        GROUP BY p.id, u.username, u.profile_picture
        ORDER BY p.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM posts p
        WHERE p.is_public = true 
          AND LOWER(p.content) LIKE LOWER('%' || $1 || '%')
      `;

      const [searchResult, countResult] = await Promise.all([
        client.query(searchQuery, [query, limit, offset]),
        client.query(countQuery, [query])
      ]);

      const posts = searchResult.rows.map((row: any) => {
        const media = Array.isArray(row.media) ? row.media : [];
        
        return {
          type: 'post',
          id: row.id,
          authorId: row.author_id,
          author: {
            username: row.author_username,
            profilePicture: row.author_profile_picture
          },
          title: row.content.length > 100 ? row.content.substring(0, 100) + '...' : row.content,
          content: row.content,
          excerpt: row.content.length > 200 ? row.content.substring(0, 200) + '...' : row.content,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          mediaType: row.media_type,
          mediaUrls: media.map((m: any) => m.url),
          likeCount: row.like_count,
          commentCount: row.comment_count,
          shareCount: row.share_count,
          isPublic: row.is_public
        };
      });

      const totalCount = parseInt(countResult.rows[0].total);

      return { posts, totalCount };

    } finally {
      client.release();
    }
  }
  static async initializeTables(): Promise<void> {
    const client = await DatabaseConnection.getClient();
    
    try {
      // Create posts table
      await client.query(`
        CREATE TABLE IF NOT EXISTS posts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          media_type VARCHAR(10) NOT NULL DEFAULT 'text' CHECK (media_type IN ('image', 'video', 'text')),
          like_count INTEGER NOT NULL DEFAULT 0,
          comment_count INTEGER NOT NULL DEFAULT 0,
          share_count INTEGER NOT NULL DEFAULT 0,
          is_public BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create media_files table
      await client.query(`
        CREATE TABLE IF NOT EXISTS media_files (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          filename VARCHAR(255) NOT NULL,
          original_name VARCHAR(255) NOT NULL,
          mime_type VARCHAR(100) NOT NULL,
          size_bytes BIGINT NOT NULL,
          url TEXT NOT NULL,
          uploader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create post_media junction table for many-to-many relationship
      await client.query(`
        CREATE TABLE IF NOT EXISTS post_media (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
          media_id UUID NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(post_id, media_id)
        );
      `);

      // Create indexes for better performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
        CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_posts_is_public ON posts(is_public);
        CREATE INDEX IF NOT EXISTS idx_media_files_uploader_id ON media_files(uploader_id);
        CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON post_media(post_id);
        CREATE INDEX IF NOT EXISTS idx_post_media_media_id ON post_media(media_id);
      `);

    } finally {
      client.release();
    }
  }

  static async createPost(authorId: string, postData: CreatePostRequest): Promise<Post> {
    const client = await DatabaseConnection.getClient();
    
    try {
      await client.query('BEGIN');

      const postId = uuidv4();
      let mediaUrls: string[] = [];
      let mediaType = 'text';

      // If mediaIds are provided, get the media URLs
      if (postData.mediaIds && postData.mediaIds.length > 0) {
        const mediaResult = await client.query(
          `SELECT id, url, mime_type FROM media_files WHERE id = ANY($1)`,
          [postData.mediaIds]
        );

        if (mediaResult.rows.length !== postData.mediaIds.length) {
          throw new Error('One or more media files not found');
        }

        mediaUrls = mediaResult.rows.map(row => row.url);
        // Determine media type based on first file
        mediaType = mediaResult.rows[0].mime_type.startsWith('image/') ? 'image' : 'video';
      }

      const result = await client.query(
        `INSERT INTO posts (id, author_id, content, media_urls, media_type, is_public)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [postId, authorId, postData.content, mediaUrls, mediaType, postData.isPublic ?? true]
      );

      const post = this.mapRowToPost(result.rows[0]);

      await client.query('COMMIT');
      return post;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getFeed(options: { limit: number; offset: number; userId?: string }): Promise<PostWithMedia[]> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const params: any[] = [];
      let paramCount = 1;
      let query = `
        SELECT p.*
        FROM posts p
        WHERE p.is_public = true
      `;

      if (options.userId) {
        query += ` AND p.author_id = $${paramCount++}`;
        params.push(options.userId);
      }

      query += `
        ORDER BY p.created_at DESC
        LIMIT $${paramCount++} OFFSET $${paramCount++}
      `;

      params.push(options.limit, options.offset);

      const result = await client.query(query, params);

      // Convert to PostWithMedia format with proper media URLs from database
      return result.rows.map(row => {
        const post = this.mapRowToPost(row);
        return {
          ...post,
          media: []
        };
      });

    } finally {
      client.release();
    }
  }

  static async findPostById(postId: string): Promise<Post | null> {
    const result = await DatabaseConnection.query(
      `SELECT * FROM posts WHERE id = $1`,
      [postId]
    );

    const rows = (result as any).rows;
    return rows && rows.length > 0 ? this.mapRowToPost(rows[0]) : null;
  }

  static async findPostWithMedia(postId: string): Promise<PostWithMedia | null> {
    const client = await DatabaseConnection.getClient();
    
    try {
      // Get the post
      const postResult = await client.query(
        `SELECT * FROM posts WHERE id = $1`,
        [postId]
      );

      if (postResult.rows.length === 0) {
        return null;
      }

      const post = this.mapRowToPost(postResult.rows[0]);

      // For now, we'll use the media_urls from the post directly
      // In the future, we could join with media_files table for more details
      const postWithMedia: PostWithMedia = {
        ...post,
        media: [] // This could be populated with full media file objects if needed
      };

      return postWithMedia;

    } finally {
      client.release();
    }
  }

  static async findMediaFileById(mediaId: string): Promise<MediaFile | null> {
    const result = await DatabaseConnection.query(
      `SELECT * FROM media_files WHERE id = $1`,
      [mediaId]
    );

    const rows = (result as any).rows;
    return rows && rows.length > 0 ? this.mapRowToMediaFile(rows[0]) : null;
  }

  static async updatePost(postId: string, authorId: string, updates: Partial<Post>): Promise<PostWithMedia | null> {
    const client = await DatabaseConnection.getClient();
    
    try {
      // Build dynamic update query
      const updateFields = [];
      const values = [];
      let paramCount = 1;

      if (updates.content !== undefined) {
        updateFields.push(`content = $${paramCount++}`);
        values.push(updates.content);
      }

      if (updates.isPublic !== undefined) {
        updateFields.push(`is_public = $${paramCount++}`);
        values.push(updates.isPublic);
      }

      if (updateFields.length === 0) {
        return this.findPostWithMedia(postId);
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(postId, authorId);

      const query = `
        UPDATE posts 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount++} AND author_id = $${paramCount++}
        RETURNING *
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      return this.findPostWithMedia(postId);

    } finally {
      client.release();
    }
  }

  static async deletePost(postId: string, authorId: string): Promise<boolean> {
    const result = await DatabaseConnection.query(
      `DELETE FROM posts WHERE id = $1 AND author_id = $2`,
      [postId, authorId]
    );

    return (result as any).rowCount > 0;
  }

  static async getUserPostCount(userId: string): Promise<number> {
    const result = await DatabaseConnection.query(
      `SELECT COUNT(*) as count FROM posts WHERE author_id = $1`,
      [userId]
    );

    const rows = (result as any).rows;
    return rows && rows.length > 0 ? parseInt(rows[0].count) : 0;
  }

  static async getPostsByAuthor(authorId: string, options: { 
    limit: number; 
    offset: number; 
    viewerId?: string;
    includePrivate?: boolean;
  }): Promise<PostWithMedia[]> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const params: any[] = [];
      let paramCount = 1;
      
      let query = `
        SELECT p.*,
               u.username as author_username,
               u.profile_picture as author_profile_picture
      `;
      
      // Add like status if viewer is provided
      if (options.viewerId) {
        query += `,
               CASE WHEN l.id IS NOT NULL THEN true ELSE false END as is_liked
        `;
      }
      
      query += `
        FROM posts p
        JOIN users u ON p.author_id = u.id
      `;
      
      // Add left join for likes if viewer is provided
      if (options.viewerId) {
        query += `
        LEFT JOIN likes l ON p.id = l.target_id 
                         AND l.target_type = 'post' 
                         AND l.user_id = $${paramCount++}
        `;
        params.push(options.viewerId);
      }
      
      query += `
        WHERE p.author_id = $${paramCount++}
      `;
      params.push(authorId);
      
      // Add privacy filter if not including private posts
      if (!options.includePrivate) {
        query += ` AND p.is_public = true`;
      }
      
      query += `
        ORDER BY p.created_at DESC
        LIMIT $${paramCount++} OFFSET $${paramCount++}
      `;

      params.push(options.limit, options.offset);

      const result = await client.query(query, params);

      // Convert to PostWithMedia format
      return result.rows.map(row => {
        const post = this.mapRowToPost(row);
        return {
          ...post,
          isLiked: options.viewerId ? row.is_liked : undefined,
          author: {
            id: post.authorId,
            username: row.author_username,
            profilePicture: row.author_profile_picture
          },
          media: []
        };
      });

    } finally {
      client.release();
    }
  }

  static async getTrendingPosts(limit: number = 10): Promise<PostWithMedia[]> {
    // Simple trending algorithm based on recent activity
    const client = await DatabaseConnection.getClient();
    
    try {
      const result = await client.query(`
        SELECT p.*
        FROM posts p
        WHERE p.is_public = true
          AND p.created_at > NOW() - INTERVAL '7 days'
        ORDER BY (p.like_count + p.comment_count + p.share_count) DESC, p.created_at DESC
        LIMIT $1
      `, [limit]);

      return result.rows.map(row => {
        const post = this.mapRowToPost(row);
        return {
          ...post,
          media: []
        };
      });

    } finally {
      client.release();
    }
  }

  static async getPostById(postId: string): Promise<Post | null> {
    return this.findPostById(postId);
  }

  static async createMediaFile(mediaData: Omit<MediaFile, 'id' | 'createdAt'>): Promise<MediaFile> {
    const mediaId = uuidv4();
    
    const result = await DatabaseConnection.query(
      `INSERT INTO media_files (id, filename, original_name, mime_type, size_bytes, url, uploader_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [mediaId, mediaData.filename, mediaData.originalName, mediaData.mimeType, 
       mediaData.size, mediaData.url, mediaData.uploadedBy]
    );

    const rows = (result as any).rows;
    return this.mapRowToMediaFile(rows[0]);
  }

  private static mapRowToPost(row: any): Post {
    return {
      id: row.id,
      authorId: row.author_id,
      content: row.content,
      mediaUrls: row.media_urls || [],
      mediaType: row.media_type,
      likeCount: row.like_count,
      commentCount: row.comment_count,
      shareCount: row.share_count,
      isPublic: row.is_public,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private static mapRowToMediaFile(row: any): MediaFile {
    return {
      id: row.id,
      filename: row.filename,
      originalName: row.original_name,
      mimeType: row.mime_type,
      size: row.size_bytes,
      url: row.url,
      uploadedBy: row.uploader_id,
      createdAt: new Date(row.created_at)
    };
  }

  // Enhanced feed methods for algorithmic and follow-based feeds
  static async getEnhancedFeed(options: { 
    limit: number; 
    offset: number; 
    userId?: string; 
    sortBy?: 'chronological' | 'algorithmic';
    followingOnly?: boolean;
  }): Promise<PostWithMedia[]> {
    // Use getFeedWithLikes to include author information
    return await this.getFeedWithLikes({
      limit: options.limit,
      offset: options.offset,
      userId: options.userId
    });
  }

  static async getFeedWithLikes(options: { limit: number; offset: number; userId?: string }): Promise<PostWithMedia[]> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const params: any[] = [];
      let paramCount = 1;
      
      let query = `
        SELECT p.*,
               u.username as author_username,
               u.profile_picture as author_profile_picture
      `;
      
      // Add like status if user is provided
      if (options.userId) {
        query += `,
               CASE WHEN l.id IS NOT NULL THEN true ELSE false END as is_liked
        `;
      }
      
      query += `
        FROM posts p
        JOIN users u ON p.author_id = u.id
      `;
      
      // Add left join for likes if user is provided
      if (options.userId) {
        query += `
        LEFT JOIN likes l ON p.id = l.target_id 
                         AND l.target_type = 'post' 
                         AND l.user_id = $${paramCount++}
        `;
        params.push(options.userId);
      }
      
      query += `
        WHERE p.is_public = true
        ORDER BY p.created_at DESC
        LIMIT $${paramCount++} OFFSET $${paramCount++}
      `;

      params.push(options.limit, options.offset);

      const result = await client.query(query, params);

      // Convert to PostWithMedia format with proper media URLs from database
      return result.rows.map(row => {
        const post = this.mapRowToPost(row);
        return {
          ...post,
          isLiked: options.userId ? row.is_liked : undefined,
          author: {
            id: post.authorId,
            username: row.author_username,
            profilePicture: row.author_profile_picture
          },
          media: []
        };
      });

    } finally {
      client.release();
    }
  }

  // Data deletion methods for account deletion
  static async deleteUserPosts(userId: string): Promise<void> {
    const client = await DatabaseConnection.getClient();
    
    try {
      await client.query('BEGIN');

      // First, delete post-media relationships
      await client.query(`
        DELETE FROM post_media 
        WHERE post_id IN (
          SELECT id FROM posts WHERE author_id = $1
        )
      `, [userId]);

      // Then delete the posts
      await client.query(
        'DELETE FROM posts WHERE author_id = $1',
        [userId]
      );

      await client.query('COMMIT');
      console.log(`Deleted all posts for user ${userId}`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting user posts:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async deleteUserMedia(userId: string): Promise<void> {
    const client = await DatabaseConnection.getClient();
    
    try {
      await client.query('BEGIN');

      // Delete media files uploaded by the user
      // Note: This only deletes database records, not actual files from disk
      // In a production system, you'd also want to delete the physical files
      const result = await client.query(
        'DELETE FROM media_files WHERE uploader_id = $1 RETURNING filename, url',
        [userId]
      );

      await client.query('COMMIT');
      console.log(`Deleted ${result.rowCount} media files for user ${userId}`);
      
      // TODO: In production, also delete physical files from disk
      // result.rows.forEach(row => {
      //   const filePath = path.join(uploadsDir, row.filename);
      //   fs.unlink(filePath, (err) => {
      //     if (err) console.error('Error deleting file:', err);
      //   });
      // });
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting user media:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}