import { ModerationDatabase } from './database';
import { 
  Report, 
  Block, 
  ContentFlag, 
  CreateReportRequest, 
  CreateBlockRequest,
  ReportResponse,
  BlockResponse,
  ModerationStats
} from './types';

export class ModerationModels {
  constructor(private db: ModerationDatabase) {}

  // Report operations
  async createReport(reporterId: string, request: CreateReportRequest): Promise<ReportResponse> {
    try {
      // Check if user has already reported this target
      const existingReports = await this.db.getReportsByStatus('pending');
      const duplicateReport = existingReports.find(
        report => report.reporterId === reporterId && 
                 report.targetId === request.targetId && 
                 report.targetType === request.targetType
      );

      if (duplicateReport) {
        return {
          id: duplicateReport.id,
          status: 'duplicate',
          message: 'You have already reported this content'
        };
      }

      const report = await this.db.createReport({
        reporterId,
        targetId: request.targetId,
        targetType: request.targetType,
        reason: request.reason,
        description: request.description,
        status: 'pending'
      });

      return {
        id: report.id,
        status: 'created',
        message: 'Report submitted successfully'
      };
    } catch (error) {
      console.error('Error creating report:', error);
      throw new Error('Failed to create report');
    }
  }

  async getReportById(id: string): Promise<Report | null> {
    return this.db.getReportById(id);
  }

  async getPendingReports(): Promise<Report[]> {
    return this.db.getReportsByStatus('pending');
  }

  async reviewReport(reportId: string, reviewerId: string, status: 'resolved' | 'dismissed', reviewNotes?: string): Promise<Report | null> {
    return this.db.updateReportStatus(reportId, status, reviewerId, reviewNotes);
  }

  // Block operations
  async createBlock(blockerId: string, request: CreateBlockRequest): Promise<BlockResponse> {
    try {
      // Prevent self-blocking
      if (blockerId === request.blockedId) {
        return {
          blocked: false,
          message: 'Cannot block yourself'
        };
      }

      // Check if already blocked
      const isAlreadyBlocked = await this.db.isBlocked(blockerId, request.blockedId);
      if (isAlreadyBlocked) {
        return {
          blocked: true,
          message: 'User is already blocked'
        };
      }

      await this.db.createBlock({
        blockerId,
        blockedId: request.blockedId,
        reason: request.reason
      });

      return {
        blocked: true,
        message: 'User blocked successfully'
      };
    } catch (error) {
      console.error('Error creating block:', error);
      throw new Error('Failed to block user');
    }
  }

  async removeBlock(blockerId: string, blockedId: string): Promise<BlockResponse> {
    try {
      const removed = await this.db.removeBlock(blockerId, blockedId);
      
      return {
        blocked: !removed,
        message: removed ? 'User unblocked successfully' : 'Block not found'
      };
    } catch (error) {
      console.error('Error removing block:', error);
      throw new Error('Failed to unblock user');
    }
  }

  async isUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    return this.db.isBlocked(blockerId, blockedId);
  }

  async getBlockedUsers(blockerId: string): Promise<Block[]> {
    return this.db.getBlockedUsers(blockerId);
  }

  // Content flagging operations
  async flagContent(contentId: string, contentType: 'post' | 'comment' | 'blog', flagType: string, severity: 'low' | 'medium' | 'high' = 'medium', automated: boolean = false): Promise<ContentFlag> {
    return this.db.createContentFlag({
      contentId,
      contentType,
      flagType: flagType as any,
      severity,
      automated,
      reviewStatus: 'pending'
    });
  }

  async getFlaggedContent(reviewStatus?: string): Promise<ContentFlag[]> {
    return this.db.getFlaggedContent(reviewStatus);
  }

  async updateContentFlagStatus(flagId: string, reviewStatus: 'approved' | 'removed'): Promise<ContentFlag | null> {
    return this.db.updateContentFlagStatus(flagId, reviewStatus);
  }

  // Statistics
  async getModerationStats(): Promise<ModerationStats> {
    return this.db.getModerationStats();
  }

  // Utility methods for checking user interactions
  async canUserInteract(userId: string, targetUserId: string): Promise<boolean> {
    // Check if either user has blocked the other
    const isBlocked = await this.db.isBlocked(userId, targetUserId);
    const isBlockedBy = await this.db.isBlocked(targetUserId, userId);
    
    return !isBlocked && !isBlockedBy;
  }

  async filterBlockedUsers(userId: string, userIds: string[]): Promise<string[]> {
    const filteredIds: string[] = [];
    
    for (const targetId of userIds) {
      const canInteract = await this.canUserInteract(userId, targetId);
      if (canInteract) {
        filteredIds.push(targetId);
      }
    }
    
    return filteredIds;
  }
}