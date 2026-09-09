import { Pool } from 'pg';
import { Report, Block, ContentFlag } from './types';

export class ModerationDatabase {
  constructor(private pool: Pool) {}

  // Report management
  async createReport(report: Omit<Report, 'id' | 'createdAt' | 'updatedAt'>): Promise<Report> {
    const query = `
      INSERT INTO reports (reporter_id, target_id, target_type, reason, description, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, reporter_id as "reporterId", target_id as "targetId", 
                target_type as "targetType", reason, description, status,
                reviewer_id as "reviewerId", review_notes as "reviewNotes",
                created_at as "createdAt", updated_at as "updatedAt"
    `;
    
    const values = [
      report.reporterId,
      report.targetId,
      report.targetType,
      report.reason,
      report.description || null,
      report.status || 'pending'
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getReportById(id: string): Promise<Report | null> {
    const query = `
      SELECT id, reporter_id as "reporterId", target_id as "targetId",
             target_type as "targetType", reason, description, status,
             reviewer_id as "reviewerId", review_notes as "reviewNotes",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM reports WHERE id = $1
    `;
    
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async getReportsByStatus(status: string): Promise<Report[]> {
    const query = `
      SELECT id, reporter_id as "reporterId", target_id as "targetId",
             target_type as "targetType", reason, description, status,
             reviewer_id as "reviewerId", review_notes as "reviewNotes",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM reports WHERE status = $1
      ORDER BY created_at DESC
    `;
    
    const result = await this.pool.query(query, [status]);
    return result.rows;
  }

  async updateReportStatus(id: string, status: string, reviewerId?: string, reviewNotes?: string): Promise<Report | null> {
    const query = `
      UPDATE reports 
      SET status = $2, reviewer_id = $3, review_notes = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, reporter_id as "reporterId", target_id as "targetId",
                target_type as "targetType", reason, description, status,
                reviewer_id as "reviewerId", review_notes as "reviewNotes",
                created_at as "createdAt", updated_at as "updatedAt"
    `;
    
    const values = [id, status, reviewerId || null, reviewNotes || null];
    const result = await this.pool.query(query, values);
    return result.rows[0] || null;
  }

  // Block management
  async createBlock(block: Omit<Block, 'id' | 'createdAt'>): Promise<Block> {
    const query = `
      INSERT INTO blocks (blocker_id, blocked_id, reason)
      VALUES ($1, $2, $3)
      RETURNING id, blocker_id as "blockerId", blocked_id as "blockedId", 
                reason, created_at as "createdAt"
    `;
    
    const values = [block.blockerId, block.blockedId, block.reason || null];
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async removeBlock(blockerId: string, blockedId: string): Promise<boolean> {
    const query = `DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`;
    const result = await this.pool.query(query, [blockerId, blockedId]);
    return result.rowCount > 0;
  }

  async isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
    const query = `SELECT 1 FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`;
    const result = await this.pool.query(query, [blockerId, blockedId]);
    return result.rows.length > 0;
  }

  async getBlockedUsers(blockerId: string): Promise<Block[]> {
    const query = `
      SELECT id, blocker_id as "blockerId", blocked_id as "blockedId",
             reason, created_at as "createdAt"
      FROM blocks WHERE blocker_id = $1
      ORDER BY created_at DESC
    `;
    
    const result = await this.pool.query(query, [blockerId]);
    return result.rows;
  }

  // Content flagging
  async createContentFlag(flag: Omit<ContentFlag, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContentFlag> {
    const query = `
      INSERT INTO content_flags (content_id, content_type, flag_type, confidence_score, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, content_id as "contentId", content_type as "contentType",
                flag_type as "flagType", confidence_score, 
                status as "reviewStatus", created_at as "createdAt", 
                updated_at as "updatedAt"
    `;
    
    const values = [
      flag.contentId,
      flag.contentType,
      flag.flagType,
      flag.confidence || 0.5,
      flag.reviewStatus || 'pending'
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getFlaggedContent(reviewStatus?: string): Promise<ContentFlag[]> {
    let query = `
      SELECT id, content_id as "contentId", content_type as "contentType",
             flag_type as "flagType", confidence_score,
             status as "reviewStatus", created_at as "createdAt",
             updated_at as "updatedAt"
      FROM content_flags
    `;
    
    const values: any[] = [];
    if (reviewStatus) {
      query += ` WHERE status = $1`;
      values.push(reviewStatus);
    }
    
    query += ` ORDER BY created_at DESC`;
    
    const result = await this.pool.query(query, values);
    return result.rows;
  }

  async updateContentFlagStatus(id: string, reviewStatus: string): Promise<ContentFlag | null> {
    const query = `
      UPDATE content_flags 
      SET status = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, content_id as "contentId", content_type as "contentType",
                flag_type as "flagType", confidence_score,
                status as "reviewStatus", created_at as "createdAt",
                updated_at as "updatedAt"
    `;
    
    const result = await this.pool.query(query, [id, reviewStatus]);
    return result.rows[0] || null;
  }

  // Statistics
  async getModerationStats(): Promise<any> {
    const queries = [
      'SELECT COUNT(*) as total_reports FROM reports',
      'SELECT COUNT(*) as pending_reports FROM reports WHERE status = \'pending\'',
      'SELECT COUNT(*) as total_blocks FROM blocks',
      'SELECT COUNT(*) as flagged_content FROM content_flags WHERE status = \'pending\''
    ];

    const results = await Promise.all(
      queries.map(query => this.pool.query(query))
    );

    return {
      totalReports: parseInt(results[0].rows[0].total_reports),
      pendingReports: parseInt(results[1].rows[0].pending_reports),
      totalBlocks: parseInt(results[2].rows[0].total_blocks),
      flaggedContent: parseInt(results[3].rows[0].flagged_content)
    };
  }

  // Database initialization
  async initializeTables(): Promise<void> {
    const createReportsTable = `
      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_id UUID NOT NULL,
        target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('post', 'comment', 'user')),
        reason VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
        reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
        review_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(reporter_id, target_id, target_type)
      )
    `;

    const createBlocksTable = `
      CREATE TABLE IF NOT EXISTS blocks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(blocker_id, blocked_id),
        CHECK (blocker_id != blocked_id)
      )
    `;

    const createContentFlagsTable = `
      CREATE TABLE IF NOT EXISTS content_flags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content_id UUID NOT NULL,
        content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('post', 'comment', 'blog')),
        flag_type VARCHAR(50) NOT NULL,
        confidence_score DECIMAL(3,2),
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'removed')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await this.pool.query(createReportsTable);
    await this.pool.query(createBlocksTable);
    await this.pool.query(createContentFlagsTable);

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)',
      'CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_id, target_type)',
      'CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_id)',
      'CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id)',
      'CREATE INDEX IF NOT EXISTS idx_content_flags_status ON content_flags(status)',
      'CREATE INDEX IF NOT EXISTS idx_content_flags_content ON content_flags(content_id, content_type)'
    ];

    for (const index of indexes) {
      await this.pool.query(index);
    }
  }
}