import express from 'express';
import { LikeModel, CommentModel, ShareModel, FollowModel } from './models';
import { SocialDatabase } from './database';
import { authenticateToken } from '../auth/middleware';
import { NotificationEventHandlers } from '../notification/eventHandlers';
import { ContentDatabase } from '../content/database';

const router = express.Router();

// Save / Bookmark endpoints
router.post('/posts/:id/save', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = (req as any).user.userId;

    const result = await SocialDatabase.toggleSavePost(userId, postId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error toggling post save:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/saved-posts', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const posts = await SocialDatabase.getSavedPosts(userId, limit, offset);

    res.status(200).json({
      success: true,
      data: posts,
      posts
    });
  } catch (error) {
    console.error('Error fetching saved posts:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Like/Unlike endpoints
router.post('/posts/:id/like', authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = (req as any).user.userId;

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
    const userId = (req as any).user.userId;

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
    const userId = (req as any).user.userId;

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
    const userId = (req as any).user.userId;

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
    const userId = (req as any).user.userId;
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
      await NotificationEventHandlers.handleMentionEvent(content, userId, comment.id, postId, 'comment');
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
    const userId = (req as any).user.userId;

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
    const userId = (req as any).user.userId;

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
    const targetId = req.params.id;
    const requesterId = (req as any).user.userId;

    // Validate request
    const validation = FollowModel.validateFollowRequest(requesterId, targetId);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors
      });
    }

    const result = await FollowModel.sendFollowRequest(requesterId, targetId);
    
    // Send appropriate notification
    if (result.following) {
      // Direct follow (public account) - send follow notification
      try {
        await NotificationEventHandlers.handleFollowEvent(targetId, requesterId);
      } catch (notificationError) {
        console.log('Notification error (non-critical):', notificationError);
      }
    } else if (result.requested) {
      // Follow request sent (private account) - send follow request notification
      try {
        await NotificationEventHandlers.handleFollowRequestEvent(targetId, requesterId);
      } catch (notificationError) {
        console.log('Notification error (non-critical):', notificationError);
      }
    }
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error sending follow request:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Unfollow endpoint
router.delete('/users/:id/follow', authenticateToken, async (req, res) => {
  try {
    const targetId = req.params.id;
    const requesterId = (req as any).user.userId;

    const result = await FollowModel.unfollow(requesterId, targetId);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Cancel follow request endpoint
router.delete('/users/:id/follow-request', authenticateToken, async (req, res) => {
  try {
    const targetId = req.params.id;
    const requesterId = (req as any).user.userId;

    const result = await FollowModel.cancelFollowRequest(requesterId, targetId);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error cancelling follow request:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Accept follow request endpoint
router.post('/follow-requests/:id/accept', authenticateToken, async (req, res) => {
  try {
    const requestId = req.params.id;
    const targetId = (req as any).user.userId;

    const result = await FollowModel.acceptFollowRequest(requestId, targetId);
    
    if (result.success) {
      // Send notification to requester that their request was accepted
      try {
        // Get the request details to find the requester
        const requests = await FollowModel.getPendingFollowRequests(targetId);
        const acceptedRequest = requests.find(r => r.id === requestId);
        if (acceptedRequest) {
          await NotificationEventHandlers.handleFollowAcceptedEvent(acceptedRequest.requesterId, targetId);
        }
      } catch (notificationError) {
        console.log('Notification error (non-critical):', notificationError);
      }
    }
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error accepting follow request:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Decline follow request endpoint
router.post('/follow-requests/:id/decline', authenticateToken, async (req, res) => {
  try {
    const requestId = req.params.id;
    const targetId = (req as any).user.userId;

    const result = await FollowModel.declineFollowRequest(requestId, targetId);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error declining follow request:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get pending follow requests
router.get('/follow-requests', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user.userId;

    const requests = await FollowModel.getPendingFollowRequests(userId);
    
    res.status(200).json({
      success: true,
      data: requests
    });
  } catch (error) {
    console.error('Error getting follow requests:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get follow status
router.get('/users/:id/follow', authenticateToken, async (req, res) => {
  try {
    const targetId = req.params.id;
    const requesterId = (req as any).user.userId;

    const result = await FollowModel.getFollowStatus(requesterId, targetId);
    
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

// Get followers list
router.get('/users/:id/followers', authenticateToken, async (req, res) => {
  try {
    const targetId = req.params.id;
    const result = await FollowModel.getFollowersList(targetId);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting followers list:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get following list
router.get('/users/:id/following', authenticateToken, async (req, res) => {
  try {
    const targetId = req.params.id;
    const result = await FollowModel.getFollowingList(targetId);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting following list:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;