import { DatabaseConnection } from '../../config/database';
import { Notification, NotificationPreferences, NotificationCreateRequest } from './types';

export class NotificationDatabase {
  static async createTables(): Promise<void> {
    const createNotificationsTable = `
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'share', 'mention')),
        actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_id UUID NOT NULL,
        post_id UUID,
        metadata TEXT,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS post_id UUID;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata TEXT;
    `;

    const createNotificationPreferencesTable = `
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        enable_likes BOOLEAN DEFAULT true,
        enable_comments BOOLEAN DEFAULT true,
        enable_follows BOOLEAN DEFAULT true,
        enable_shares BOOLEAN DEFAULT true,
        enable_mentions BOOLEAN DEFAULT true,
        email_notifications BOOLEAN DEFAULT false,
        push_notifications BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_actor_id ON notifications(actor_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_target_id ON notifications(target_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_post_id ON notifications(post_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
      CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
      CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
    `;

    const createUpdatedAtTrigger = `
      DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON notification_preferences;
      CREATE TRIGGER update_notification_preferences_updated_at
        BEFORE UPDATE ON notification_preferences
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `;

    await DatabaseConnection.query(createNotificationsTable);
    await DatabaseConnection.query(createNotificationPreferencesTable);
    await DatabaseConnection.query(createIndexes);
    await DatabaseConnection.query(createUpdatedAtTrigger);
  }

  static async createNotification(notificationData: NotificationCreateRequest): Promise<Notification> {
    const result = await DatabaseConnection.query(
      `INSERT INTO notifications (user_id, type, actor_id, target_id, post_id, metadata, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        notificationData.userId,
        notificationData.type,
        notificationData.actorId,
        notificationData.targetId,
        notificationData.postId || null,
        notificationData.metadata || null,
        notificationData.message,
      ]
    ) as any;

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      actorId: row.actor_id,
      targetId: row.target_id,
      postId: row.post_id,
      metadata: row.metadata,
      message: row.message,
      isRead: row.is_read,
      createdAt: row.created_at,
    };
  }

  static async createBulkNotifications(notifications: NotificationCreateRequest[]): Promise<Notification[]> {
    if (notifications.length === 0) {
      return [];
    }

    const values: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    notifications.forEach((notification) => {
      values.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6})`);
      params.push(
        notification.userId,
        notification.type,
        notification.actorId,
        notification.targetId,
        notification.postId || null,
        notification.metadata || null,
        notification.message
      );
      paramIndex += 7;
    });

    const result = await DatabaseConnection.query(
      `INSERT INTO notifications (user_id, type, actor_id, target_id, post_id, metadata, message)
       VALUES ${values.join(', ')}
       RETURNING *`,
      params
    ) as any;

    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      actorId: row.actor_id,
      targetId: row.target_id,
      postId: row.post_id,
      metadata: row.metadata,
      message: row.message,
      isRead: row.is_read,
      createdAt: row.created_at,
    }));
  }

  static async getUserNotifications(userId: string, limit: number = 50, offset: number = 0): Promise<Notification[]> {
    const result = await DatabaseConnection.query(
      `SELECT n.*, 
              u.username as actor_username,
              u.profile_picture as actor_profile_picture
       FROM notifications n
       LEFT JOIN users u ON n.actor_id = u.id
       WHERE n.user_id = $1 
       ORDER BY n.created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    ) as any;

    return result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      actorId: row.actor_id,
      targetId: row.target_id,
      postId: row.post_id,
      metadata: row.metadata,
      message: row.message,
      isRead: row.is_read,
      createdAt: row.created_at,
      actor: row.actor_username ? {
        id: row.actor_id,
        username: row.actor_username,
        profilePicture: row.actor_profile_picture
      } : undefined
    }));
  }

  static async getUnreadCount(userId: string): Promise<number> {
    const result = await DatabaseConnection.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    ) as any;

    return parseInt(result.rows[0].count, 10);
  }

  static async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const result = await DatabaseConnection.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING id',
      [notificationId, userId]
    ) as any;

    return result.rows.length > 0;
  }

  static async markAllAsRead(userId: string): Promise<void> {
    await DatabaseConnection.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [userId]
    );
  }

  static async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    const result = await DatabaseConnection.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
      [notificationId, userId]
    ) as any;

    return result.rows.length > 0;
  }

  static async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    const result = await DatabaseConnection.query(
      'SELECT * FROM notification_preferences WHERE user_id = $1',
      [userId]
    ) as any;

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      enableLikes: row.enable_likes,
      enableComments: row.enable_comments,
      enableFollows: row.enable_follows,
      enableShares: row.enable_shares,
      enableMentions: row.enable_mentions,
      emailNotifications: row.email_notifications,
      pushNotifications: row.push_notifications,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async createUserPreferences(preferencesData: Omit<NotificationPreferences, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationPreferences> {
    const result = await DatabaseConnection.query(
      `INSERT INTO notification_preferences 
       (user_id, enable_likes, enable_comments, enable_follows, enable_shares, enable_mentions, email_notifications, push_notifications)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        preferencesData.userId,
        preferencesData.enableLikes,
        preferencesData.enableComments,
        preferencesData.enableFollows,
        preferencesData.enableShares,
        preferencesData.enableMentions,
        preferencesData.emailNotifications,
        preferencesData.pushNotifications,
      ]
    ) as any;

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      enableLikes: row.enable_likes,
      enableComments: row.enable_comments,
      enableFollows: row.enable_follows,
      enableShares: row.enable_shares,
      enableMentions: row.enable_mentions,
      emailNotifications: row.email_notifications,
      pushNotifications: row.push_notifications,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async updateUserPreferences(userId: string, updateData: Partial<Omit<NotificationPreferences, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<NotificationPreferences> {
    const updates: string[] = [];
    const values: any[] = [userId];
    let paramCount = 1;

    if (updateData.enableLikes !== undefined) {
      updates.push(`enable_likes = $${++paramCount}`);
      values.push(updateData.enableLikes);
    }

    if (updateData.enableComments !== undefined) {
      updates.push(`enable_comments = $${++paramCount}`);
      values.push(updateData.enableComments);
    }

    if (updateData.enableFollows !== undefined) {
      updates.push(`enable_follows = $${++paramCount}`);
      values.push(updateData.enableFollows);
    }

    if (updateData.enableShares !== undefined) {
      updates.push(`enable_shares = $${++paramCount}`);
      values.push(updateData.enableShares);
    }

    if (updateData.enableMentions !== undefined) {
      updates.push(`enable_mentions = $${++paramCount}`);
      values.push(updateData.enableMentions);
    }

    if (updateData.emailNotifications !== undefined) {
      updates.push(`email_notifications = $${++paramCount}`);
      values.push(updateData.emailNotifications);
    }

    if (updateData.pushNotifications !== undefined) {
      updates.push(`push_notifications = $${++paramCount}`);
      values.push(updateData.pushNotifications);
    }

    if (updates.length === 0) {
      const existing = await this.getUserPreferences(userId);
      if (!existing) {
        throw new Error('User preferences not found');
      }
      return existing;
    }

    const result = await DatabaseConnection.query(
      `UPDATE notification_preferences SET ${updates.join(', ')} WHERE user_id = $1 RETURNING *`,
      values
    ) as any;

    if (result.rows.length === 0) {
      throw new Error('User preferences not found');
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      enableLikes: row.enable_likes,
      enableComments: row.enable_comments,
      enableFollows: row.enable_follows,
      enableShares: row.enable_shares,
      enableMentions: row.enable_mentions,
      emailNotifications: row.email_notifications,
      pushNotifications: row.push_notifications,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  static async cleanupOldNotifications(daysOld: number = 30): Promise<void> {
    await DatabaseConnection.query(
      'DELETE FROM notifications WHERE created_at < CURRENT_TIMESTAMP - INTERVAL $1 DAY',
      [daysOld]
    );
  }

  // Data deletion methods
  static async deleteUserNotifications(userId: string): Promise<void> {
    await DatabaseConnection.query(
      'DELETE FROM notifications WHERE user_id = $1 OR actor_id = $1',
      [userId]
    );
  }
}