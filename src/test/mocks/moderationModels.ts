import { Report, Block, ContentFlag, CreateReportRequest, CreateBlockRequest, ReportResponse, BlockResponse } from '../../services/moderation/types';

// In-memory storage for testing
let reports: Report[] = [];
let blocks: Block[] = [];
let contentFlags: ContentFlag[] = [];
let reportIdCounter = 1;
let blockIdCounter = 1;
let flagIdCounter = 1;

export class MockModerationModels {
  static reset() {
    reports = [];
    blocks = [];
    contentFlags = [];
    reportIdCounter = 1;
    blockIdCounter = 1;
    flagIdCounter = 1;
  }

  // Report operations
  static async createReport(reporterId: string, request: CreateReportRequest): Promise<ReportResponse> {
    // Check for duplicate reports
    const existingReport = reports.find(
      r => r.reporterId === reporterId && 
           r.targetId === request.targetId && 
           r.targetType === request.targetType &&
           r.status === 'pending'
    );

    if (existingReport) {
      return {
        id: existingReport.id,
        status: 'duplicate',
        message: 'You have already reported this content'
      };
    }

    const report: Report = {
      id: `report-${reportIdCounter++}`,
      reporterId,
      targetId: request.targetId,
      targetType: request.targetType,
      reason: request.reason,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (request.description) {
      report.description = request.description;
    }

    reports.push(report);

    return {
      id: report.id,
      status: 'created',
      message: 'Report submitted successfully'
    };
  }

  static async getReportById(id: string): Promise<Report | null> {
    return reports.find(r => r.id === id) || null;
  }

  static async getPendingReports(): Promise<Report[]> {
    return reports.filter(r => r.status === 'pending');
  }

  static async reviewReport(reportId: string, reviewerId: string, status: 'resolved' | 'dismissed', reviewNotes?: string): Promise<Report | null> {
    const report = reports.find(r => r.id === reportId);
    if (!report) return null;

    report.status = status;
    report.reviewerId = reviewerId;
    if (reviewNotes) {
      report.reviewNotes = reviewNotes;
    }
    report.updatedAt = new Date();

    return report;
  }

  // Block operations
  static async createBlock(blockerId: string, request: CreateBlockRequest): Promise<BlockResponse> {
    // Prevent self-blocking
    if (blockerId === request.blockedId) {
      return {
        blocked: false,
        message: 'Cannot block yourself'
      };
    }

    // Check if already blocked
    const existingBlock = blocks.find(
      b => b.blockerId === blockerId && b.blockedId === request.blockedId
    );

    if (existingBlock) {
      return {
        blocked: true,
        message: 'User is already blocked'
      };
    }

    const block: Block = {
      id: `block-${blockIdCounter++}`,
      blockerId,
      blockedId: request.blockedId,
      createdAt: new Date()
    };

    if (request.reason) {
      block.reason = request.reason;
    }

    blocks.push(block);

    return {
      blocked: true,
      message: 'User blocked successfully'
    };
  }

  static async removeBlock(blockerId: string, blockedId: string): Promise<BlockResponse> {
    const blockIndex = blocks.findIndex(
      b => b.blockerId === blockerId && b.blockedId === blockedId
    );

    if (blockIndex === -1) {
      return {
        blocked: false,
        message: 'Block not found'
      };
    }

    blocks.splice(blockIndex, 1);

    return {
      blocked: false,
      message: 'User unblocked successfully'
    };
  }

  static async isUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    return blocks.some(b => b.blockerId === blockerId && b.blockedId === blockedId);
  }

  static async getBlockedUsers(blockerId: string): Promise<Block[]> {
    return blocks.filter(b => b.blockerId === blockerId);
  }

  // Content flagging operations
  static async flagContent(
    contentId: string, 
    contentType: 'post' | 'comment' | 'blog', 
    flagType: string, 
    severity: 'low' | 'medium' | 'high' = 'medium', 
    automated: boolean = false
  ): Promise<ContentFlag> {
    const flag: ContentFlag = {
      id: `flag-${flagIdCounter++}`,
      contentId,
      contentType,
      flagType: flagType as any,
      severity,
      automated,
      reviewStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    contentFlags.push(flag);
    return flag;
  }

  static async getFlaggedContent(reviewStatus?: string): Promise<ContentFlag[]> {
    if (reviewStatus) {
      return contentFlags.filter(f => f.reviewStatus === reviewStatus);
    }
    return [...contentFlags];
  }

  static async updateContentFlagStatus(flagId: string, reviewStatus: 'approved' | 'removed'): Promise<ContentFlag | null> {
    const flag = contentFlags.find(f => f.id === flagId);
    if (!flag) return null;

    flag.reviewStatus = reviewStatus;
    flag.updatedAt = new Date();

    return flag;
  }

  // Utility methods
  static async canUserInteract(userId: string, targetUserId: string): Promise<boolean> {
    const isBlocked = await this.isUserBlocked(userId, targetUserId);
    const isBlockedBy = await this.isUserBlocked(targetUserId, userId);
    
    return !isBlocked && !isBlockedBy;
  }

  static async filterBlockedUsers(userId: string, userIds: string[]): Promise<string[]> {
    const filteredIds: string[] = [];
    
    for (const targetId of userIds) {
      const canInteract = await this.canUserInteract(userId, targetId);
      if (canInteract) {
        filteredIds.push(targetId);
      }
    }
    
    return filteredIds;
  }

  // Test helper methods
  static getAllReports(): Report[] {
    return [...reports];
  }

  static getAllBlocks(): Block[] {
    return [...blocks];
  }

  static getAllContentFlags(): ContentFlag[] {
    return [...contentFlags];
  }
}