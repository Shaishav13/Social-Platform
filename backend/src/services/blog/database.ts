import { DatabaseConnection } from '../../config/database';
import { Blog, CreateBlogRequest, UpdateBlogRequest, BlogListOptions } from './types';
import { v4 as uuidv4 } from 'uuid';

export class BlogDatabase {
  static async initializeTables(): Promise<void> {
    const client = await DatabaseConnection.getClient();
    
    try {
      // Create blogs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS blogs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(500) NOT NULL,
          content TEXT NOT NULL,
          excerpt TEXT,
          tags TEXT[] DEFAULT '{}',
          is_draft BOOLEAN NOT NULL DEFAULT true,
          published_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create indexes for better performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_blogs_author_id ON blogs(author_id);
        CREATE INDEX IF NOT EXISTS idx_blogs_published_at ON blogs(published_at DESC);
        CREATE INDEX IF NOT EXISTS idx_blogs_is_draft ON blogs(is_draft);
        CREATE INDEX IF NOT EXISTS idx_blogs_tags ON blogs USING GIN(tags);
        CREATE INDEX IF NOT EXISTS idx_blogs_title_search ON blogs USING GIN(to_tsvector('english', title));
        CREATE INDEX IF NOT EXISTS idx_blogs_content_search ON blogs USING GIN(to_tsvector('english', content));
      `);

      // Create trigger to update updated_at timestamp
      await client.query(`
        CREATE OR REPLACE FUNCTION update_blogs_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql';

        DROP TRIGGER IF EXISTS update_blogs_updated_at ON blogs;
        CREATE TRIGGER update_blogs_updated_at
          BEFORE UPDATE ON blogs
          FOR EACH ROW
          EXECUTE FUNCTION update_blogs_updated_at();
      `);

      // Create trigger to set published_at when is_draft changes to false
      await client.query(`
        CREATE OR REPLACE FUNCTION set_blog_published_at()
        RETURNS TRIGGER AS $$
        BEGIN
          IF OLD.is_draft = true AND NEW.is_draft = false AND NEW.published_at IS NULL THEN
            NEW.published_at = CURRENT_TIMESTAMP;
          END IF;
          RETURN NEW;
        END;
        $$ language 'plpgsql';

        DROP TRIGGER IF EXISTS set_blog_published_at ON blogs;
        CREATE TRIGGER set_blog_published_at
          BEFORE UPDATE ON blogs
          FOR EACH ROW
          EXECUTE FUNCTION set_blog_published_at();
      `);

    } finally {
      client.release();
    }
  }

  static async createBlog(authorId: string, blogData: CreateBlogRequest): Promise<Blog> {
    const blogId = uuidv4();
    const isDraft = blogData.isDraft ?? true;
    const publishedAt = isDraft ? null : new Date();
    
    const result = await DatabaseConnection.query(
      `INSERT INTO blogs (id, author_id, title, content, excerpt, tags, is_draft, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        blogId,
        authorId,
        blogData.title,
        blogData.content,
        blogData.excerpt || this.generateExcerpt(blogData.content),
        blogData.tags || [],
        isDraft,
        publishedAt
      ]
    );

    const rows = (result as any).rows;
    return this.mapRowToBlog(rows[0]);
  }

  static async findBlogById(blogId: string): Promise<Blog | null> {
    const result = await DatabaseConnection.query(
      `SELECT * FROM blogs WHERE id = $1`,
      [blogId]
    );

    const rows = (result as any).rows;
    return rows && rows.length > 0 ? this.mapRowToBlog(rows[0]) : null;
  }

  static async updateBlog(blogId: string, authorId: string, updates: UpdateBlogRequest): Promise<Blog | null> {
    const setParts: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.title !== undefined) {
      setParts.push(`title = $${paramCount++}`);
      values.push(updates.title);
    }

    if (updates.content !== undefined) {
      setParts.push(`content = $${paramCount++}`);
      values.push(updates.content);
      
      // Auto-update excerpt if content changes and no explicit excerpt provided
      if (updates.excerpt === undefined) {
        setParts.push(`excerpt = $${paramCount++}`);
        values.push(this.generateExcerpt(updates.content));
      }
    }

    if (updates.excerpt !== undefined) {
      setParts.push(`excerpt = $${paramCount++}`);
      values.push(updates.excerpt);
    }

    if (updates.tags !== undefined) {
      setParts.push(`tags = $${paramCount++}`);
      values.push(updates.tags);
    }

    if (updates.isDraft !== undefined) {
      setParts.push(`is_draft = $${paramCount++}`);
      values.push(updates.isDraft);
      
      // If publishing (isDraft becomes false), set published_at if not already set
      if (!updates.isDraft) {
        setParts.push(`published_at = COALESCE(published_at, CURRENT_TIMESTAMP)`);
      }
    }

    if (setParts.length === 0) {
      return this.findBlogById(blogId);
    }

    values.push(blogId, authorId);

    const result = await DatabaseConnection.query(
      `UPDATE blogs SET ${setParts.join(', ')} 
       WHERE id = $${paramCount++} AND author_id = $${paramCount++}
       RETURNING *`,
      values
    );

    const rows = (result as any).rows;
    return rows && rows.length > 0 ? this.mapRowToBlog(rows[0]) : null;
  }

  static async deleteBlog(blogId: string, authorId: string): Promise<boolean> {
    const result = await DatabaseConnection.query(
      `DELETE FROM blogs WHERE id = $1 AND author_id = $2`,
      [blogId, authorId]
    );

    return (result as any).rowCount > 0;
  }

  static async listBlogs(options: BlogListOptions): Promise<{ blogs: Blog[]; totalCount: number }> {
    const client = await DatabaseConnection.getClient();
    
    try {
      let whereConditions: string[] = [];
      let params: any[] = [];
      let paramCount = 1;

      // Filter by author
      if (options.authorId) {
        whereConditions.push(`author_id = $${paramCount++}`);
        params.push(options.authorId);
      }

      // Filter by draft status
      if (options.draftsOnly) {
        whereConditions.push(`is_draft = true`);
      } else if (options.publishedOnly) {
        whereConditions.push(`is_draft = false`);
      }

      // Filter by tags
      if (options.tags && options.tags.length > 0) {
        whereConditions.push(`tags && $${paramCount++}`);
        params.push(options.tags);
      }

      // Search in title and content
      if (options.search) {
        whereConditions.push(`(
          to_tsvector('english', title) @@ plainto_tsquery('english', $${paramCount++}) OR
          to_tsvector('english', content) @@ plainto_tsquery('english', $${paramCount})
        )`);
        params.push(options.search);
        paramCount++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM blogs ${whereClause}`,
        params
      );
      const totalCount = parseInt(countResult.rows[0].total);

      // Get paginated results
      const offset = (options.page - 1) * options.limit;
      const orderBy = options.publishedOnly ? 'published_at DESC' : 'created_at DESC';
      
      const blogsResult = await client.query(
        `SELECT * FROM blogs ${whereClause} 
         ORDER BY ${orderBy}
         LIMIT $${paramCount++} OFFSET $${paramCount++}`,
        [...params, options.limit, offset]
      );

      const blogs = blogsResult.rows.map(row => this.mapRowToBlog(row));

      return { blogs, totalCount };

    } finally {
      client.release();
    }
  }

  static async getUserBlogCount(userId: string, publishedOnly: boolean = false): Promise<number> {
    let query = 'SELECT COUNT(*) as count FROM blogs WHERE author_id = $1';
    const params = [userId];

    if (publishedOnly) {
      query += ' AND is_draft = false';
    }

    const result = await DatabaseConnection.query(query, params);
    const rows = (result as any).rows;
    return rows && rows.length > 0 ? parseInt(rows[0].count) : 0;
  }

  static async getBlogsByTag(tag: string, limit: number = 10): Promise<Blog[]> {
    const result = await DatabaseConnection.query(
      `SELECT * FROM blogs 
       WHERE $1 = ANY(tags) AND is_draft = false
       ORDER BY published_at DESC
       LIMIT $2`,
      [tag, limit]
    );

    const rows = (result as any).rows;
    return rows ? rows.map((row: any) => this.mapRowToBlog(row)) : [];
  }

  static async getPopularTags(limit: number = 20): Promise<{ tag: string; count: number }[]> {
    const result = await DatabaseConnection.query(
      `SELECT unnest(tags) as tag, COUNT(*) as count
       FROM blogs 
       WHERE is_draft = false
       GROUP BY tag
       ORDER BY count DESC
       LIMIT $1`,
      [limit]
    );

    const rows = (result as any).rows;
    return rows ? rows.map((row: any) => ({ tag: row.tag, count: parseInt(row.count) })) : [];
  }

  private static mapRowToBlog(row: any): Blog {
    return {
      id: row.id,
      authorId: row.author_id,
      title: row.title,
      content: row.content,
      excerpt: row.excerpt,
      tags: row.tags || [],
      isDraft: row.is_draft,
      publishedAt: row.published_at ? new Date(row.published_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private static generateExcerpt(content: string, maxLength: number = 200): string {
    // Strip HTML tags and get plain text
    const plainText = content.replace(/<[^>]*>/g, '').trim();
    
    if (plainText.length <= maxLength) {
      return plainText;
    }

    // Find the last complete word within the limit
    const truncated = plainText.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    if (lastSpaceIndex > 0) {
      return truncated.substring(0, lastSpaceIndex) + '...';
    }
    
    return truncated + '...';
  }

  // Data export methods
  static async getUserBlogs(userId: string): Promise<Blog[]> {
    const result = await DatabaseConnection.query(
      `SELECT * FROM blogs 
       WHERE author_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    const rows = (result as any).rows;
    return rows ? rows.map((row: any) => this.mapRowToBlog(row)) : [];
  }

  // Data deletion methods
  static async deleteUserBlogs(userId: string): Promise<void> {
    await DatabaseConnection.query(
      'DELETE FROM blogs WHERE author_id = $1',
      [userId]
    );
  }
}