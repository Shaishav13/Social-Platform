import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { ProfileModel } from './models';
import { ProfileUpdateRequest, ProfilePictureUploadResult } from './types';
import { optionalAuth, authenticateToken } from '../auth/middleware';
import { fileStorageService } from '../content/storage';
import { BlogModel } from '../blog/models';

const router = Router();

// Search users endpoint
router.get('/search/users', async (req: Request, res: Response): Promise<void> => {
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

    if (query.length > 100) {
      res.status(400).json({
        error: 'Invalid search query',
        message: 'Search query cannot exceed 100 characters'
      });
      return;
    }

    const results = await ProfileModel.searchUsers(query.trim(), page, limit);
    
    res.json({
      query,
      data: results.users,
      pagination: {
        page,
        limit,
        totalCount: results.totalCount,
        hasMore: (page * limit) < results.totalCount
      }
    });

  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// Configure multer for profile picture uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'));
    }
  },
});

// Get current user's profile
router.get('/me', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const privateProfile = await ProfileModel.getPrivateProfile(userId, userId);
    if (!privateProfile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    res.json({ success: true, data: privateProfile });
  } catch (error) {
    console.error('Error fetching current user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user profile (public or private based on permissions)
router.get('/:id', optionalAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const profileId = req.params.id;
    const viewerId = (req as any).user?.userId;

    if (!profileId) {
      res.status(400).json({ error: 'Profile ID is required' });
      return;
    }

    // If viewing own profile, return private profile
    if (profileId === viewerId) {
      const privateProfile = await ProfileModel.getPrivateProfile(profileId, viewerId);
      if (!privateProfile) {
        res.status(404).json({ error: 'Profile not found' });
        return;
      }
      res.json(privateProfile);
      return;
    }

    // Otherwise return public profile
    const publicProfile = await ProfileModel.getPublicProfile(profileId, viewerId);
    if (!publicProfile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    res.json(publicProfile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const updateData: ProfileUpdateRequest = req.body;

    // Validate request body
    if (!updateData || Object.keys(updateData).length === 0) {
      res.status(400).json({ error: 'No update data provided' });
      return;
    }

    // Handle isPrivate field - support both direct and nested format
    if ('isPrivate' in updateData && updateData.isPrivate !== undefined) {
      if (!updateData.settings) {
        updateData.settings = {};
      }
      updateData.settings.isPrivate = updateData.isPrivate as boolean;
      delete (updateData as any).isPrivate; // Remove direct field
    }

    const updatedUser = await ProfileModel.updateProfile(userId, updateData);
    if (!updatedUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Return updated private profile
    const updatedProfile = await ProfileModel.getPrivateProfile(userId, userId);
    res.json({ success: true, data: updatedProfile });
  } catch (error) {
    console.error('Error updating profile:', error);
    if (error instanceof Error) {
      if (error.message.includes('validation failed') || error.message.includes('already taken')) {
        res.status(400).json({ error: error.message });
        return;
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload profile picture
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Upload file using content storage service
    const uploadResult = await fileStorageService.saveFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    // Update user's profile picture
    const updatedUser = await ProfileModel.updateProfilePicture(userId, uploadResult.url);
    if (!updatedUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const result: ProfilePictureUploadResult = {
      url: uploadResult.url,
      filename: uploadResult.filename,
    };

    res.json(result);
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    if (error instanceof Error) {
      if (error.message.includes('Invalid file type')) {
        res.status(400).json({ error: error.message });
        return;
      }
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get profile settings
router.get('/settings', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const settings = await ProfileModel.getProfileSettings(userId);
    res.json(settings);
  } catch (error) {
    console.error('Error fetching profile settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update profile settings
router.put('/settings', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const settings = req.body;
    if (!settings || Object.keys(settings).length === 0) {
      res.status(400).json({ error: 'No settings provided' });
      return;
    }

    const updatedSettings = await ProfileModel.updateProfileSettings(userId, settings);
    res.json(updatedSettings);
  } catch (error) {
    console.error('Error updating profile settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's blogs
router.get('/:id/blogs', async (req: Request, res: Response): Promise<void> => {
  try {
    const profileId = req.params.id;
    const viewerId = (req as any).user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 20); // Max 20 blogs per page

    if (!profileId) {
      res.status(400).json({ error: 'Profile ID is required' });
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

    // Check if viewer can see drafts (only if viewing own profile)
    const includeDrafts = profileId === viewerId;

    const result = await BlogModel.getUserBlogs(profileId, {
      page,
      limit,
      includeDrafts
    });

    res.json({
      blogs: result.blogs.map(blog => ({
        id: blog.id,
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
    console.error('Error fetching user blogs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as profileRoutes };