import express from 'express';
import { LikeModel, CommentModel, ShareModel, FollowModel } from './models';
import { authenticateToken } from '../auth/middleware';
import { NotificationEventHandlers } from '../notification/eventHandlers';
import { ContentDatabase } from '../content/database';

const router = express.Router();

// Like/Unlike endpoints
router.post('/posts/:id/like', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user!.userId;

    // Validate request
    const validation = LikeModel.validateLikeRequest(postId, 'post');
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors
      });
    }

    const result = await LikeModel.toggleLike(userId, postId, 'post');
    
    // Send notification if like was added (not removed)
    if (result.liked) {
      try {
        const post = await ContentDatabase.getPostById(postId);
        if (post && post.authorId !== userId) {
          await NotificationEventHandlers.handleLikeEvent(postId, post.authorId, userId);
        }
      } catch (notificationError) {
        console.log('Notification error (non-critical):', notificationError);
      }
    }
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error toggling post like:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.delete('/posts/:id/like', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user!.userId;

    // Validate request
    const validation = LikeModel.validateLikeRequest(postId, 'post');
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors
      });
    }

    // Force unlike by calling toggleLike twice if currently liked
    const currentStatus = await LikeModel.getLikeStatus(userId, postId, 'post');
    if (currentStatus.liked) {
      const result = await LikeModel.toggleLike(userId, postId, 'post');
      res.status(200).json({
        success: true,
        data: result
      });
    } else {
      res.status(200).json({
        success: true,
        data: currentStatus
      });
    }
  } catch (error) {
    console.error('Error unliking post:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get like status for a post
router.get('/posts/:id/like', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user!.userId;

    const result = await LikeModel.getLikeStatus(userId, postId, 'post');
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting like status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Comment like/unlike endpoints
router.post('/comments/:id/like', authenticateToken, async (req, res) => {
  try {
    const commentId = req.params.id;
    const userId = req.user!.userId;

    // Validate request
    const validation = LikeModel.validateLikeRequest(commentId, 'comment');
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors
      });
    }

    const result = await LikeModel.toggleLike(userId, commentId, 'comment');
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error toggling comment like:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Comment endpoints
router.post('/posts/:id/comments', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user!.userId;
    const { content, parentId } = req.body;

    // Validate request
    const validation = CommentModel.validateCommentRequest(postId, { content, parentId });
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors
      });
    }

    const comment = await CommentModel.createComment(postId, userId, { content, parentId });
    
    // Send notification to post owner and handle mentions
    try {
      const post = await ContentDatabase.getPostById(postId);
      if (post && post.authorId !== userId) {
        await NotificationEventHandlers.handleCommentEvent(postId, post.authorId, userId, comment.id);
      }
      
      // Handle mentions in comment content
      await NotificationEventHandlers.handleMentionEvent(content, userId, comment.id, 'comment');
    } catch (notificationError) {
      console.log('Notification error (non-critical):', notificationError);
    }
    
    res.status(201).json({
      success: true,
      data: comment
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get comments for a post
router.get('/posts/:id/comments', async (req, res) => {
  try {
    const postId = req.params.id;

    const comments = await CommentModel.getCommentsByPost(postId);
    
    res.status(200).json({
      success: true,
      data: comments
    });
  } catch (error) {
    console.error('Error getting comments:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Share endpoints
router.post('/posts/:id/share', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user!.userId;

    // Validate request
    const validation = ShareModel.validateShareRequest(postId);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors
      });
    }

    const result = await ShareModel.sharePost(userId, postId);
    
    // Send notification if share was successful
    if (result.shared) {
      try {
        const post = await ContentDatabase.getPostById(postId);
        if (post && post.authorId !== userId) {
          await NotificationEventHandlers.handleShareEvent(postId, post.authorId, userId);
        }
      } catch (notificationError) {
        console.log('Notification error (non-critical):', notificationError);
      }
    }
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error sharing post:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get share status for a post
router.get('/posts/:id/share', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user!.userId;

    const result = await ShareModel.getShareStatus(userId, postId);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting share status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Follow/Unfollow endpoints
router.post('/users/:id/follow', authenticateToken, async (req, res) => {
  try {
    const followingId = req.params.id;
    const followerId = req.user!.userId;

    // Validate request
    const validation = FollowModel.validateFollowRequest(followerId, followingId);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors
      });
    }

    const result = await FollowModel.toggleFollow(followerId, followingId);
    
    // Send notification if follow was added (not removed)
    if (result.following) {
      try {
        await NotificationEventHandlers.handleFollowEvent(followingId, followerId);
      } catch (notificationError) {
        console.log('Notification error (non-critical):', notificationError);
      }
    }
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error toggling follow:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get follow status
router.get('/users/:id/follow', authenticateToken, async (req, res) => {
  try {
    const followingId = req.params.id;
    const followerId = req.user!.userId;

    const result = await FollowModel.getFollowStatus(followerId, followingId);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting follow status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;