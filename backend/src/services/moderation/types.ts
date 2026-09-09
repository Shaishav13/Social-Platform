export interface Report {
  id: string;
  reporterId: string;
  targetId: string; // Post, Comment, or User ID
  targetType: 'post' | 'comment' | 'user';
  reason: string;
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewerId?: string;
  reviewNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Block {
  id: string;
  blockerId: string;
  blockedId: string;
  reason?: string;
  createdAt: Date;
}

export interface ContentFlag {
  id: string;
  contentId: string;
  contentType: 'post' | 'comment' | 'blog';
  flagType: 'spam' | 'inappropriate' | 'harassment' | 'fake' | 'other';
  severity: 'low' | 'medium' | 'high';
  automated: boolean;
  reviewStatus: 'pending' | 'approved' | 'removed';
  createdAt: Date;
  updatedAt: Date;
}

// Request/Response types
export interface CreateReportRequest {
  targetId: string;
  targetType: 'post' | 'comment' | 'user';
  reason: string;
  description?: string;
}

export interface CreateBlockRequest {
  blockedId: string;
  reason?: string;
}

export interface ReportResponse {
  id: string;
  status: string;
  message: string;
}

export interface BlockResponse {
  blocked: boolean;
  message: string;
}

export interface ReviewReportRequest {
  status: 'resolved' | 'dismissed';
  reviewNotes?: string;
}

export interface ModerationStats {
  totalReports: number;
  pendingReports: number;
  totalBlocks: number;
  flaggedContent: number;
}