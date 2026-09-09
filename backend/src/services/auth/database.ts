import { DatabaseConnection } from '../../config/database';
import { User, Session, EmailVerificationRecord } from './types';

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
        role VARCHAR(20) DEFAULT 'user',
        is_restricted BOOLEAN DEFAULT false,
        is_verified BOOLEAN DEFAULT false,
        email_verified_at TIMESTAMP WITH TIME ZONE,
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

    const createPasswordResetTable = `
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createEmailVerificationsTable = `
      CREATE TABLE IF NOT EXISTS email_verifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        max_attempts INT NOT NULL DEFAULT 5,
        last_sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_email_verif_user_id ON email_verifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_email_verif_email ON email_verifications(email);
      CREATE INDEX IF NOT EXISTS idx_email_verif_expires ON email_verifications(expires_at);
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

    // Schema alterations for existing databases
    const alterUsersTable = `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE;
    `;

    await DatabaseConnection.query(createUsersTable);
    await DatabaseConnection.query(alterUsersTable);
    await DatabaseConnection.query(createSessionsTable);
    await DatabaseConnection.query(createPasswordResetTable);
    await DatabaseConnection.query(createEmailVerificationsTable);
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
      role: row.role || 'user',
      isRestricted: Boolean(row.is_restricted),
      isVerified: Boolean(row.is_verified),
      emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at) : null,
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
      role: row.role || 'user',
      isRestricted: Boolean(row.is_restricted),
      isVerified: Boolean(row.is_verified),
      emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at) : null,
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
      role: row.role || 'user',
      isRestricted: Boolean(row.is_restricted),
      isVerified: Boolean(row.is_verified),
      emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const result = await DatabaseConnection.query(
      `INSERT INTO users (username, email, password_hash, profile_picture, bio, is_private, role, is_restricted, is_verified, email_verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        userData.username,
        userData.email,
        userData.passwordHash,
        userData.profilePicture,
        userData.bio,
        userData.isPrivate,
        userData.role || 'user',
        userData.isRestricted || false,
        userData.isVerified || false,
        userData.emailVerifiedAt || null,
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
      role: row.role || 'user',
      isRestricted: Boolean(row.is_restricted),
      isVerified: Boolean(row.is_verified),
      emailVerifiedAt: row.email_verified_at ? new Date(row.email_verified_at) : null,
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

  // ── Password Reset ──────────────────────────────────────────────────────────

  static async createPasswordResetToken(userId: string, token: string): Promise<void> {
    // Delete any existing tokens for this user first
    await DatabaseConnection.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1',
      [userId]
    );
    // Token expires in 1 hour
    await DatabaseConnection.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '1 hour')`,
      [userId, token]
    );
  }

  static async findPasswordResetToken(token: string): Promise<{ userId: string; used: boolean } | null> {
    const result = await DatabaseConnection.query(
      `SELECT user_id, used FROM password_reset_tokens
       WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [token]
    ) as any;

    if (result.rows.length === 0) return null;
    return { userId: result.rows[0].user_id, used: result.rows[0].used };
  }

  static async markPasswordResetTokenUsed(token: string): Promise<void> {
    await DatabaseConnection.query(
      'UPDATE password_reset_tokens SET used = true WHERE token = $1',
      [token]
    );
  }

  static async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    await DatabaseConnection.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, userId]
    );
  }

  // ── Email Verification ──────────────────────────────────────────────────────

  static async createOrUpdateEmailVerification(
    userId: string,
    email: string,
    otpHash: string,
    expiresAt: Date
  ): Promise<EmailVerificationRecord> {
    // Delete any existing verification records for this user / email
    await DatabaseConnection.query(
      'DELETE FROM email_verifications WHERE user_id = $1 OR email = $2',
      [userId, email.toLowerCase()]
    );

    const result = await DatabaseConnection.query(
      `INSERT INTO email_verifications (user_id, email, otp_hash, expires_at, attempts, max_attempts, last_sent_at)
       VALUES ($1, $2, $3, $4, 0, 5, CURRENT_TIMESTAMP)
       RETURNING *`,
      [userId, email.toLowerCase(), otpHash, expiresAt]
    ) as any;

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      email: row.email,
      otpHash: row.otp_hash,
      expiresAt: new Date(row.expires_at),
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      lastSentAt: new Date(row.last_sent_at),
      createdAt: new Date(row.created_at),
    };
  }

  static async findActiveEmailVerification(email: string): Promise<EmailVerificationRecord | null> {
    const result = await DatabaseConnection.query(
      `SELECT * FROM email_verifications 
       WHERE email = $1 AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC LIMIT 1`,
      [email.toLowerCase()]
    ) as any;

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      email: row.email,
      otpHash: row.otp_hash,
      expiresAt: new Date(row.expires_at),
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      lastSentAt: new Date(row.last_sent_at),
      createdAt: new Date(row.created_at),
    };
  }

  static async incrementVerificationAttempts(id: string): Promise<number> {
    const result = await DatabaseConnection.query(
      `UPDATE email_verifications 
       SET attempts = attempts + 1 
       WHERE id = $1 
       RETURNING attempts`,
      [id]
    ) as any;

    if (result.rows.length === 0) return 0;
    return result.rows[0].attempts;
  }

  static async deleteEmailVerification(id: string): Promise<void> {
    await DatabaseConnection.query(
      'DELETE FROM email_verifications WHERE id = $1',
      [id]
    );
  }

  static async markUserVerified(userId: string): Promise<void> {
    await DatabaseConnection.query(
      'UPDATE users SET is_verified = true, email_verified_at = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );
  }
}