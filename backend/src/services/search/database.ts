import { DatabaseConnection } from '../../config/database';
import { SearchQuery, SearchResult, TrendingContent, FeedOptions } from './types';

export class SearchDatabase {
  static async initializeTables(): Promise<void> {
    const client = await DatabaseConnection.getClient();
    
    try {
      // Create full-text search indexes for posts
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_posts_content_search 
        ON posts USING GIN(to_tsvector('english', content));
      `);

      // Create composite indexes for better search performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_posts_search_composite 
        ON posts(is_public, created_at DESC) WHERE is_public = true;
      `);

      // Create materialized view for trending content (optional optimization)
      await client.query(`
        CREATE MATERIALIZED VIEW IF NOT EXISTS trending_posts AS
        SELECT 
          p.id,
          p.author_id,
          p.content,
          p.created_at,
          (p.like_count * 3 + p.comment_count * 2 + p.share_count * 4) as engagement_score,
          EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - p.created_at)) / 3600 as hours_old
        FROM posts p
        WHERE p.is_public = true 
          AND p.created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
        ORDER BY 
          (p.like_count * 3 + p.comment_count * 2 + p.share_count * 4) / 
          POWER(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - p.created_at)) / 3600 + 2, 1.5) DESC;
      `);

      // Create index on the materialized view
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_trending_posts_id 
        ON trending_posts(id);
      `);

    } finally {
      client.release();
    }
  }

  static async searchUsers(query: string, page: number, limit: number): Promise<{ results: any[]; totalCount: number }> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const offset = (page - 1) * limit;
      
      // Search users by username and bio
      const searchQuery = `
        SELECT 
          u.id,
          u.username,
          u.email,
          u.bio,
          u.profile_picture,
          u.is_private,
          u.created_at,
          u.updated_at,
          GREATEST(
            CASE WHEN LOWER(u.username) LIKE LOWER('%' || $1 || '%') THEN 2.0 ELSE 0.0 END,
            CASE WHEN LOWER(u.bio) LIKE LOWER('%' || $1 || '%') THEN 1.0 ELSE 0.0 END,
            0.1
          ) as relevance_score
        FROM users u
        WHERE (
          LOWER(u.username) LIKE LOWER('%' || $1 || '%') OR
          LOWER(u.bio) LIKE LOWER('%' || $1 || '%')
        )
        ORDER BY relevance_score DESC, u.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM users u
        WHERE (
          LOWER(u.username) LIKE LOWER('%' || $1 || '%') OR
          LOWER(u.bio) LIKE LOWER('%' || $1 || '%')
        )
      `;

      const [searchResult, countResult] = await Promise.all([
        client.query(searchQuery, [query, limit, offset]),
        client.query(countQuery, [query])
      ]);

      const results = searchResult.rows.map((row: any) => ({
        id: row.id,
        username: row.username,
        email: row.email,
        bio: row.bio,
        profilePicture: row.profile_picture,
        isPrivate: row.is_private,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        relevanceScore: parseFloat(row.relevance_score)
      }));

      const totalCount = parseInt(countResult.rows[0].total);

      return { results, totalCount };

    } finally {
      client.release();
    }
  }

  static async searchContent(searchQuery: SearchQuery): Promise<{ results: SearchResult[]; totalCount: number }> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const results: SearchResult[] = [];
      let totalCount = 0;

      const { query, contentType = 'all', tags, page = 1, limit = 20, sortBy = 'relevance' } = searchQuery;
      const offset = (page - 1) * limit;

      // Calculate how many items to fetch from each source
      const itemsPerSource = contentType === 'all' ? Math.ceil(limit / 2) : limit;

      if (contentType !== 'blogs') {
        // Search posts using PostgreSQL full-text search
        const postResults = await this.searchPosts(client, query, itemsPerSource, offset, sortBy);
        results.push(...postResults.results);
        totalCount += postResults.totalCount;
      }

      if (contentType !== 'posts') {
        // Search blogs using PostgreSQL full-text search
        const blogResults = await this.searchBlogs(client, query, tags, itemsPerSource, offset, sortBy);
        results.push(...blogResults.results);
        totalCount += blogResults.totalCount;
      }

      // Sort combined results
      if (contentType === 'all') {
        results.sort((a, b) => {
          if (sortBy === 'relevance') {
            return b.relevanceScore - a.relevanceScore;
          } else {
            const dateA = new Date(a.publishedAt || a.createdAt);
            const dateB = new Date(b.publishedAt || b.createdAt);
            return dateB.getTime() - dateA.getTime();
          }
        });

        // Limit to requested number of items
        const limitedResults = results.slice(0, limit);
        return { results: limitedResults, totalCount: limitedResults.length };
      }

      return { results, totalCount };

    } finally {
      client.release();
    }
  }

  private static async searchPosts(
    client: any, 
    query: string, 
    limit: number, 
    offset: number, 
    sortBy: string
  ): Promise<{ results: SearchResult[]; totalCount: number }> {
    
    // Use PostgreSQL full-text search with ranking
    const searchQuery = `
      SELECT 
        p.*,
        GREATEST(
          ts_rank(to_tsvector('english', p.content), plainto_tsquery('english', $1)),
          0.1
        ) as relevance_score,
        COALESCE(
          json_agg(
            json_build_object(
              'id', mf.id,
              'filename', mf.filename,
              'originalName', mf.original_name,
              'mimeType', mf.mime_type,
              'size', mf.size,
              'url', mf.url,
              'uploadedBy', mf.uploaded_by,
              'createdAt', mf.created_at
            )
          ) FILTER (WHERE mf.id IS NOT NULL), 
          '[]'
        ) as media
      FROM posts p
      LEFT JOIN post_media pm ON p.id = pm.post_id
      LEFT JOIN media_files mf ON pm.media_id = mf.id
      WHERE p.is_public = true 
        AND (
          to_tsvector('english', p.content) @@ plainto_tsquery('english', $1)
          OR LOWER(p.content) LIKE LOWER('%' || $1 || '%')
        )
      GROUP BY p.id
      ORDER BY ${sortBy === 'relevance' ? 'relevance_score DESC' : 'p.created_at DESC'}
      LIMIT $2 OFFSET $3
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM posts p
      WHERE p.is_public = true 
        AND (
          to_tsvector('english', p.content) @@ plainto_tsquery('english', $1)
          OR LOWER(p.content) LIKE LOWER('%' || $1 || '%')
        )
    `;

    const [searchResult, countResult] = await Promise.all([
      client.query(searchQuery, [query, limit, offset]),
      client.query(countQuery, [query])
    ]);

    const results: SearchResult[] = searchResult.rows.map((row: any) => {
      const media = Array.isArray(row.media) ? row.media : [];
      
      return {
        type: 'post' as const,
        id: row.id,
        authorId: row.author_id,
        title: this.generatePostTitle(row.content),
        content: row.content,
        excerpt: this.generateExcerpt(row.content),
        relevanceScore: Math.max(parseFloat(row.relevance_score) || 0, 0.1),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        mediaType: row.media_type,
        mediaUrls: media.map((m: any) => m.url),
        likeCount: row.like_count,
        commentCount: row.comment_count,
        shareCount: row.share_count,
        isPublic: row.is_public
      };
    });

    const totalCount = parseInt(countResult.rows[0].total);

    return { results, totalCount };
  }

  private static async searchBlogs(
    client: any, 
    query: string, 
    tags: string[] | undefined, 
    limit: number, 
    offset: number, 
    sortBy: string
  ): Promise<{ results: SearchResult[]; totalCount: number }> {
    
    let whereConditions = [
      'b.is_draft = false',
      `(
        to_tsvector('english', b.title) @@ plainto_tsquery('english', $1) OR 
        to_tsvector('english', b.content) @@ plainto_tsquery('english', $1) OR
        LOWER(b.title) LIKE LOWER('%' || $1 || '%') OR
        LOWER(b.content) LIKE LOWER('%' || $1 || '%')
      )`
    ];
    
    let params = [query];
    let paramCount = 2;

    if (tags && tags.length > 0) {
      whereConditions.push(`b.tags && $${paramCount++}`);
      params.push(tags);
    }

    const searchQuery = `
      SELECT 
        b.*,
        GREATEST(
          (
            ts_rank(to_tsvector('english', b.title), plainto_tsquery('english', $1)) * 2 +
            ts_rank(to_tsvector('english', b.content), plainto_tsquery('english', $1))
          ),
          0.1
        ) as relevance_score
      FROM blogs b
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ${sortBy === 'relevance' ? 'relevance_score DESC' : 'b.published_at DESC'}
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM blogs b
      WHERE ${whereConditions.join(' AND ')}
    `;

    params.push(limit, offset);

    const [searchResult, countResult] = await Promise.all([
      client.query(searchQuery, params),
      client.query(countQuery, params.slice(0, -2)) // Remove limit and offset for count
    ]);

    const results: SearchResult[] = searchResult.rows.map((row: any) => ({
      type: 'blog' as const,
      id: row.id,
      authorId: row.author_id,
      title: row.title,
      content: row.content,
      excerpt: row.excerpt || this.generateExcerpt(row.content),
      relevanceScore: Math.max(parseFloat(row.relevance_score) || 0, 0.1),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      publishedAt: row.published_at ? new Date(row.published_at) : undefined,
      tags: row.tags || [],
      isDraft: row.is_draft
    }));

    const totalCount = parseInt(countResult.rows[0].total);

    return { results, totalCount };
  }

  static async getEnhancedFeed(options: FeedOptions): Promise<{ content: SearchResult[]; totalCount: number; trending?: TrendingContent[] }> {
    const client = await DatabaseConnection.getClient();
    
    try {
      const results: SearchResult[] = [];
      let totalCount = 0;
      let trending: TrendingContent[] = [];

      const { userId, page = 1, limit = 20, sortBy = 'chronological', contentType = 'all', followingOnly = false } = options;
      const offset = (page - 1) * limit;

      // Get trending content if algorithmic sort is requested
      if (sortBy === 'algorithmic') {
        trending = await this.getTrendingContent(client, 5);
      }

      // Calculate how many items to fetch from each source
      const itemsPerSource = contentType === 'all' ? Math.ceil(limit / 2) : limit;

      if (contentType !== 'blogs') {
        const postResults = await this.getFeedPosts(client, userId, itemsPerSource, offset, sortBy, followingOnly);
        results.push(...postResults.results);
        totalCount += postResults.totalCount;
      }

      if (contentType !== 'posts') {
        const blogResults = await this.getFeedBlogs(client, userId, itemsPerSource, offset, sortBy, followingOnly);
        results.push(...blogResults.results);
        totalCount += blogResults.totalCount;
      }

      // Sort combined results
      if (contentType === 'all') {
        results.sort((a, b) => {
          if (sortBy === 'algorithmic') {
            // Combine engagement score with recency
            const scoreA = this.calculateEngagementScore(a);
            const scoreB = this.calculateEngagementScore(b);
            return scoreB - scoreA;
          } else {
            const dateA = new Date(a.publishedAt || a.createdAt);
            const dateB = new Date(b.publishedAt || b.createdAt);
            return dateB.getTime() - dateA.getTime();
          }
        });

        // Limit to requested number of items
        const limitedResults = results.slice(0, limit);
        return { content: limitedResults, totalCount: limitedResults.length, trending };
      }

      return { content: results, totalCount, trending };

    } finally {
      client.release();
    }
  }

  private static async getFeedPosts(
    client: any, 
    userId: string | undefined, 
    limit: number, 
    offset: number, 
    sortBy: string, 
    followingOnly: boolean
  ): Promise<{ results: SearchResult[]; totalCount: number }> {
    
    let whereConditions = ['p.is_public = true'];
    let params: any[] = [];
    let paramCount = 1;
    let joinClause = '';

    if (followingOnly && userId) {
      joinClause = 'JOIN follows f ON p.author_id = f.following_id';
      whereConditions.push(`f.follower_id = $${paramCount++}`);
      params.push(userId);
    }

    const orderBy = sortBy === 'algorithmic' 
      ? '(p.like_count * 3 + p.comment_count * 2 + p.share_count * 4) / POWER(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - p.created_at)) / 3600 + 2, 1.5) DESC'
      : 'p.created_at DESC';

    const query = `
      SELECT 
        p.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', mf.id,
              'filename', mf.filename,
              'originalName', mf.original_name,
              'mimeType', mf.mime_type,
              'size', mf.size,
              'url', mf.url,
              'uploadedBy', mf.uploaded_by,
              'createdAt', mf.created_at
            )
          ) FILTER (WHERE mf.id IS NOT NULL), 
          '[]'
        ) as media
      FROM posts p
      ${joinClause}
      LEFT JOIN post_media pm ON p.id = pm.post_id
      LEFT JOIN media_files mf ON pm.media_id = mf.id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY p.id
      ORDER BY ${orderBy}
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM posts p
      ${joinClause}
      WHERE ${whereConditions.join(' AND ')}
    `;

    params.push(limit, offset);

    const [searchResult, countResult] = await Promise.all([
      client.query(query, params),
      client.query(countQuery, params.slice(0, -2))
    ]);

    const results: SearchResult[] = searchResult.rows.map((row: any) => {
      const media = Array.isArray(row.media) ? row.media : [];
      
      return {
        type: 'post' as const,
        id: row.id,
        authorId: row.author_id,
        title: this.generatePostTitle(row.content),
        content: row.content,
        excerpt: this.generateExcerpt(row.content),
        relevanceScore: 0, // Not applicable for feed
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        mediaType: row.media_type,
        mediaUrls: media.map((m: any) => m.url),
        likeCount: row.like_count,
        commentCount: row.comment_count,
        shareCount: row.share_count,
        isPublic: row.is_public
      };
    });

    const totalCount = parseInt(countResult.rows[0].total);

    return { results, totalCount };
  }

  private static async getFeedBlogs(
    client: any, 
    userId: string | undefined, 
    limit: number, 
    offset: number, 
    sortBy: string, 
    followingOnly: boolean
  ): Promise<{ results: SearchResult[]; totalCount: number }> {
    
    let whereConditions = ['b.is_draft = false'];
    let params: any[] = [];
    let paramCount = 1;
    let joinClause = '';

    if (followingOnly && userId) {
      joinClause = 'JOIN follows f ON b.author_id = f.following_id';
      whereConditions.push(`f.follower_id = $${paramCount++}`);
      params.push(userId);
    }

    const orderBy = sortBy === 'algorithmic' 
      ? 'b.published_at DESC' // For blogs, we'll use published date as primary sort
      : 'b.published_at DESC';

    const query = `
      SELECT b.*
      FROM blogs b
      ${joinClause}
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;

    const countQuery = `
      SELECT COUNT(DISTINCT b.id) as total
      FROM blogs b
      ${joinClause}
      WHERE ${whereConditions.join(' AND ')}
    `;

    params.push(limit, offset);

    const [searchResult, countResult] = await Promise.all([
      client.query(query, params),
      client.query(countQuery, params.slice(0, -2))
    ]);

    const results: SearchResult[] = searchResult.rows.map((row: any) => ({
      type: 'blog' as const,
      id: row.id,
      authorId: row.author_id,
      title: row.title,
      content: row.content,
      excerpt: row.excerpt || this.generateExcerpt(row.content),
      relevanceScore: 0, // Not applicable for feed
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      publishedAt: row.published_at ? new Date(row.published_at) : undefined,
      tags: row.tags || [],
      isDraft: row.is_draft
    }));

    const totalCount = parseInt(countResult.rows[0].total);

    return { results, totalCount };
  }

  private static async getTrendingContent(client: any, limit: number): Promise<TrendingContent[]> {
    try {
      // Refresh materialized view
      await client.query('REFRESH MATERIALIZED VIEW trending_posts');

      const query = `
        SELECT 
          tp.id,
          tp.author_id,
          tp.content,
          tp.created_at,
          tp.engagement_score
        FROM trending_posts tp
        ORDER BY tp.engagement_score DESC
        LIMIT $1
      `;

      const result = await client.query(query, [limit]);

      return result.rows.map((row: any) => ({
        type: 'post' as const,
        id: row.id,
        title: this.generatePostTitle(row.content),
        excerpt: this.generateExcerpt(row.content),
        engagementScore: parseFloat(row.engagement_score),
        createdAt: new Date(row.created_at)
      }));

    } catch (error) {
      console.error('Error getting trending content:', error);
      return [];
    }
  }

  private static calculateEngagementScore(content: SearchResult): number {
    if (content.type === 'post') {
      const likes = content.likeCount || 0;
      const comments = content.commentCount || 0;
      const shares = content.shareCount || 0;
      const hoursOld = (Date.now() - content.createdAt.getTime()) / (1000 * 60 * 60);
      
      // Engagement score with time decay
      return (likes * 3 + comments * 2 + shares * 4) / Math.pow(hoursOld + 2, 1.5);
    } else {
      // For blogs, use a simpler scoring based on recency
      const hoursOld = (Date.now() - (content.publishedAt || content.createdAt).getTime()) / (1000 * 60 * 60);
      return 1 / Math.pow(hoursOld + 2, 0.5);
    }
  }

  private static generatePostTitle(content: string): string {
    const plainText = content.replace(/<[^>]*>/g, '').trim();
    const maxLength = 100;
    
    if (plainText.length <= maxLength) {
      return plainText;
    }

    const truncated = plainText.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    if (lastSpaceIndex > 0) {
      return truncated.substring(0, lastSpaceIndex) + '...';
    }
    
    return truncated + '...';
  }

  private static generateExcerpt(content: string, maxLength: number = 200): string {
    const plainText = content.replace(/<[^>]*>/g, '').trim();
    
    if (plainText.length <= maxLength) {
      return plainText;
    }

    const truncated = plainText.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    if (lastSpaceIndex > 0) {
      return truncated.substring(0, lastSpaceIndex) + '...';
    }
    
    return truncated + '...';
  }

  static async refreshTrendingContent(): Promise<void> {
    const client = await DatabaseConnection.getClient();
    
    try {
      await client.query('REFRESH MATERIALIZED VIEW trending_posts');
    } catch (error) {
      console.error('Error refreshing trending content:', error);
    } finally {
      client.release();
    }
  }
}