import { DatabaseConnection } from '../../config/database';
import { RedisConnection } from '../../config/redis';
import bcrypt from 'bcrypt';

export interface AdminUserRecord {
  id: string;
  username: string;
  email: string;
  profilePicture?: string;
  bio?: string;
  isPrivate: boolean;
  role: 'admin' | 'moderator' | 'user';
  isRestricted: boolean;
  postCount?: number;
  followerCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformFeatures {
  publicRegistration: boolean;
  mediaUploads: boolean;
  commenting: boolean;
  followRequests: boolean;
  maintenanceMode: boolean;
  trendingFeed: boolean;
}

export interface PlatformSettings {
  siteName: string;
  announcementBanner: string;
  defaultDensity: 'comfortable' | 'compact';
  maxPostLength: number;
  rateLimitMaxRequests: number;
}

// In-memory fallback stores
let memoryFeatures: PlatformFeatures = {
  publicRegistration: true,
  mediaUploads: true,
  commenting: true,
  followRequests: true,
  maintenanceMode: false,
  trendingFeed: true,
};

let memorySettings: PlatformSettings = {
  siteName: 'UdtaBirdie',
  announcementBanner: '',
  defaultDensity: 'comfortable',
  maxPostLength: 2000,
  rateLimitMaxRequests: 100,
};

export class AdminDatabase {
  static async getStats() {
    const [usersRes, postsRes, commentsRes, reportsRes] = await Promise.all([
      DatabaseConnection.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_restricted = false) as active,
          COUNT(*) FILTER (WHERE is_restricted = true) as restricted,
          COUNT(*) FILTER (WHERE role = 'admin') as admins
        FROM users
      `),
      DatabaseConnection.query(`SELECT COUNT(*) as total FROM posts`),
      DatabaseConnection.query(`SELECT COUNT(*) as total FROM comments`),
      DatabaseConnection.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'pending') as pending
        FROM reports
      `).catch(() => ({ rows: [{ total: 0, pending: 0 }] })),
    ]);

    const usersData = usersRes.rows[0] || { total: 0, active: 0, restricted: 0, admins: 0 };
    const postsData = postsRes.rows[0] || { total: 0 };
    const commentsData = commentsRes.rows[0] || { total: 0 };
    const reportsData = reportsRes.rows[0] || { total: 0, pending: 0 };

    return {
      users: {
        total: parseInt(usersData.total || '0'),
        active: parseInt(usersData.active || '0'),
        restricted: parseInt(usersData.restricted || '0'),
        admins: parseInt(usersData.admins || '0'),
      },
      content: {
        posts: parseInt(postsData.total || '0'),
        comments: parseInt(commentsData.total || '0'),
      },
      moderation: {
        totalReports: parseInt(reportsData.total || '0'),
        pendingReports: parseInt(reportsData.pending || '0'),
      },
      system: {
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
        memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
    };
  }

  static async getUsers(options: {
    search?: string;
    status?: string;
    role?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (options.search && options.search.trim()) {
      conditions.push(`(u.username ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
      values.push(`%${options.search.trim()}%`);
      paramIndex++;
    }

    if (options.status === 'restricted') {
      conditions.push(`u.is_restricted = true`);
    } else if (options.status === 'active') {
      conditions.push(`u.is_restricted = false`);
    }

    if (options.role && options.role !== 'all') {
      conditions.push(`u.role = $${paramIndex}`);
      values.push(options.role);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) as total FROM users u ${whereClause}`;
    const countRes = await DatabaseConnection.query(countQuery, values);
    const total = parseInt(countRes.rows[0]?.total || '0');

    const usersQuery = `
      SELECT 
        u.id, u.username, u.email, u.profile_picture, u.bio, 
        u.is_private, u.role, u.is_restricted, u.created_at, u.updated_at,
        (SELECT COUNT(*) FROM posts WHERE author_id = u.id) as post_count,
        (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as follower_count
      FROM users u
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    values.push(limit, offset);
    const result = await DatabaseConnection.query(usersQuery, values);

    const users: AdminUserRecord[] = result.rows.map((row: any) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      profilePicture: row.profile_picture,
      bio: row.bio,
      isPrivate: row.is_private,
      role: row.role || 'user',
      isRestricted: Boolean(row.is_restricted),
      postCount: parseInt(row.post_count || '0'),
      followerCount: parseInt(row.follower_count || '0'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async createUser(data: {
    username: string;
    email: string;
    password: string;
    role?: 'admin' | 'moderator' | 'user';
    bio?: string;
  }): Promise<AdminUserRecord> {
    const passwordHash = await bcrypt.hash(data.password, 12);
    const res = await DatabaseConnection.query(
      `INSERT INTO users (username, email, password_hash, role, bio, is_restricted)
       VALUES ($1, $2, $3, $4, $5, false)
       RETURNING id, username, email, profile_picture, bio, is_private, role, is_restricted, created_at, updated_at`,
      [
        data.username,
        data.email.toLowerCase(),
        passwordHash,
        data.role || 'user',
        data.bio || '',
      ]
    );

    const row = res.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      profilePicture: row.profile_picture,
      bio: row.bio,
      isPrivate: row.is_private,
      role: row.role || 'user',
      isRestricted: Boolean(row.is_restricted),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async updateUser(
    userId: string,
    data: {
      username?: string;
      email?: string;
      role?: 'admin' | 'moderator' | 'user';
      bio?: string;
    }
  ): Promise<AdminUserRecord | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.username) {
      fields.push(`username = $${idx++}`);
      values.push(data.username);
    }
    if (data.email) {
      fields.push(`email = $${idx++}`);
      values.push(data.email.toLowerCase());
    }
    if (data.role) {
      fields.push(`role = $${idx++}`);
      values.push(data.role);
    }
    if (data.bio !== undefined) {
      fields.push(`bio = $${idx++}`);
      values.push(data.bio);
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const res = await DatabaseConnection.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}
       RETURNING id, username, email, profile_picture, bio, is_private, role, is_restricted, created_at, updated_at`,
      values
    );

    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      profilePicture: row.profile_picture,
      bio: row.bio,
      isPrivate: row.is_private,
      role: row.role || 'user',
      isRestricted: Boolean(row.is_restricted),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async setUserRestriction(userId: string, isRestricted: boolean): Promise<AdminUserRecord | null> {
    const res = await DatabaseConnection.query(
      `UPDATE users SET is_restricted = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
       RETURNING id, username, email, profile_picture, bio, is_private, role, is_restricted, created_at, updated_at`,
      [isRestricted, userId]
    );

    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      profilePicture: row.profile_picture,
      bio: row.bio,
      isPrivate: row.is_private,
      role: row.role || 'user',
      isRestricted: Boolean(row.is_restricted),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async deleteUser(userId: string): Promise<boolean> {
    const res = await DatabaseConnection.query('DELETE FROM users WHERE id = $1', [userId]);
    return (res.rowCount || 0) > 0;
  }

  static async getFeatures(): Promise<PlatformFeatures> {
    try {
      const client = RedisConnection.getClient();
      if (client) {
        const cached = await client.get('platform:features');
        if (cached) {
          return JSON.parse(cached);
        }
      }
    } catch (e) {
      // fallback to in-memory
    }
    return memoryFeatures;
  }

  static async updateFeatures(newFeatures: Partial<PlatformFeatures>): Promise<PlatformFeatures> {
    memoryFeatures = { ...memoryFeatures, ...newFeatures };
    try {
      const client = RedisConnection.getClient();
      if (client) {
        await client.set('platform:features', JSON.stringify(memoryFeatures));
      }
    } catch (e) {
      // ignore redis error
    }
    return memoryFeatures;
  }

  static async getSettings(): Promise<PlatformSettings> {
    try {
      const client = RedisConnection.getClient();
      if (client) {
        const cached = await client.get('platform:settings');
        if (cached) {
          return JSON.parse(cached);
        }
      }
    } catch (e) {
      // fallback
    }
    return memorySettings;
  }

  static async updateSettings(newSettings: Partial<PlatformSettings>): Promise<PlatformSettings> {
    memorySettings = { ...memorySettings, ...newSettings };
    try {
      const client = RedisConnection.getClient();
      if (client) {
        await client.set('platform:settings', JSON.stringify(memorySettings));
      }
    } catch (e) {
      // ignore redis error
    }
    return memorySettings;
  }

  static async getReports() {
    try {
      const res = await DatabaseConnection.query(`
        SELECT 
          r.id, r.reporter_id, r.target_id, r.target_type, r.reason, 
          r.status, r.created_at,
          u.username as reporter_username,
          p.content as target_content
        FROM reports r
        LEFT JOIN users u ON r.reporter_id = u.id
        LEFT JOIN posts p ON r.target_id = p.id AND r.target_type = 'post'
        ORDER BY r.created_at DESC
        LIMIT 50
      `);
      return res.rows;
    } catch (e) {
      return [];
    }
  }

  static async resolveReport(reportId: string, action: 'dismiss' | 'delete_target') {
    if (action === 'delete_target') {
      const reportRes = await DatabaseConnection.query('SELECT target_id, target_type FROM reports WHERE id = $1', [reportId]);
      if (reportRes.rows.length > 0) {
        const { target_id, target_type } = reportRes.rows[0];
        if (target_type === 'post') {
          await DatabaseConnection.query('DELETE FROM posts WHERE id = $1', [target_id]);
        }
      }
    }
    await DatabaseConnection.query("UPDATE reports SET status = 'resolved' WHERE id = $1", [reportId]);
    return true;
  }
}
