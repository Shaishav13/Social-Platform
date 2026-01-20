import { DatabaseConnection } from '../../config/database';
import { User, Session } from './types';

export class AuthDatabase {
  static async createTables(): Promise<void> {
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        profile_picture TEXT,
        bio TEXT,
        is_private BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createSessionsTable = `
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        refresh_token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      );
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    `;

    const createUpdatedAtTrigger = `
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `;

    await DatabaseConnection.query(createUsersTable);
    await DatabaseConnection.query(createSessionsTable);
    await DatabaseConnection.query(createIndexes);
    await DatabaseConnection.query(createUpdatedAtTrigger);
  }

  static async findUserByEmail(email: string): Promise<User | null> {
    const result = await DatabaseConnection.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    ) as any;

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      profilePicture: row.profile_picture,
      bio: row.bio,
      isPrivate: row.is_private,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async findUserByUsername(username: string): Promise<User | null> {
    const result = await DatabaseConnection.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    ) as any;

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      profilePicture: row.profile_picture,
      bio: row.bio,
      isPrivate: row.is_private,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async findUserById(id: string): Promise<User | null> {
    const result = await DatabaseConnection.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    ) as any;

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      profilePicture: row.profile_picture,
      bio: row.bio,
      isPrivate: row.is_private,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const result = await DatabaseConnection.query(
      `INSERT INTO users (username, email, password_hash, profile_picture, bio, is_private)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        userData.username,
        userData.email,
        userData.passwordHash,
        userData.profilePicture,
        userData.bio,
        userData.isPrivate,
      ]
    ) as any;

    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      profilePicture: row.profile_picture,
      bio: row.bio,
      isPrivate: row.is_private,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async createSession(userId: string, refreshToken: string, expiresAt: Date): Promise<Session> {
    const result = await DatabaseConnection.query(
      `INSERT INTO sessions (user_id, refresh_token, expires_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, refreshToken, expiresAt]
    ) as any;

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      refreshToken: row.refresh_token,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      isActive: true, // New sessions are always active
    };
  }

  static async findSessionByRefreshToken(refreshToken: string): Promise<Session | null> {
    const result = await DatabaseConnection.query(
      'SELECT * FROM sessions WHERE refresh_token = $1 AND expires_at > CURRENT_TIMESTAMP',
      [refreshToken]
    ) as any;

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      refreshToken: row.refresh_token,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      isActive: true, // Since we only select non-expired sessions, they're active
    };
  }

  static async invalidateSession(refreshToken: string): Promise<void> {
    await DatabaseConnection.query(
      'DELETE FROM sessions WHERE refresh_token = $1',
      [refreshToken]
    );
  }

  static async invalidateAllUserSessions(userId: string): Promise<void> {
    await DatabaseConnection.query(
      'DELETE FROM sessions WHERE user_id = $1',
      [userId]
    );
  }

  static async updateUser(userId: string, updateData: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'passwordHash'>>): Promise<User | null> {
    const updates: string[] = [];
    const values: any[] = [userId];
    let paramCount = 1;

    if (updateData.username !== undefined) {
      updates.push(`username = $${++paramCount}`);
      values.push(updateData.username);
    }

    if (updateData.email !== undefined) {
      updates.push(`email = $${++paramCount}`);
      values.push(updateData.email);
    }

    if (updateData.profilePicture !== undefined) {
      updates.push(`profile_picture = $${++paramCount}`);
      values.push(updateData.profilePicture);
    }

    if (updateData.bio !== undefined) {
      updates.push(`bio = $${++paramCount}`);
      values.push(updateData.bio);
    }

    if (updateData.isPrivate !== undefined) {
      updates.push(`is_private = $${++paramCount}`);
      values.push(updateData.isPrivate);
    }

    if (updates.length === 0) {
      return this.findUserById(userId);
    }

    const result = await DatabaseConnection.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      values
    ) as any;

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      profilePicture: row.profile_picture,
      bio: row.bio,
      isPrivate: row.is_private,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async cleanupExpiredSessions(): Promise<void> {
    await DatabaseConnection.query(
      'DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP'
    );
  }

  static async deleteUser(userId: string): Promise<void> {
    await DatabaseConnection.query(
      'DELETE FROM users WHERE id = $1',
      [userId]
    );
  }
}