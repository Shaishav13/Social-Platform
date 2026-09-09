import { Pool } from 'pg';
import { DatabaseConnection } from '../../config/database';
import { ProfileSettings } from './types';

export class ProfileDatabase {
  private static pool: Pool;

  static async searchUsers(query: string, page: number, limit: number): Promise<{ users: any[]; totalCount: number }> {
    const offset = (page - 1) * limit;
    
    const searchQuery = `
      SELECT 
        u.id,
        u.username,
        u.email,
        u.bio,
        u.profile_picture,
        u.is_private,
        u.created_at,
        u.updated_at
      FROM users u
      WHERE (
        LOWER(u.username) LIKE LOWER('%' || $1 || '%') OR
        LOWER(u.bio) LIKE LOWER('%' || $1 || '%')
      )
      ORDER BY 
        CASE WHEN LOWER(u.username) LIKE LOWER('%' || $1 || '%') THEN 1 ELSE 2 END,
        u.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      WHERE (
        LOWER(u.username) LIKE LOWER('%' || $1 || '%') OR
        LOWER(u.bio) LIKE LOWER('%' || $1 || '%')
      )
    `;

    const [searchResult, countResult] = await Promise.all([
      DatabaseConnection.query(searchQuery, [query, limit, offset]),
      DatabaseConnection.query(countQuery, [query])
    ]);

    const users = searchResult.rows.map((row: any) => ({
      id: row.id,
      username: row.username,
      bio: row.bio,
      profilePicture: row.profile_picture,
      isPrivate: row.is_private,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    const totalCount = parseInt(countResult.rows[0].total);

    return { users, totalCount };
  }

  static async initialize(): Promise<void> {
    this.pool = DatabaseConnection.getPool();
    await this.createTables();
  }

  private static async createTables(): Promise<void> {
    const createProfileSettingsTable = `
      CREATE TABLE IF NOT EXISTS profile_settings (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        is_private BOOLEAN DEFAULT false,
        show_email BOOLEAN DEFAULT false,
        show_followers BOOLEAN DEFAULT true,
        allow_direct_messages BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createUpdateTrigger = `
      CREATE OR REPLACE FUNCTION update_profile_settings_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_profile_settings_updated_at ON profile_settings;
      CREATE TRIGGER update_profile_settings_updated_at
        BEFORE UPDATE ON profile_settings
        FOR EACH ROW
        EXECUTE FUNCTION update_profile_settings_updated_at();
    `;

    await this.pool.query(createProfileSettingsTable);
    await this.pool.query(createUpdateTrigger);
  }

  static async getProfileSettings(userId: string): Promise<ProfileSettings> {
    const query = `
      SELECT is_private, show_email, show_followers, allow_direct_messages
      FROM profile_settings
      WHERE user_id = $1
    `;

    const result = await this.pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      // Create default settings if they don't exist
      return this.createDefaultProfileSettings(userId);
    }

    const row = result.rows[0];
    return {
      isPrivate: row.is_private,
      showEmail: row.show_email,
      showFollowers: row.show_followers,
      allowDirectMessages: row.allow_direct_messages,
    };
  }

  static async createDefaultProfileSettings(userId: string): Promise<ProfileSettings> {
    const defaultSettings: ProfileSettings = {
      isPrivate: false,
      showEmail: false,
      showFollowers: true,
      allowDirectMessages: true,
    };

    const query = `
      INSERT INTO profile_settings (user_id, is_private, show_email, show_followers, allow_direct_messages)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) DO NOTHING
      RETURNING is_private, show_email, show_followers, allow_direct_messages
    `;

    await this.pool.query(query, [
      userId,
      defaultSettings.isPrivate,
      defaultSettings.showEmail,
      defaultSettings.showFollowers,
      defaultSettings.allowDirectMessages,
    ]);

    return defaultSettings;
  }

  static async updateProfileSettings(userId: string, settings: Partial<ProfileSettings>): Promise<ProfileSettings> {
    // First ensure settings exist
    await this.getProfileSettings(userId);

    const updates: string[] = [];
    const values: any[] = [userId];
    let paramCount = 1;

    if (settings.isPrivate !== undefined) {
      updates.push(`is_private = $${++paramCount}`);
      values.push(settings.isPrivate);
    }

    if (settings.showEmail !== undefined) {
      updates.push(`show_email = $${++paramCount}`);
      values.push(settings.showEmail);
    }

    if (settings.showFollowers !== undefined) {
      updates.push(`show_followers = $${++paramCount}`);
      values.push(settings.showFollowers);
    }

    if (settings.allowDirectMessages !== undefined) {
      updates.push(`allow_direct_messages = $${++paramCount}`);
      values.push(settings.allowDirectMessages);
    }

    if (updates.length === 0) {
      return this.getProfileSettings(userId);
    }

    const query = `
      UPDATE profile_settings
      SET ${updates.join(', ')}
      WHERE user_id = $1
      RETURNING is_private, show_email, show_followers, allow_direct_messages
    `;

    const result = await this.pool.query(query, values);
    const row = result.rows[0];

    return {
      isPrivate: row.is_private,
      showEmail: row.show_email,
      showFollowers: row.show_followers,
      allowDirectMessages: row.allow_direct_messages,
    };
  }

  // Data deletion methods
  static async deleteUserProfile(userId: string): Promise<void> {
    await DatabaseConnection.query(
      'DELETE FROM profile_settings WHERE user_id = $1',
      [userId]
    );
  }
}