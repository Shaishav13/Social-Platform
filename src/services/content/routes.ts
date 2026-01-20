import express, { Request, Response } from 'express';
import multer from 'multer';
import { MediaModel, PostModel } from './models';
import { FileStorageService } from './storage';
import { authenticateToken, optionalAuth } from '../auth/middleware';
import { BlogModel } from '../blog/models';
import { NotificationEventHandlers } from '../notification/eventHandlers';

const router = express.Router();

// Search posts endpoint
router.get('/search/posts', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query.q as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    if (!query || query.trim().length === 0) {
      res.status(400).json({
        error: 'Invalid search query',
        message: 'Search query (q) parameter is required'
      });
      return;
    }

    if (query.length > 200) {
      res.status(400).json({
        error: 'Invalid search query',
        message: 'Search query cannot exceed 200 characters'
      });
      return;
    }

    const results = await PostModel.searchPosts(query.trim(), page, limit);
    
    res.json({
      query,
      results: results.posts,
      pagination: {
        page,
        limit,
        totalCount: results.totalCount,
        hasMore: (page * limit) < results.totalCount
      }
    });

  } catch (error) {
    console.error('Post search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(), // Store files in memory for processing
  limits: {
    fileSize: MediaModel.getMaxFileSize(), // 50MB limit
    files: 5 // Maximum 5 files per request
  },
  fileFilter: (req, file, cb) => {
    // Validate file type
    if (FileStorageService.validateFileType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  }
});

// POST /content/posts - Create a new post
router.post('/posts', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { content, mediaIds, isPublic } = req.body;

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
      return;
    }

    // Validate required fields
    if (content === undefined || content === null || typeof content !== 'string') {
      res.status(400).json({
        error: 'Invalid input',
        message: 'Post content is required and must be a string'
      });
      return;
    }

    // Allow empty content only if there are media files
    if (content.trim().length === 0 && (!mediaIds || mediaIds.length === 0)) {
      res.status(400).json({
        error: 'Invalid input',
        message: 'Post must have either content or media files'
      });
      return;
    }

    // Validate content using PostModel (skip if empty content but has media)
    if (content.trim().length > 0) {
      const contentValidation = PostModel.validatePostContent(content);
      if (!contentValidation.isValid) {
        res.status(400).json({
          error: 'Invalid content',
          message: 'Post content validation failed',
          details: contentValidation.errors
        });
        return;
      }
    }

    // Validate mediaIds if provided
    if (mediaIds && !Array.isArray(mediaIds)) {
      res.status(400).json({
        error: 'Invalid input',
        message: 'mediaIds must be an array'
      });
      return;
    }

    // Create the post
    const post = await PostModel.createPost(userId!, {
      content,
      mediaIds: mediaIds || [],
      isPublic: isPublic !== false // Default to true if not specified
    });

    // Handle mentions in post content
    try {
      await NotificationEventHandlers.handleMentionEvent(content, userId!, post.id, 'post');
    } catch (notificationError) {
      console.log('Notification error (non-critical):', notificationError);
    }

    res.status(201).json({
      message: 'Post created successfully',
      post: {
        id: post.id,
        content: post.content,
        mediaType: post.mediaType,
        mediaUrls: post.mediaUrls,
        media: post.media,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        shareCount: post.shareCount,
        isPublic: post.isPublic,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt
      }
    });

  } catch (error) {
    console.error('Create post error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Media file not found') || 
          error.message.includes('Unauthorized access to media file')) {
        res.status(400).json({
          error: 'Invalid media',
          message: error.message
        });
        return;
      }
      
      if (error.message.includes('validation failed') || 
          error.message.includes('cannot be empty') ||
          error.message.includes('cannot exceed')) {
        res.status(400).json({
          error: 'Validation error',
          message: error.message
        });
        return;
      }
    }

    res.status(500).json({
      error: 'Failed to create post',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// GET /content/posts - Get posts (with optional filtering)
router.get('/posts', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { authorId, limit = '20', offset = '0' } = req.query;
    const viewerId = (req as any).user?.userId;

    if (!authorId) {
      res.status(400).json({
        error: 'Missing parameter',
        message: 'authorId parameter is required'
      });
      return;
    }

    // Check if viewer is the author (to include private posts)
    const includePrivate = viewerId === authorId;

    const posts = await PostModel.getPostsByAuthor(
      authorId as string,
      {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        viewerId,
        includePrivate
      }
    );

    res.json({
      posts: posts.map(post => ({
        id: post.id,
        authorId: post.authorId,
        author: post.author,
        content: post.content,
        mediaType: post.mediaType,
        mediaUrls: post.mediaUrls,
        media: post.media,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        shareCount: post.shareCount,
        isPublic: post.isPublic,
        isLiked: post.isLiked,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt
      })),
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: posts.length === parseInt(limit as string)
      }
    });

  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({
      error: 'Failed to retrieve posts',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// GET /content/posts/:id - Get a specific post
router.get('/posts/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    const post = await PostModel.getPost(id, userId || undefined);

    if (!post) {
      res.status(404).json({
        error: 'Post not found',
        message: 'The requested post does not exist or is not accessible'
      });
      return;
    }

    res.json({
      post: {
        id: post.id,
        authorId: post.authorId,
        content: post.content,
        mediaType: post.mediaType,
        mediaUrls: post.mediaUrls,
        media: post.media,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        shareCount: post.shareCount,
        isPublic: post.isPublic,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt
      }
    });

  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({
      error: 'Failed to retrieve post',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// PUT /content/posts/:id - Update a post
router.put('/posts/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    const { content, isPublic } = req.body;

    if (!userId) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
      return;
    }

    // Validate content if provided
    if (content !== undefined) {
      if (typeof content !== 'string') {
        res.status(400).json({
          error: 'Invalid input',
          message: 'Post content must be a string'
        });
        return;
      }

      const contentValidation = PostModel.validatePostContent(content);
      if (!contentValidation.isValid) {
        res.status(400).json({
          error: 'Invalid content',
          message: 'Post content validation failed',
          details: contentValidation.errors
        });
        return;
      }
    }

    // Update the post
    const updatedPost = await PostModel.updatePost(id, userId!, {
      content,
      isPublic
    });

    if (!updatedPost) {
      res.status(404).json({
        error: 'Post not found or unauthorized',
        message: 'The post does not exist or you do not have permission to update it'
      });
      return;
    }

    // Handle mentions in updated content
    if (content !== undefined) {
      try {
        await NotificationEventHandlers.handleMentionEvent(content, userId!, id, 'post');
      } catch (notificationError) {
        console.log('Notification error (non-critical):', notificationError);
      }
    }

    res.json({
      message: 'Post updated successfully',
      post: {
        id: updatedPost.id,
        content: updatedPost.content,
        mediaType: updatedPost.mediaType,
        mediaUrls: updatedPost.mediaUrls,
        media: updatedPost.media,
        likeCount: updatedPost.likeCount,
        commentCount: updatedPost.commentCount,
        shareCount: updatedPost.shareCount,
        isPublic: updatedPost.isPublic,
        createdAt: updatedPost.createdAt,
        updatedAt: updatedPost.updatedAt
      }
    });

  } catch (error) {
    console.error('Update post error:', error);
    
    if (error instanceof Error && 
        (error.message.includes('validation failed') || 
         error.message.includes('cannot be empty') ||
         error.message.includes('cannot exceed'))) {
      res.status(400).json({
        error: 'Validation error',
        message: error.message
      });
      return;
    }

    res.status(500).json({
      error: 'Failed to update post',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// DELETE /content/posts/:id - Delete a post
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

    const deleted = await PostModel.deletePost(id, userId!);

    if (!deleted) {
      res.status(404).json({
        error: 'Post not found or unauthorized',
        message: 'The post does not exist or you do not have permission to delete it'
      });
      return;
    }

    res.json({
      message: 'Post deleted successfully'
    });

  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({
      error: 'Failed to delete post',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// POST /content/upload - Upload media files
router.post('/upload', authenticateToken, upload.array('files', 5), async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    const userId = (req as any).user.userId;

    if (!files || files.length === 0) {
      res.status(400).json({
        error: 'No files provided',
        message: 'Please select at least one file to upload'
      });
      return;
    }

    const uploadResults = [];
    const errors = [];

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (!file) continue;
      
      try {
        // Validate file
        const validation = MediaModel.validateFileUpload({
          mimetype: file.mimetype,
          size: file.size,
          originalname: file.originalname
        });

        if (!validation.isValid) {
          errors.push({
            file: file.originalname,
            errors: validation.errors
          });
          continue;
        }

        // Upload file
        const result = await MediaModel.uploadFile({
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size
        }, userId);

        uploadResults.push(result);

      } catch (error) {
        errors.push({
          file: file.originalname,
          errors: [error instanceof Error ? error.message : 'Upload failed']
        });
      }
    }

    // Return results
    if (uploadResults.length === 0) {
      res.status(400).json({
        error: 'All uploads failed',
        details: errors
      });
      return;
    }

    const response: any = {
      message: `Successfully uploaded ${uploadResults.length} file(s)`,
      uploads: uploadResults
    };

    if (errors.length > 0) {
      response.warnings = {
        message: `${errors.length} file(s) failed to upload`,
        details: errors
      };
    }

    res.status(201).json(response);

  } catch (error) {
    console.error('Upload error:', error);
    
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({
          error: 'File too large',
          message: `File size exceeds the maximum limit of ${MediaModel.getMaxFileSize() / (1024 * 1024)}MB`
        });
        return;
      }
      if (error.code === 'LIMIT_FILE_COUNT') {
        res.status(400).json({
          error: 'Too many files',
          message: 'Maximum 5 files allowed per upload'
        });
        return;
      }
    }

    res.status(500).json({
      error: 'Upload failed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// GET /content/upload/info - Get upload configuration info
router.get('/upload/info', (req: Request, res: Response): void => {
  res.json({
    maxFileSize: MediaModel.getMaxFileSize(),
    maxFileSizeMB: MediaModel.getMaxFileSize() / (1024 * 1024),
    maxFiles: 5,
    supportedTypes: MediaModel.getSupportedFileTypes(),
    supportedExtensions: [
      '.jpg', '.jpeg', '.png', '.gif', '.webp',
      '.mp4', '.mov', '.avi', '.webm'
    ]
  });
});

// GET /content/media/:id - Get media file info (public endpoint)
router.get('/media/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    // This is a public endpoint, so no authentication required
    const mediaFile = await MediaModel.getMediaFile(id); // Fixed

    if (!mediaFile) {
      res.status(404).json({
        error: 'Media file not found',
        message: 'The requested media file does not exist'
      });
      return;
    }

    res.json({
      id: mediaFile.id,
      filename: mediaFile.filename,
      originalName: mediaFile.originalName,
      mimeType: mediaFile.mimeType,
      size: mediaFile.size,
      url: mediaFile.url,
      createdAt: mediaFile.createdAt
    });

  } catch (error) {
    console.error('Get media error:', error);
    res.status(500).json({
      error: 'Failed to retrieve media file',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// DELETE /content/media/:id - Delete media file
router.delete('/media/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
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

    const deleted = await MediaModel.deleteMediaFile(id, userId!);

    if (!deleted) {
      res.status(404).json({
        error: 'Media file not found or unauthorized',
        message: 'The media file does not exist or you do not have permission to delete it'
      });
      return;
    }

    res.json({
      message: 'Media file deleted successfully'
    });

  } catch (error) {
    console.error('Delete media error:', error);
    res.status(500).json({
      error: 'Failed to delete media file',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// GET /content/feed - Get user feed with pagination and enhanced sorting
router.get('/feed', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50); // Max 50 posts per page
    const sortBy = req.query.sort as 'chronological' | 'algorithmic' || 'chronological';
    const followingOnly = req.query.following === 'true';

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

    // If following only is requested, user must be authenticated
    if (followingOnly && !userId) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to view content from users you follow'
      });
      return;
    }

    const feedResult = await PostModel.getFeed({
      page,
      limit,
      userId,
      sortBy,
      followingOnly
    });

    res.json({
      posts: feedResult.posts.map(post => ({
        id: post.id,
        authorId: post.authorId,
        author: post.author, // Include author information
        content: post.content,
        mediaType: post.mediaType,
        mediaUrls: post.mediaUrls,
        media: post.media,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        shareCount: post.shareCount,
        isPublic: post.isPublic,
        isLiked: post.isLiked, // Include like status
        createdAt: post.createdAt,
        updatedAt: post.updatedAt
      })),
      pagination: {
        page,
        limit,
        hasMore: feedResult.hasMore
      },
      feedType: `${sortBy}${followingOnly ? '-following' : ''}`
    });

  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({
      error: 'Failed to retrieve feed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// GET /content/trending - Get trending posts
router.get('/trending', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 20); // Max 20 trending posts

    const trendingPosts = await PostModel.getTrendingPosts(limit);

    res.json({
      trending: trendingPosts.map(post => ({
        id: post.id,
        authorId: post.authorId,
        content: post.content,
        mediaType: post.mediaType,
        mediaUrls: post.mediaUrls,
        media: post.media,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        shareCount: post.shareCount,
        isPublic: post.isPublic,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt
      })),
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Get trending posts error:', error);
    res.status(500).json({
      error: 'Failed to retrieve trending posts',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// GET /content/combined-feed - Get combined feed with posts and blogs
router.get('/combined-feed', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50); // Max 50 items per page
    const contentType = req.query.type as string; // 'posts', 'blogs', or 'all'

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

    const results: any[] = [];
    let totalItems = 0;
    let hasMore = false;

    // Calculate how many items to fetch from each source
    const itemsPerSource = contentType === 'all' ? Math.ceil(limit / 2) : limit;

    if (contentType !== 'blogs') {
      // Fetch posts
      const postResult = await PostModel.getFeed({
        page,
        limit: itemsPerSource,
        userId
      });

      const posts = postResult.posts.map(post => ({
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
        updatedAt: post.updatedAt
      }));

      results.push(...posts);
      totalItems += posts.length;
      hasMore = hasMore || postResult.hasMore;
    }

    if (contentType !== 'posts') {
      // Fetch blogs
      const blogResult = await BlogModel.listBlogs({
        page,
        limit: itemsPerSource,
        publishedOnly: true // Only show published blogs in feed
      });

      const blogs = blogResult.blogs.map(blog => ({
        type: 'blog',
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
      }));

      results.push(...blogs);
      totalItems += blogs.length;
      hasMore = hasMore || blogResult.hasMore;
    }

    // Sort combined results by creation date (most recent first)
    results.sort((a, b) => {
      const dateA = new Date(a.publishedAt || a.createdAt);
      const dateB = new Date(b.publishedAt || b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });

    // Limit to requested number of items
    const limitedResults = results.slice(0, limit);
    const actualHasMore = results.length > limit || hasMore;

    res.json({
      content: limitedResults,
      pagination: {
        page,
        limit,
        totalItems: limitedResults.length,
        hasMore: actualHasMore
      },
      contentType: contentType || 'all'
    });

  } catch (error) {
    console.error('Get combined feed error:', error);
    res.status(500).json({
      error: 'Failed to retrieve combined feed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

export default router;