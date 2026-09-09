import { Router, Request, Response } from 'express';
import { ModerationModels } from './models';
import { CreateReportRequest, CreateBlockRequest, ReviewReportRequest } from './types';
import { ContentValidationMiddleware, ContentRateLimiter, AutoModerationService } from './contentValidation';
import { SpamDetectionService } from './spamDetection';

type AuthenticatedRequest = any;

export function createModerationRoutes(moderationModels: ModerationModels): Router {
  const router = Router();
  
  // Initialize content validation middleware
  const contentValidator = new ContentValidationMiddleware(moderationModels, {
    autoFlag: true,
    blockThreshold: 0.8,
    flagThreshold: 0.5,
    enableAutoModeration: true
  });

  const autoModerationService = new AutoModerationService(moderationModels);

  // Report content endpoint
  router.post('/report', async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const reportRequest: CreateReportRequest = req.body;
      
      // Validate request
      if (!reportRequest.targetId || !reportRequest.targetType || !reportRequest.reason) {
        return res.status(400).json({ 
          error: 'Missing required fields: targetId, targetType, reason' 
        });
      }

      if (!['post', 'comment', 'user'].includes(reportRequest.targetType)) {
        return res.status(400).json({ 
          error: 'Invalid targetType. Must be post, comment, or user' 
        });
      }

      const result = await moderationModels.createReport(req.user.id, reportRequest);
      
      if (result.status === 'duplicate') {
        return res.status(409).json(result);
      }

      res.status(201).json(result);
    } catch (error) {
      console.error('Error creating report:', error);
      res.status(500).json({ error: 'Failed to create report' });
    }
  });

  // Block user endpoint
  router.post('/block', async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const blockRequest: CreateBlockRequest = req.body;
      
      // Validate request
      if (!blockRequest.blockedId) {
        return res.status(400).json({ 
          error: 'Missing required field: blockedId' 
        });
      }

      const result = await moderationModels.createBlock(req.user.id, blockRequest);
      
      if (!result.blocked && result.message === 'Cannot block yourself') {
        return res.status(400).json(result);
      }

      if (result.blocked && result.message === 'User is already blocked') {
        return res.status(409).json(result);
      }

      res.status(201).json(result);
    } catch (error) {
      console.error('Error blocking user:', error);
      res.status(500).json({ error: 'Failed to block user' });
    }
  });

  // Unblock user endpoint
  router.delete('/block/:blockedId', async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { blockedId } = req.params;
      
      if (!blockedId) {
        return res.status(400).json({ error: 'Missing blockedId parameter' });
      }

      const result = await moderationModels.removeBlock(req.user.id, blockedId);
      
      if (result.message === 'Block not found') {
        return res.status(404).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('Error unblocking user:', error);
      res.status(500).json({ error: 'Failed to unblock user' });
    }
  });

  // Get blocked users
  router.get('/blocks', async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const blockedUsers = await moderationModels.getBlockedUsers(req.user.id);
      res.json({ blockedUsers });
    } catch (error) {
      console.error('Error fetching blocked users:', error);
      res.status(500).json({ error: 'Failed to fetch blocked users' });
    }
  });

  // Check if user is blocked
  router.get('/block-status/:userId', async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { userId } = req.params;
      const isBlocked = await moderationModels.isUserBlocked(req.user.id, userId);
      
      res.json({ isBlocked });
    } catch (error) {
      console.error('Error checking block status:', error);
      res.status(500).json({ error: 'Failed to check block status' });
    }
  });

  // Admin/Moderator endpoints (would need role-based access control in real implementation)
  
  // Get pending reports (admin only)
  router.get('/reports/pending', async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // In a real implementation, you'd check for admin/moderator role here
      const reports = await moderationModels.getPendingReports();
      res.json({ reports });
    } catch (error) {
      console.error('Error fetching pending reports:', error);
      res.status(500).json({ error: 'Failed to fetch pending reports' });
    }
  });

  // Review report (admin only)
  router.put('/reports/:reportId/review', async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { reportId } = req.params;
      const reviewRequest: ReviewReportRequest = req.body;
      
      if (!reviewRequest.status || !['resolved', 'dismissed'].includes(reviewRequest.status)) {
        return res.status(400).json({ 
          error: 'Invalid status. Must be resolved or dismissed' 
        });
      }

      const updatedReport = await moderationModels.reviewReport(
        reportId, 
        req.user.id, 
        reviewRequest.status, 
        reviewRequest.reviewNotes
      );

      if (!updatedReport) {
        return res.status(404).json({ error: 'Report not found' });
      }

      res.json({ report: updatedReport });
    } catch (error) {
      console.error('Error reviewing report:', error);
      res.status(500).json({ error: 'Failed to review report' });
    }
  });

  // Get flagged content (admin only)
  router.get('/flagged-content', async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { status } = req.query;
      const flaggedContent = await moderationModels.getFlaggedContent(status as string);
      
      res.json({ flaggedContent });
    } catch (error) {
      console.error('Error fetching flagged content:', error);
      res.status(500).json({ error: 'Failed to fetch flagged content' });
    }
  });

  // Update content flag status (admin only)
  router.put('/flagged-content/:flagId', async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { flagId } = req.params;
      const { reviewStatus } = req.body;
      
      if (!reviewStatus || !['approved', 'removed'].includes(reviewStatus)) {
        return res.status(400).json({ 
          error: 'Invalid reviewStatus. Must be approved or removed' 
        });
      }

      const updatedFlag = await moderationModels.updateContentFlagStatus(flagId, reviewStatus);

      if (!updatedFlag) {
        return res.status(404).json({ error: 'Content flag not found' });
      }

      res.json({ flag: updatedFlag });
    } catch (error) {
      console.error('Error updating content flag:', error);
      res.status(500).json({ error: 'Failed to update content flag' });
    }
  });

  // Get moderation statistics (admin only)
  router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const stats = await moderationModels.getModerationStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching moderation stats:', error);
      res.status(500).json({ error: 'Failed to fetch moderation stats' });
    }
  });

  // Content analysis endpoint for testing spam detection
  router.post('/analyze-content', async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { text, contentType } = req.body;
      
      if (!text || !contentType) {
        return res.status(400).json({ 
          error: 'Missing required fields: text, contentType' 
        });
      }

      if (!['post', 'comment', 'blog'].includes(contentType)) {
        return res.status(400).json({ 
          error: 'Invalid contentType. Must be post, comment, or blog' 
        });
      }

      const analysis = await SpamDetectionService.processContentForModeration(
        'analysis-' + Date.now(),
        contentType,
        text,
        req.user.id
      );

      res.json({
        analysis,
        recommendation: analysis.isSpam ? 'block' : 'allow',
        autoActions: {
          wouldBlock: analysis.confidence >= 0.8,
          wouldFlag: analysis.confidence >= 0.5
        }
      });
    } catch (error) {
      console.error('Error analyzing content:', error);
      res.status(500).json({ error: 'Failed to analyze content' });
    }
  });

  // Content validation middleware endpoints (for integration with other services)
  router.use('/validate/post', ContentRateLimiter.rateLimitContent as any, contentValidator.validatePostContent as any);
  router.use('/validate/comment', ContentRateLimiter.rateLimitContent as any, contentValidator.validateCommentContent as any);
  router.use('/validate/blog', ContentRateLimiter.rateLimitContent as any, contentValidator.validateBlogContent as any);

  // Automated moderation trigger endpoint
  router.post('/auto-moderate', async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { contentId, contentType, text } = req.body;
      
      if (!contentId || !contentType || !text) {
        return res.status(400).json({ 
          error: 'Missing required fields: contentId, contentType, text' 
        });
      }

      const analysis = await SpamDetectionService.processContentForModeration(
        contentId,
        contentType,
        text,
        req.user.id
      );

      await autoModerationService.processAutomatedActions(
        contentId,
        contentType,
        analysis,
        req.user.id
      );

      res.json({
        processed: true,
        analysis,
        actions: {
          flagged: analysis.confidence >= 0.5,
          severity: analysis.severity
        }
      });
    } catch (error) {
      console.error('Error in auto-moderation:', error);
      res.status(500).json({ error: 'Failed to process auto-moderation' });
    }
  });

  return router;
}