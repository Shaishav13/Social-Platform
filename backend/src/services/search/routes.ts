import express, { Request, Response } from 'express';
import { SearchModel } from './models';
import { SearchQuery, FeedOptions } from './types';

const router = express.Router();

// GET /search/users - User suggestions / tagging autocomplete
router.get('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = (req.query.q as string) || '';
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);

    const userResults = await SearchModel.searchUsers(query, 1, limit);
    res.json({
      users: (userResults.results || []).map((u: any) => ({
        id: u.id,
        username: u.username,
        bio: u.bio,
        profilePicture: u.profilePicture,
        isVerified: u.isVerified || false
      }))
    });
  } catch (error) {
    console.error('Error searching users for mention autocomplete:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// GET /search - Universal search endpoint
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query.q as string;
    const contentType = req.query.type as 'posts' | 'blogs' | 'users' | 'all';
    const tagsParam = req.query.tags as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const sortBy = req.query.sort as 'relevance' | 'date' || 'relevance';

    // Validate query parameter
    if (!query || query.trim().length === 0) {
      res.status(400).json({
        error: 'Invalid search query',
        message: 'Search query (q) parameter is required'
      });
      return;
    }

    // Validate pagination
    if (page < 1) {
      res.status(400).json({
        error: 'Invalid pagination',
        message: 'Page number must be greater than 0'
      });
      return;
    }

    if (limit < 1 || limit > 50) {
      res.status(400).json({
        error: 'Invalid pagination',
        message: 'Limit must be between 1 and 50'
      });
      return;
    }

    // Handle user search separately
    if (contentType === 'users') {
      const userResults = await SearchModel.searchUsers(query, page, limit);
      res.json({
        query,
        data: userResults.results,
        pagination: {
          page,
          limit,
          totalCount: userResults.totalCount,
          hasMore: (page * limit) < userResults.totalCount
        },
        searchTime: 0
      });
      return;
    }

    // Validate and sanitize search query for content
    const validation = SearchModel.validateSearchQuery(query);
    if (!validation.isValid) {
      res.status(400).json({
        error: 'Invalid search query',
        message: 'Search query validation failed',
        details: validation.errors
      });
      return;
    }

    const sanitizedQuery = SearchModel.sanitizeSearchQuery(query);
    const tags = SearchModel.parseSearchTags(tagsParam);

    const searchQuery: SearchQuery = {
      query: sanitizedQuery,
      contentType: (contentType as any) === 'users' ? 'all' : contentType,
      tags,
      page,
      limit,
      sortBy
    };

    const searchResult = await SearchModel.search(searchQuery);

    res.json(searchResult);

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// GET /search/feed - Enhanced feed with algorithmic and chronological sorting
router.get('/feed', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const sortBy = req.query.sort as 'chronological' | 'algorithmic' || 'chronological';
    const contentType = req.query.type as 'posts' | 'blogs' | 'all' || 'all';
    const followingOnly = req.query.following === 'true';

    // Validate pagination
    if (page < 1) {
      res.status(400).json({
        error: 'Invalid pagination',
        message: 'Page number must be greater than 0'
      });
      return;
    }

    if (limit < 1 || limit > 50) {
      res.status(400).json({
        error: 'Invalid pagination',
        message: 'Limit must be between 1 and 50'
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

    const feedOptions: FeedOptions = {
      userId,
      page,
      limit,
      sortBy,
      contentType,
      followingOnly
    };

    const feedResult = await SearchModel.getEnhancedFeed(feedOptions);

    res.json(feedResult);

  } catch (error) {
    console.error('Enhanced feed error:', error);
    res.status(500).json({
      error: 'Failed to retrieve enhanced feed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// GET /search/trending - Get trending content
router.get('/trending', async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 20);

    // For now, we'll use the enhanced feed with algorithmic sorting to get trending content
    const feedOptions: FeedOptions = {
      page: 1,
      limit,
      sortBy: 'algorithmic',
      contentType: 'posts' // Focus on posts for trending
    };

    const feedResult = await SearchModel.getEnhancedFeed(feedOptions);

    res.json({
      trending: feedResult.content.slice(0, limit),
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Trending content error:', error);
    res.status(500).json({
      error: 'Failed to retrieve trending content',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// POST /search/refresh-trending - Refresh trending content (admin endpoint)
router.post('/refresh-trending', async (req: Request, res: Response): Promise<void> => {
  try {
    // In a real application, you'd want to add admin authentication here
    await SearchModel.refreshTrendingContent();

    res.json({
      message: 'Trending content refreshed successfully',
      refreshedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Refresh trending error:', error);
    res.status(500).json({
      error: 'Failed to refresh trending content',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

export default router;