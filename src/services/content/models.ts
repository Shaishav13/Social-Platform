import { Post, MediaFile, CreatePostRequest, UpdatePostRequest, PostWithMedia, MediaUploadResult } from './types';
import { ContentDatabase } from './database';
import { FileStorageService, fileStorageService } from './storage';
import { v4 as uuidv4 } from 'uuid';

export class PostModel {
  static async searchPosts(query: string, page: number, limit: number): Promise<{ posts: any[]; totalCount: number }> {
    return await ContentDatabase.searchPosts(query, page, limit);
  }
  static async createPost(authorId: string, postData: CreatePostRequest): Promise<PostWithMedia> {
    // Validate content - allow empty content only if there are media files
    if (!postData.content || postData.content.trim().length === 0) {
      if (!postData.mediaIds || postData.mediaIds.length === 0) {
        throw new Error('Post must have either content or media files');
      }
    }

    if (postData.content.length > 5000) {
      throw new Error('Post content cannot exceed 5000 characters');
    }

    // Validate media IDs if provided
    if (postData.mediaIds && postData.mediaIds.length > 0) {
      for (const mediaId of postData.mediaIds) {
        const mediaFile = await ContentDatabase.findMediaFileById(mediaId);
        if (!mediaFile) {
          throw new Error(`Media file not found: ${mediaId}`);
        }
        if (mediaFile.uploadedBy !== authorId) {
          throw new Error(`Unauthorized access to media file: ${mediaId}`);
        }
      }
    }

    const post = await ContentDatabase.createPost(authorId, postData);
    const postWithMedia = await ContentDatabase.findPostWithMedia(post.id);
    
    if (!postWithMedia) {
      throw new Error('Failed to retrieve created post');
    }

    return postWithMedia;
  }

  static async getPost(postId: string, requesterId?: string | undefined): Promise<PostWithMedia | null> {
    const post = await ContentDatabase.findPostWithMedia(postId);
    
    if (!post) {
      return null;
    }

    // Check privacy settings
    if (!post.isPublic && post.authorId !== requesterId) {
      return null; // Private post, not accessible to this user
    }

    return post;
  }

  static async updatePost(
    postId: string, 
    authorId: string, 
    updates: UpdatePostRequest
  ): Promise<PostWithMedia | null> {
    // Validate content if provided
    if (updates.content !== undefined) {
      if (updates.content.trim().length === 0) {
        throw new Error('Post content cannot be empty');
      }
      if (updates.content.length > 5000) {
        throw new Error('Post content cannot exceed 5000 characters');
      }
    }

    const updatedPost = await ContentDatabase.updatePost(postId, authorId, updates);
    
    if (!updatedPost) {
      return null; // Post not found or not owned by author
    }

    return ContentDatabase.findPostWithMedia(postId);
  }

  static async deletePost(postId: string, authorId: string): Promise<boolean> {
    // Get post with media to clean up files
    const post = await ContentDatabase.findPostWithMedia(postId);
    
    if (!post || post.authorId !== authorId) {
      return false;
    }

    // Delete the post (media files will be handled by cascade delete in DB)
    const deleted = await ContentDatabase.deletePost(postId, authorId);
    
    if (deleted && post.media.length > 0) {
      // Optionally clean up orphaned media files
      // This could be done in a background job to avoid blocking the request
      try {
        for (const media of post.media) {
          await fileStorageService.deleteFile(media.filename);
        }
      } catch (error) {
        // Log error but don't fail the delete operation
        console.error('Failed to delete media files:', error);
      }
    }

    return deleted;
  }

  static async getFeed(options: {
    page: number;
    limit: number;
    userId?: string;
    sortBy?: 'chronological' | 'algorithmic';
    followingOnly?: boolean;
  }): Promise<{ posts: PostWithMedia[]; hasMore: boolean }> {
    const offset = (options.page - 1) * options.limit;
    
    // Get one extra post to check if there are more
    const feedOptions = {
      limit: options.limit + 1,
      offset,
      userId: options.userId,
      sortBy: options.sortBy || 'chronological',
      followingOnly: options.followingOnly || false
    };
    
    const posts = await ContentDatabase.getEnhancedFeed(feedOptions);

    const hasMore = posts.length > options.limit;
    
    // Remove the extra post if it exists
    if (hasMore) {
      posts.pop();
    }

    return { posts, hasMore };
  }

  static async getTrendingPosts(limit: number = 10): Promise<PostWithMedia[]> {
    return await ContentDatabase.getTrendingPosts(limit);
  }

  static async getPostsByAuthor(
    authorId: string, 
    options: { 
      limit?: number; 
      offset?: number; 
      viewerId?: string;
      includePrivate?: boolean;
    } = {}
  ): Promise<PostWithMedia[]> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    
    return await ContentDatabase.getPostsByAuthor(authorId, {
      limit,
      offset,
      viewerId: options.viewerId,
      includePrivate: options.includePrivate || false
    });
  }

  static validatePostContent(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!content || content.trim().length === 0) {
      errors.push('Post content cannot be empty');
    }

    if (content.length > 5000) {
      errors.push('Post content cannot exceed 5000 characters');
    }

    // Check for potentially harmful content (basic validation)
    const suspiciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        errors.push('Post content contains potentially harmful code');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export class MediaModel {
  static async uploadFile(
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    uploadedBy: string
  ): Promise<MediaUploadResult> {
    // Validate file type
    if (!FileStorageService.validateFileType(file.mimetype)) {
      throw new Error(`Unsupported file type: ${file.mimetype}`);
    }

    // Validate file size (50MB default limit)
    if (!FileStorageService.validateFileSize(file.size)) {
      throw new Error('File size exceeds maximum limit of 50MB');
    }

    // Save file to storage
    const { filename, url } = await fileStorageService.saveFile(
      file.buffer,
      file.originalname,
      file.mimetype
    );

    // Save metadata to database
    const mediaFile = await ContentDatabase.createMediaFile({
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url,
      uploadedBy
    });

    return {
      id: mediaFile.id,
      url: mediaFile.url,
      filename: mediaFile.filename,
      size: mediaFile.size,
      mimeType: mediaFile.mimeType
    };
  }

  static async getMediaFile(mediaId: string, requesterId?: string): Promise<MediaFile | null> {
    const mediaFile = await ContentDatabase.findMediaFileById(mediaId);
    
    if (!mediaFile) {
      return null;
    }

    // For now, all media files are accessible if you have the ID
    // In the future, we might add privacy controls
    return mediaFile;
  }

  static async deleteMediaFile(mediaId: string, userId: string): Promise<boolean> {
    const mediaFile = await ContentDatabase.findMediaFileById(mediaId);
    
    if (!mediaFile || mediaFile.uploadedBy !== userId) {
      return false;
    }

    try {
      // Delete from storage
      await fileStorageService.deleteFile(mediaFile.filename);
      
      // Note: Database deletion will be handled by cascade when posts are deleted
      // For standalone media deletion, we'd need to add a delete method to ContentDatabase
      
      return true;
    } catch (error) {
      console.error('Failed to delete media file:', error);
      return false;
    }
  }

  static validateFileUpload(file: {
    mimetype: string;
    size: number;
    originalname: string;
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate file type
    if (!FileStorageService.validateFileType(file.mimetype)) {
      errors.push(`Unsupported file type: ${file.mimetype}. Supported types: JPEG, PNG, GIF, MP4, MOV, AVI`);
    }

    // Validate file size
    if (!FileStorageService.validateFileSize(file.size)) {
      errors.push('File size exceeds maximum limit of 50MB');
    }

    // Validate filename
    if (!file.originalname || file.originalname.trim().length === 0) {
      errors.push('File must have a valid name');
    }

    if (file.originalname.length > 255) {
      errors.push('Filename is too long (maximum 255 characters)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static getSupportedFileTypes(): string[] {
    return [
      'image/jpeg',
      'image/jpg',
      'image/png', 
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/webm'
    ];
  }

  static getMaxFileSize(): number {
    return 50 * 1024 * 1024; // 50MB in bytes
  }
}