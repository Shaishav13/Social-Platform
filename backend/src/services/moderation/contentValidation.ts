import { Request, Response, NextFunction } from 'express';
import { SpamDetectionService, SpamDetectionResult } from './spamDetection';
import { ModerationModels } from './models';

type AuthenticatedRequest = any;

interface ContentValidationOptions {
  autoFlag?: boolean;
  blockThreshold?: number; // Confidence threshold to block content
  flagThreshold?: number;  // Confidence threshold to flag for review
  enableAutoModeration?: boolean;
}

export class ContentValidationMiddleware {
  private moderationModels: ModerationModels;
  private options: ContentValidationOptions;

  constructor(moderationModels: ModerationModels, options: ContentValidationOptions = {}) {
    this.moderationModels = moderationModels;
    this.options = {
      autoFlag: true,
      blockThreshold: 0.8,
      flagThreshold: 0.5,
      enableAutoModeration: true,
      ...options
    };
  }

  // Middleware for validating post content
  validatePostContent = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { content, title } = req.body;
      const textToAnalyze = [title, content].filter(Boolean).join(' ');

      if (!textToAnalyze.trim()) {
        return res.status(400).json({ error: 'Content cannot be empty' });
      }

      const result = await this.analyzeAndProcessContent(
        textToAnalyze,
        'post',
        req.user.id
      );

      if (result.shouldBlock) {
        return res.status(403).json({
          error: 'Content blocked due to policy violations',
          reasons: result.analysis.reasons,
          flagType: result.analysis.flagType
        });
      }

      // Add analysis result to request for downstream processing
      req.body._moderationAnalysis = result.analysis;
      next();
    } catch (error) {
      console.error('Content validation error:', error);
      next(); // Continue on error to avoid blocking legitimate content
    }
  };

  // Middleware for validating comment content
  validateCommentContent = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { content } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Comment content cannot be empty' });
      }

      const result = await this.analyzeAndProcessContent(
        content,
        'comment',
        req.user.id
      );

      if (result.shouldBlock) {
        return res.status(403).json({
          error: 'Comment blocked due to policy violations',
          reasons: result.analysis.reasons,
          flagType: result.analysis.flagType
        });
      }

      req.body._moderationAnalysis = result.analysis;
      next();
    } catch (error) {
      console.error('Comment validation error:', error);
      next();
    }
  };

  // Middleware for validating blog content
  validateBlogContent = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { title, content, excerpt } = req.body;
      const textToAnalyze = [title, excerpt, content].filter(Boolean).join(' ');

      if (!textToAnalyze.trim()) {
        return res.status(400).json({ error: 'Blog content cannot be empty' });
      }

      const result = await this.analyzeAndProcessContent(
        textToAnalyze,
        'blog',
        req.user.id
      );

      if (result.shouldBlock) {
        return res.status(403).json({
          error: 'Blog post blocked due to policy violations',
          reasons: result.analysis.reasons,
          flagType: result.analysis.flagType
        });
      }

      req.body._moderationAnalysis = result.analysis;
      next();
    } catch (error) {
      console.error('Blog validation error:', error);
      next();
    }
  };

  private async analyzeAndProcessContent(
    text: string,
    contentType: 'post' | 'comment' | 'blog',
    authorId: string
  ): Promise<{
    analysis: SpamDetectionResult;
    shouldBlock: boolean;
    shouldFlag: boolean;
  }> {
    // Analyze content for spam/inappropriate content
    const analysis = await SpamDetectionService.processContentForModeration(
      'temp-id', // Will be replaced with actual content ID after creation
      contentType,
      text,
      authorId
    );

    const shouldBlock = this.options.enableAutoModeration && 
                       analysis.confidence >= (this.options.blockThreshold || 0.8);
    
    const shouldFlag = this.options.autoFlag && 
                      analysis.confidence >= (this.options.flagThreshold || 0.5);

    return {
      analysis,
      shouldBlock,
      shouldFlag
    };
  }

  // Post-creation hook to flag content if needed
  async flagContentIfNeeded(
    contentId: string,
    contentType: 'post' | 'comment' | 'blog',
    analysis: SpamDetectionResult
  ): Promise<void> {
    if (!this.options.autoFlag) return;

    const shouldFlag = analysis.confidence >= (this.options.flagThreshold || 0.5);
    
    if (shouldFlag) {
      try {
        await this.moderationModels.flagContent(
          contentId,
          contentType,
          analysis.flagType,
          analysis.severity,
          true // automated flag
        );
        
        console.log(`Content ${contentId} automatically flagged: ${analysis.flagType} (confidence: ${analysis.confidence})`);
      } catch (error) {
        console.error('Error flagging content:', error);
      }
    }
  }
}

// Rate limiting middleware for content creation
export class ContentRateLimiter {
  private static userRequestCounts = new Map<string, { count: number; resetTime: number }>();
  private static readonly RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
  private static readonly MAX_REQUESTS_PER_WINDOW = 10;

  static rateLimitContent = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.id;
    const now = Date.now();
    const userLimit = this.userRequestCounts.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      // Reset or initialize rate limit
      this.userRequestCounts.set(userId, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW
      });
      return next();
    }

    if (userLimit.count >= this.MAX_REQUESTS_PER_WINDOW) {
      const resetIn = Math.ceil((userLimit.resetTime - now) / 1000);
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Too many content submissions. Try again in ${resetIn} seconds.`,
        resetIn
      });
    }

    userLimit.count++;
    next();
  };

  static cleanup() {
    const now = Date.now();
    for (const [userId, limit] of this.userRequestCounts.entries()) {
      if (now > limit.resetTime) {
        this.userRequestCounts.delete(userId);
      }
    }
  }
}

// Automated moderation actions
export class AutoModerationService {
  private moderationModels: ModerationModels;

  constructor(moderationModels: ModerationModels) {
    this.moderationModels = moderationModels;
  }

  async processAutomatedActions(
    contentId: string,
    contentType: 'post' | 'comment' | 'blog',
    analysis: SpamDetectionResult,
    authorId: string
  ): Promise<void> {
    // High confidence spam - auto-flag and potentially hide
    if (analysis.confidence >= 0.9 && analysis.isSpam) {
      await this.moderationModels.flagContent(
        contentId,
        contentType,
        analysis.flagType,
        'high',
        true
      );

      // Could implement auto-hiding logic here
      console.log(`High-confidence spam detected for content ${contentId}, flagged for immediate review`);
    }

    // Medium confidence - flag for review
    else if (analysis.confidence >= 0.6) {
      await this.moderationModels.flagContent(
        contentId,
        contentType,
        analysis.flagType,
        analysis.severity,
        true
      );

      console.log(`Content ${contentId} flagged for review: ${analysis.flagType} (${analysis.confidence})`);
    }

    // Track user behavior for potential bot detection
    if (analysis.confidence >= 0.4) {
      // Could implement user behavior tracking here
      console.log(`Suspicious content from user ${authorId}, tracking for patterns`);
    }
  }

  async reviewFlaggedContent(): Promise<void> {
    try {
      const flaggedContent = await this.moderationModels.getFlaggedContent('pending');
      
      for (const flag of flaggedContent) {
        // Implement automated review logic
        if (flag.automated && flag.severity === 'high') {
          // Auto-approve removal for high-severity automated flags
          await this.moderationModels.updateContentFlagStatus(flag.id, 'removed');
          console.log(`Auto-removed high-severity flagged content: ${flag.contentId}`);
        }
      }
    } catch (error) {
      console.error('Error in automated content review:', error);
    }
  }
}

// Cleanup service to run periodically
export class ModerationCleanupService {
  static cleanup() {
    ContentRateLimiter.cleanup();
    // Add other cleanup tasks as needed
  }
}