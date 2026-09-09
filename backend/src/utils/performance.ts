import { Pool } from 'pg';
import { DatabaseConnection } from '../config/database';

export class DatabaseOptimizer {
  private static pool: Pool;

  static initialize() {
    this.pool = DatabaseConnection.getPool();
  }

  // Create optimized indexes for better query performance
  static async createOptimizedIndexes(): Promise<void> {
    const indexes = [
      // User table indexes
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username ON users(username)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users(created_at)',

      // Posts table indexes
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_author_id ON posts(author_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_public ON posts(is_public) WHERE is_public = true',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_author_created ON posts(author_id, created_at DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_content_search ON posts USING gin(to_tsvector(\'english\', content))',

      // Comments table indexes
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_post_id ON comments(post_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_author_id ON comments(author_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comments_parent_id ON comments(parent_id) WHERE parent_id IS NOT NULL',

      // Likes table indexes
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_likes_target_id ON likes(target_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_likes_user_id ON likes(user_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_likes_unique ON likes(user_id, target_id, target_type)',

      // Follows table indexes
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_follower_id ON follows(follower_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_following_id ON follows(following_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_unique ON follows(follower_id, following_id)',

      // Blog posts indexes
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blog_posts_author_id ON blog_posts(author_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blog_posts_published ON blog_posts(published_at DESC) WHERE published_at IS NOT NULL',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blog_posts_draft ON blog_posts(author_id) WHERE is_draft = true',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blog_posts_search ON blog_posts USING gin(to_tsvector(\'english\', title || \' \' || content))',

      // Notifications indexes
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false',

      // Sessions indexes
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_token ON user_sessions(refresh_token)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at)',

      // Composite indexes for common queries
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_feed ON posts(author_id, created_at DESC, is_public)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC)',
    ];

    console.log('🔧 Creating database indexes for performance optimization...');

    for (const indexQuery of indexes) {
      try {
        await this.pool.query(indexQuery);
        console.log(`✅ Index created: ${indexQuery.split(' ')[5]}`);
      } catch (error: any) {
        if (error.code === '42P07') {
          // Index already exists
          console.log(`ℹ️  Index already exists: ${indexQuery.split(' ')[5]}`);
        } else {
          console.error(`❌ Failed to create index: ${indexQuery}`, error.message);
        }
      }
    }

    console.log('✅ Database indexing completed');
  }

  // Analyze table statistics for query optimization
  static async analyzeTableStatistics(): Promise<void> {
    const tables = [
      'users', 'posts', 'comments', 'likes', 'follows', 
      'blog_posts', 'notifications', 'user_sessions'
    ];

    console.log('📊 Analyzing table statistics...');

    for (const table of tables) {
      try {
        await this.pool.query(`ANALYZE ${table}`);
        console.log(`✅ Analyzed table: ${table}`);
      } catch (error: any) {
        console.error(`❌ Failed to analyze table ${table}:`, error.message);
      }
    }

    console.log('✅ Table analysis completed');
  }

  // Clean up old data to maintain performance
  static async cleanupOldData(): Promise<void> {
    const cleanupQueries = [
      // Remove expired sessions
      'DELETE FROM user_sessions WHERE expires_at < NOW()',
      
      // Remove old notifications (older than 6 months)
      'DELETE FROM notifications WHERE created_at < NOW() - INTERVAL \'6 months\'',
      
      // Remove orphaned likes (posts/comments that no longer exist)
      `DELETE FROM likes WHERE target_type = 'post' AND target_id NOT IN (SELECT id FROM posts)`,
      `DELETE FROM likes WHERE target_type = 'comment' AND target_id NOT IN (SELECT id FROM comments)`,
      
      // Remove orphaned comments (posts that no longer exist)
      'DELETE FROM comments WHERE post_id NOT IN (SELECT id FROM posts)',
    ];

    console.log('🧹 Cleaning up old data...');

    for (const query of cleanupQueries) {
      try {
        const result = await this.pool.query(query);
        console.log(`✅ Cleanup completed: ${result.rowCount} rows affected`);
      } catch (error: any) {
        console.error(`❌ Cleanup failed:`, error.message);
      }
    }

    console.log('✅ Data cleanup completed');
  }

  // Get database performance metrics
  static async getPerformanceMetrics(): Promise<any> {
    try {
      const queries = {
        // Database size
        dbSize: `
          SELECT pg_size_pretty(pg_database_size(current_database())) as size
        `,
        
        // Table sizes
        tableSizes: `
          SELECT 
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
            pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
          FROM pg_tables 
          WHERE schemaname = 'public'
          ORDER BY size_bytes DESC
        `,
        
        // Index usage
        indexUsage: `
          SELECT 
            schemaname,
            tablename,
            indexname,
            idx_tup_read,
            idx_tup_fetch
          FROM pg_stat_user_indexes
          ORDER BY idx_tup_read DESC
          LIMIT 10
        `,
        
        // Slow queries (if pg_stat_statements is enabled)
        slowQueries: `
          SELECT 
            query,
            calls,
            total_time,
            mean_time,
            rows
          FROM pg_stat_statements
          ORDER BY mean_time DESC
          LIMIT 10
        `,
        
        // Connection stats
        connections: `
          SELECT 
            state,
            count(*) as count
          FROM pg_stat_activity
          WHERE datname = current_database()
          GROUP BY state
        `
      };

      const metrics: any = {};

      for (const [key, query] of Object.entries(queries)) {
        try {
          const result = await this.pool.query(query);
          metrics[key] = result.rows;
        } catch (error: any) {
          // Some queries might fail if extensions aren't installed
          metrics[key] = { error: error.message };
        }
      }

      return metrics;
    } catch (error) {
      console.error('Failed to get performance metrics:', error);
      return { error: 'Failed to retrieve metrics' };
    }
  }

  // Vacuum and reindex for maintenance
  static async performMaintenance(): Promise<void> {
    const tables = [
      'users', 'posts', 'comments', 'likes', 'follows', 
      'blog_posts', 'notifications', 'user_sessions'
    ];

    console.log('🔧 Performing database maintenance...');

    for (const table of tables) {
      try {
        // Vacuum to reclaim space and update statistics
        await this.pool.query(`VACUUM ANALYZE ${table}`);
        console.log(`✅ Vacuumed table: ${table}`);
      } catch (error: any) {
        console.error(`❌ Failed to vacuum table ${table}:`, error.message);
      }
    }

    console.log('✅ Database maintenance completed');
  }
}

// Query performance monitoring
export class QueryMonitor {
  private static slowQueryThreshold = 1000; // 1 second
  private static queryStats = new Map<string, { count: number; totalTime: number; avgTime: number }>();

  static logSlowQuery(query: string, duration: number, params?: any[]) {
    if (duration > this.slowQueryThreshold) {
      console.warn(`[SLOW QUERY] ${duration}ms:`, {
        query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
        duration,
        params: params?.slice(0, 5), // Log first 5 params only
        timestamp: new Date().toISOString()
      });
    }

    // Update statistics
    const existing = this.queryStats.get(query) || { count: 0, totalTime: 0, avgTime: 0 };
    existing.count++;
    existing.totalTime += duration;
    existing.avgTime = existing.totalTime / existing.count;
    this.queryStats.set(query, existing);
  }

  static getQueryStats() {
    return Array.from(this.queryStats.entries())
      .map(([query, stats]) => ({
        query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        ...stats
      }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);
  }

  static clearStats() {
    this.queryStats.clear();
  }
}

// Connection pool monitoring
export class ConnectionPoolMonitor {
  static getPoolStats() {
    const pool = DatabaseConnection.getPool();
    
    return {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
      maxConnections: pool.options.max || 10,
      connectionUtilization: ((pool.totalCount - pool.idleCount) / (pool.options.max || 10)) * 100
    };
  }

  static logPoolStats() {
    const stats = this.getPoolStats();
    
    if (stats.connectionUtilization > 80) {
      console.warn('[CONNECTION POOL] High utilization:', stats);
    }
    
    return stats;
  }
}