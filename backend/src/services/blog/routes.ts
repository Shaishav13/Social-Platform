import express, { Request, Response } from 'express';
import { BlogModel } from './models';
import { authenticateToken } from '../auth/middleware';
import { PostModel } from '../content/models';
import { NotificationEventHandlers } from '../notification/eventHandlers';

const router = express.Router();

// POST /blog/posts - Create a new blog post
router.post('/posts', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { title, content, excerpt, tags, isDraft } = req.body;

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
      return;
    }

    // Validate required fields
    if (!title || typeof title !== 'string') {
      res.status(400).json({
        error: 'Invalid input',
        message: 'Blog title is required and must be a string'
      });
      return;
    }

    if (!content || typeof content !== 'string') {
      res.status(400).json({
        error: 'Invalid input',
        message: 'Blog content is required and must be a string'
      });
      return;
    }

    // Validate tags if provided
    if (tags && !Array.isArray(tags)) {
      res.status(400).json({
        error: 'Invalid input',
        message: 'Tags must be an array'
      });
      return;
    }

    // Create the blog
    const blog = await BlogModel.createBlog(userId!, {
      title,
      content,
      excerpt,
      tags: tags || [],
      isDraft: isDraft !== false // Default to true (draft) if not specified
    });

    // Handle mentions in blog content (only if published)
    if (!blog.isDraft) {
      try {
        await NotificationEventHandlers.handleMentionEvent(content, userId!, blog.id, 'post');
      } catch (notificationError) {
        console.log('Notification error (non-critical):', notificationError);
      }
    }

    res.status(201).json({
      message: 'Blog created successfully',
      blog: {
        id: blog.id,
        title: blog.title,
        content: blog.content,
        excerpt: blog.excerpt,
        tags: blog.tags,
        isDraft: blog.isDraft,
        publishedAt: blog.publishedAt,
        createdAt: blog.createdAt,
        updatedAt: blog.updatedAt
      }
    });

  } catch (error) {
    console.error('Create blog error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('validation failed') || 
          error.message.includes('is required') ||
          error.message.includes('cannot exceed')) {
        res.status(400).json({
          error: 'Validation error',
          message: error.message
        });
        return;
      }
    }

    res.status(500).json({
      error: 'Failed to create blog',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// GET /blog/posts/:id - Get a specific blog post
router.get('/posts/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
      return;
    }

    const blog = await BlogModel.getBlog(id, userId);

    if (!blog) {
      res.status(404).json({
        error: 'Blog not found',
        message: 'The requested blog post does not exist or is not accessible'
      });
      return;
    }

    res.json({
      blog: {
        id: blog.id,
        authorId: blog.authorId,
        title: blog.title,
        content: blog.content,
        excerpt: blog.excerpt,
        tags: blog.tags,
        isDraft: blog.isDraft,
        publishedAt: blog.publishedAt,
        createdAt: blog.createdAt,
        updatedAt: blog.updatedAt
      }
    });

  } catch (error) {
    console.error('Get blog error:', error);
    res.status(500).json({
      error: 'Failed to retrieve blog',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// PUT /blog/posts/:id - Update a blog post
router.put('/posts/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    const { title, content, excerpt, tags, isDraft } = req.body;

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
      return;
    }

    // Validate input types if provided
    if (title !== undefined && typeof title !== 'string') {
      res.status(400).json({
        error: 'Invalid input',
        message: 'Blog title must be a string'
      });
      return;
    }

    if (content !== undefined && typeof content !== 'string') {
      res.status(400).json({
        error: 'Invalid input',
        message: 'Blog content must be a string'
      });
      return;
    }

    if (excerpt !== undefined && typeof excerpt !== 'string') {
      res.status(400).json({
        error: 'Invalid input',
        message: 'Blog excerpt must be a string'
      });
      return;
    }

    if (tags !== undefined && !Array.isArray(tags)) {
      res.status(400).json({
        error: 'Invalid input',
        message: 'Tags must be an array'
      });
      return;
    }

    // Update the blog
    const updatedBlog = await BlogModel.updateBlog(id, userId, {
      title,
      content,
      excerpt,
      tags,
      isDraft
    });

    if (!updatedBlog) {
      res.status(404).json({
        error: 'Blog not found or unauthorized',
        message: 'The blog post does not exist or you do not have permission to update it'
      });
      return;
    }

    // Handle mentions in updated content (only if published)
    if (content !== undefined && !updatedBlog.isDraft) {
      try {
        await NotificationEventHandlers.handleMentionEvent(content, userId, id, 'post');
      } catch (notificationError) {
        console.log('Notification error (non-critical):', notificationError);
      }
    }

    res.json({
      message: 'Blog updated successfully',
      blog: {
        id: updatedBlog.id,
        title: updatedBlog.title,
        content: updatedBlog.content,
        excerpt: updatedBlog.excerpt,
        tags: updatedBlog.tags,
        isDraft: updatedBlog.isDraft,
        publishedAt: updatedBlog.publishedAt,
        createdAt: updatedBlog.createdAt,
        updatedAt: updatedBlog.updatedAt
      }
    });

  } catch (error) {
    console.error('Update blog error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('validation failed') || 
          error.message.includes('cannot be empty') ||
          error.message.includes('cannot exceed') ||
          error.message.includes('No updates provided')) {
        res.status(400).json({
          error: 'Validation error',
          message: error.message
        });
        return;
      }
    }

    res.status(500).json({
      error: 'Failed to update blog',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// DELETE /blog/posts/:id - Delete a blog post
router.delete('/posts/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
      return;
    }

    const deleted = await BlogModel.deleteBlog(id, userId);

    if (!deleted) {
      res.status(404).json({
        error: 'Blog not found or unauthorized',
        message: 'The blog post does not exist or you do not have permission to delete it'
      });
      return;
    }

    res.json({
      message: 'Blog deleted successfully'
    });

  } catch (error) {
    console.error('Delete blog error:', error);
    res.status(500).json({
      error: 'Failed to delete blog',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// POST /blog/posts/:id/publish - Publish a draft blog post
router.post('/posts/:id/publish', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
      return;
    }

    const publishedBlog = await BlogModel.publishBlog(id, userId);

    if (!publishedBlog) {
      res.status(404).json({
        error: 'Blog not found or unauthorized',
        message: 'The blog post does not exist or you do not have permission to publish it'
      });
      return;
    }

    // Handle mentions when blog is published
    try {
      await NotificationEventHandlers.handleMentionEvent(publishedBlog.content, userId, id, 'post');
    } catch (notificationError) {
      console.log('Notification error (non-critical):', notificationError);
    }

    res.json({
      message: 'Blog published successfully',
      blog: {
        id: publishedBlog.id,
        title: publishedBlog.title,
        content: publishedBlog.content,
        excerpt: publishedBlog.excerpt,
        tags: publishedBlog.tags,
        isDraft: publishedBlog.isDraft,
        publishedAt: publishedBlog.publishedAt,
        createdAt: publishedBlog.createdAt,
        updatedAt: publishedBlog.updatedAt
      }
    });

  } catch (error) {
    console.error('Publish blog error:', error);
    res.status(500).json({
      error: 'Failed to publish blog',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// POST /blog/posts/:id/unpublish - Unpublish a blog post (make it draft)
router.post('/posts/:id/unpublish', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
      return;
    }

    const unpublishedBlog = await BlogModel.unpublishBlog(id, userId);

    if (!unpublishedBlog) {
      res.status(404).json({
        error: 'Blog not found or unauthorized',
        message: 'The blog post does not exist or you do not have permission to unpublish it'
      });
      return;
    }

    res.json({
      message: 'Blog unpublished successfully',
      blog: {
        id: unpublishedBlog.id,
        title: unpublishedBlog.title,
        content: unpublishedBlog.content,
        excerpt: unpublishedBlog.excerpt,
        tags: unpublishedBlog.tags,
        isDraft: unpublishedBlog.isDraft,
        publishedAt: unpublishedBlog.publishedAt,
        createdAt: unpublishedBlog.createdAt,
        updatedAt: unpublishedBlog.updatedAt
      }
    });

  } catch (error) {
    console.error('Unpublish blog error:', error);
    res.status(500).json({
      error: 'Failed to unpublish blog',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// GET /blog/posts - List blog posts with filtering and pagination
router.get('/posts', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50); // Max 50 posts per page
    const authorId = req.query.authorId as string;
    const search = req.query.search as string;
    const tagsParam = req.query.tags as string;
    const draftsOnly = req.query.draftsOnly === 'true';
    const publishedOnly = req.query.publishedOnly !== 'false'; // Default to true

    if (page < 1) {
      res.status(400).json({
        error: 'Invalid pagination',
        message: 'Page number must be greater than 0'
      });
      return;
    }

    if (limit < 1) {
      res.status(400).json({
        error: 'Invalid pagination',
        message: 'Limit must be greater than 0'
      });
      return;
    }

    // Parse tags from comma-separated string
    const tags = tagsParam ? tagsParam.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : undefined;

    // If requesting drafts, user must be authenticated and can only see their own drafts
    if (draftsOnly && (!userId || (authorId && authorId !== userId))) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You can only view your own draft posts'
      });
      return;
    }

    const result = await BlogModel.listBlogs({
      page,
      limit,
      authorId: draftsOnly ? userId : authorId, // Force authorId to current user for drafts
      search,
      ...(tags && { tags }),
      draftsOnly,
      publishedOnly: draftsOnly ? false : publishedOnly
    });

    res.json({
      blogs: result.blogs.map(blog => ({
        id: blog.id,
        authorId: blog.authorId,
        title: blog.title,
        excerpt: blog.excerpt,
        tags: blog.tags,
        isDraft: blog.isDraft,
        publishedAt: blog.publishedAt,
        createdAt: blog.createdAt,
        updatedAt: blog.updatedAt
        // Note: Full content is not included in list view for performance
      })),
      pagination: {
        page,
        limit,
        totalCount: result.totalCount,
        hasMore: result.hasMore
      }
    });

  } catch (error) {
    console.error('List blogs error:', error);
    res.status(500).json({
      error: 'Failed to retrieve blogs',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// GET /blog/tags - Get popular tags
router.get('/tags', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100 tags

    const tags = await BlogModel.getPopularTags(limit);

    res.json({
      tags
    });

  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({
      error: 'Failed to retrieve tags',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// GET /blog/posts/by-tag/:tag - Get blog posts by tag
router.get('/posts/by-tag/:tag', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tag } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    if (page < 1) {
      res.status(400).json({
        error: 'Invalid pagination',
        message: 'Page number must be greater than 0'
      });
      return;
    }

    if (limit < 1) {
      res.status(400).json({
        error: 'Invalid pagination',
        message: 'Limit must be greater than 0'
      });
      return;
    }

    const result = await BlogModel.getBlogsByTag(tag, { page, limit });

    res.json({
      tag,
      blogs: result.blogs.map(blog => ({
        id: blog.id,
        authorId: blog.authorId,
        title: blog.title,
        excerpt: blog.excerpt,
        tags: blog.tags,
        isDraft: blog.isDraft,
        publishedAt: blog.publishedAt,
        createdAt: blog.createdAt,
        updatedAt: blog.updatedAt
      })),
      pagination: {
        page,
        limit,
        totalCount: result.totalCount,
        hasMore: result.hasMore
      }
    });

  } catch (error) {
    console.error('Get blogs by tag error:', error);
    res.status(500).json({
      error: 'Failed to retrieve blogs by tag',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// GET /blog/search - Search across blogs and optionally posts
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const contentType = req.query.type as string; // 'blogs', 'posts', or 'all'
    const tagsParam = req.query.tags as string;

    if (!query || query.trim().length === 0) {
      res.status(400).json({
        error: 'Invalid search query',
        message: 'Search query is required'
      });
      return;
    }

    if (page < 1) {
      res.status(400).json({
        error: 'Invalid pagination',
        message: 'Page number must be greater than 0'
      });
      return;
    }

    if (limit < 1) {
      res.status(400).json({
        error: 'Invalid pagination',
        message: 'Limit must be greater than 0'
      });
      return;
    }

    // Parse tags from comma-separated string
    const tags = tagsParam ? tagsParam.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) : undefined;

    const results: any[] = [];
    let totalCount = 0;

    // Calculate how many items to fetch from each source
    const itemsPerSource = contentType === 'all' ? Math.ceil(limit / 2) : limit;

    if (contentType !== 'posts') {
      // Search blogs
      const blogResult = await BlogModel.searchBlogs(query, {
        page,
        limit: itemsPerSource,
        ...(tags && { tags })
      });

      const blogs = blogResult.blogs.map(blog => ({
        type: 'blog',
        id: blog.id,
        authorId: blog.authorId,
        title: blog.title,
        excerpt: blog.excerpt,
        tags: blog.tags,
        isDraft: blog.isDraft,
        publishedAt: blog.publishedAt,
        createdAt: blog.createdAt,
        updatedAt: blog.updatedAt,
        relevanceScore: calculateRelevanceScore(query, blog.title, blog.content)
      }));

      results.push(...blogs);
      totalCount += blogResult.totalCount;
    }

    if (contentType !== 'blogs') {
      // Search posts (basic implementation - in a real app, you'd want full-text search)
      // For now, we'll just get recent posts and filter by content
      const postResult = await PostModel.getFeed({
        page,
        limit: itemsPerSource * 2 // Get more to filter
      });

      const matchingPosts = postResult.posts
        .filter(post => 
          post.content.toLowerCase().includes(query.toLowerCase()) ||
          (post.media && post.media.some(m => 
            m.originalName.toLowerCase().includes(query.toLowerCase())
          ))
        )
        .slice(0, itemsPerSource)
        .map(post => ({
          type: 'post',
          id: post.id,
          authorId: post.authorId,
          title: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
          content: post.content,
          excerpt: post.content.substring(0, 200) + (post.content.length > 200 ? '...' : ''),
          mediaType: post.mediaType,
          mediaUrls: post.mediaUrls,
          media: post.media,
          likeCount: post.likeCount,
          commentCount: post.commentCount,
          shareCount: post.shareCount,
          isPublic: post.isPublic,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
          relevanceScore: calculateRelevanceScore(query, post.content, post.content)
        }));

      results.push(...matchingPosts);
      totalCount += matchingPosts.length;
    }

    // Sort by relevance score (highest first), then by date
    results.sort((a, b) => {
      if (a.relevanceScore !== b.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      const dateA = new Date(a.publishedAt || a.createdAt);
      const dateB = new Date(b.publishedAt || b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });

    // Limit to requested number of items
    const limitedResults = results.slice(0, limit);
    const hasMore = results.length > limit;

    res.json({
      query,
      results: limitedResults,
      pagination: {
        page,
        limit,
        totalCount: limitedResults.length,
        hasMore
      },
      contentType: contentType || 'all'
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Failed to perform search',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// Helper method to calculate relevance score
function calculateRelevanceScore(query: string, title: string, content: string): number {
  const queryLower = query.toLowerCase();
  const titleLower = title.toLowerCase();
  const contentLower = content.toLowerCase();
  
  let score = 0;
  
  // Title matches are worth more
  if (titleLower.includes(queryLower)) {
    score += 10;
  }
  
  // Count occurrences in content
  const contentMatches = (contentLower.match(new RegExp(queryLower, 'g')) || []).length;
  score += contentMatches * 2;
  
  // Exact word matches are worth more
  const words = queryLower.split(' ');
  words.forEach(word => {
    if (titleLower.includes(word)) score += 5;
    if (contentLower.includes(word)) score += 1;
  });
  
  return score;
}

export default router;