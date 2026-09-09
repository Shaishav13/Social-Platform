import { Blog, CreateBlogRequest, UpdateBlogRequest, BlogListOptions, BlogValidationResult } from './types';
import { BlogDatabase } from './database';

export class BlogModel {
  static async createBlog(authorId: string, blogData: CreateBlogRequest): Promise<Blog> {
    // Validate blog data
    const validation = this.validateBlogData(blogData);
    if (!validation.isValid) {
      throw new Error(`Blog validation failed: ${validation.errors.join(', ')}`);
    }

    return await BlogDatabase.createBlog(authorId, blogData);
  }

  static async getBlog(blogId: string, requesterId?: string): Promise<Blog | null> {
    const blog = await BlogDatabase.findBlogById(blogId);
    
    if (!blog) {
      return null;
    }

    // Check if user can access this blog
    // Drafts can only be accessed by the author
    if (blog.isDraft && blog.authorId !== requesterId) {
      return null;
    }

    return blog;
  }

  static async updateBlog(
    blogId: string, 
    authorId: string, 
    updates: UpdateBlogRequest
  ): Promise<Blog | null> {
    // Validate updates
    if (Object.keys(updates).length === 0) {
      throw new Error('No updates provided');
    }

    const validation = this.validateBlogUpdates(updates);
    if (!validation.isValid) {
      throw new Error(`Blog validation failed: ${validation.errors.join(', ')}`);
    }

    return await BlogDatabase.updateBlog(blogId, authorId, updates);
  }

  static async deleteBlog(blogId: string, authorId: string): Promise<boolean> {
    return await BlogDatabase.deleteBlog(blogId, authorId);
  }

  static async publishBlog(blogId: string, authorId: string): Promise<Blog | null> {
    return await BlogDatabase.updateBlog(blogId, authorId, { isDraft: false });
  }

  static async unpublishBlog(blogId: string, authorId: string): Promise<Blog | null> {
    return await BlogDatabase.updateBlog(blogId, authorId, { isDraft: true });
  }

  static async listBlogs(options: BlogListOptions): Promise<{ blogs: Blog[]; totalCount: number; hasMore: boolean }> {
    const result = await BlogDatabase.listBlogs(options);
    const hasMore = (options.page * options.limit) < result.totalCount;
    
    return {
      ...result,
      hasMore
    };
  }

  static async getUserBlogs(
    userId: string, 
    options: { page: number; limit: number; includeDrafts?: boolean }
  ): Promise<{ blogs: Blog[]; totalCount: number; hasMore: boolean }> {
    const listOptions: BlogListOptions = {
      ...options,
      authorId: userId,
      draftsOnly: false,
      publishedOnly: !options.includeDrafts
    };

    return this.listBlogs(listOptions);
  }

  static async searchBlogs(
    query: string,
    options: { page: number; limit: number; tags?: string[] }
  ): Promise<{ blogs: Blog[]; totalCount: number; hasMore: boolean }> {
    const listOptions: BlogListOptions = {
      ...options,
      search: query,
      publishedOnly: true // Only search published blogs
    };

    return this.listBlogs(listOptions);
  }

  static async getBlogsByTag(
    tag: string,
    options: { page: number; limit: number }
  ): Promise<{ blogs: Blog[]; totalCount: number; hasMore: boolean }> {
    const listOptions: BlogListOptions = {
      ...options,
      tags: [tag],
      publishedOnly: true
    };

    return this.listBlogs(listOptions);
  }

  static async getPopularTags(limit: number = 20): Promise<{ tag: string; count: number }[]> {
    return await BlogDatabase.getPopularTags(limit);
  }

  static validateBlogData(blogData: CreateBlogRequest): BlogValidationResult {
    const errors: string[] = [];

    // Validate title
    if (!blogData.title || blogData.title.trim().length === 0) {
      errors.push('Blog title is required');
    } else if (blogData.title.length > 500) {
      errors.push('Blog title cannot exceed 500 characters');
    }

    // Validate content
    if (!blogData.content || blogData.content.trim().length === 0) {
      errors.push('Blog content is required');
    } else if (blogData.content.length > 100000) {
      errors.push('Blog content cannot exceed 100,000 characters');
    }

    // Validate excerpt if provided
    if (blogData.excerpt && blogData.excerpt.length > 1000) {
      errors.push('Blog excerpt cannot exceed 1,000 characters');
    }

    // Validate tags
    if (blogData.tags) {
      if (blogData.tags.length > 10) {
        errors.push('Cannot have more than 10 tags');
      }

      for (const tag of blogData.tags) {
        if (tag.length > 50) {
          errors.push('Tag cannot exceed 50 characters');
        }
        if (!/^[a-zA-Z0-9\-_\s]+$/.test(tag)) {
          errors.push('Tags can only contain letters, numbers, hyphens, underscores, and spaces');
        }
      }
    }

    // Check for potentially harmful content (basic validation)
    const suspiciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(blogData.content)) {
        errors.push('Blog content contains potentially harmful code');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateBlogUpdates(updates: UpdateBlogRequest): BlogValidationResult {
    const errors: string[] = [];

    // Validate title if provided
    if (updates.title !== undefined) {
      if (!updates.title || updates.title.trim().length === 0) {
        errors.push('Blog title cannot be empty');
      } else if (updates.title.length > 500) {
        errors.push('Blog title cannot exceed 500 characters');
      }
    }

    // Validate content if provided
    if (updates.content !== undefined) {
      if (!updates.content || updates.content.trim().length === 0) {
        errors.push('Blog content cannot be empty');
      } else if (updates.content.length > 100000) {
        errors.push('Blog content cannot exceed 100,000 characters');
      }

      // Check for potentially harmful content
      const suspiciousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(updates.content)) {
          errors.push('Blog content contains potentially harmful code');
          break;
        }
      }
    }

    // Validate excerpt if provided
    if (updates.excerpt !== undefined && updates.excerpt.length > 1000) {
      errors.push('Blog excerpt cannot exceed 1,000 characters');
    }

    // Validate tags if provided
    if (updates.tags !== undefined) {
      if (updates.tags.length > 10) {
        errors.push('Cannot have more than 10 tags');
      }

      for (const tag of updates.tags) {
        if (tag.length > 50) {
          errors.push('Tag cannot exceed 50 characters');
        }
        if (!/^[a-zA-Z0-9\-_\s]+$/.test(tag)) {
          errors.push('Tags can only contain letters, numbers, hyphens, underscores, and spaces');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static sanitizeHtml(html: string): string {
    // Basic HTML sanitization - in production, use a proper library like DOMPurify
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  static generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim();
  }

  static extractPlainText(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  static countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  static estimateReadingTime(content: string): number {
    const plainText = this.extractPlainText(content);
    const wordCount = this.countWords(plainText);
    const wordsPerMinute = 200; // Average reading speed
    return Math.ceil(wordCount / wordsPerMinute);
  }
}