import { Notification, NotificationPreferences, NotificationCreateRequest } from './types';
import { NotificationDatabase } from './database';
import { notificationWebSocketService } from './websocket';

export class NotificationModel {
  static async createNotification(notificationData: NotificationCreateRequest): Promise<Notification> {
    // Check if user has preferences that would block this notification
    const preferences = await this.getUserPreferences(notificationData.userId);
    
    if (!this.shouldSendNotification(notificationData.type, preferences)) {
      throw new Error(`User has disabled ${notificationData.type} notifications`);
    }

    const notification = await NotificationDatabase.createNotification(notificationData);

    // Send real-time notification via WebSocket
    try {
      notificationWebSocketService.sendNotificationToUser(notification.userId, notification);
      
      // Also send updated unread count
      const unreadCount = await this.getUnreadCount(notification.userId);
      notificationWebSocketService.sendUnreadCountUpdate(notification.userId, unreadCount);
    } catch (error) {
      console.error('Failed to send real-time notification:', error);
      // Don't throw error - notification was still created in database
    }

    return notification;
  }

  static async getUserNotifications(userId: string, limit: number = 50, offset: number = 0): Promise<Notification[]> {
    return NotificationDatabase.getUserNotifications(userId, limit, offset);
  }

  static async getUnreadCount(userId: string): Promise<number> {
    return NotificationDatabase.getUnreadCount(userId);
  }

  static async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const success = await NotificationDatabase.markAsRead(notificationId, userId);
    
    if (success) {
      // Send updated unread count via WebSocket
      try {
        const unreadCount = await this.getUnreadCount(userId);
        notificationWebSocketService.sendUnreadCountUpdate(userId, unreadCount);
      } catch (error) {
        console.error('Failed to send unread count update:', error);
      }
    }
    
    return success;
  }

  static async markAllAsRead(userId: string): Promise<void> {
    await NotificationDatabase.markAllAsRead(userId);
    
    // Send updated unread count (should be 0) via WebSocket
    try {
      notificationWebSocketService.sendUnreadCountUpdate(userId, 0);
    } catch (error) {
      console.error('Failed to send unread count update:', error);
    }
  }

  static async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    return NotificationDatabase.deleteNotification(notificationId, userId);
  }

  static async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    let preferences = await NotificationDatabase.getUserPreferences(userId);
    
    // If no preferences exist, create default ones
    if (!preferences) {
      preferences = await this.createDefaultPreferences(userId);
    }
    
    return preferences;
  }

  static async updateUserPreferences(userId: string, preferences: Partial<Omit<NotificationPreferences, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<NotificationPreferences> {
    return NotificationDatabase.updateUserPreferences(userId, preferences);
  }

  private static async createDefaultPreferences(userId: string): Promise<NotificationPreferences> {
    const defaultPreferences = {
      userId,
      enableLikes: true,
      enableComments: true,
      enableFollows: true,
      enableShares: true,
      enableMentions: true,
      emailNotifications: false,
      pushNotifications: true,
    };

    return NotificationDatabase.createUserPreferences(defaultPreferences);
  }

  private static shouldSendNotification(type: Notification['type'], preferences: NotificationPreferences): boolean {
    switch (type) {
      case 'like':
        return preferences.enableLikes;
      case 'comment':
        return preferences.enableComments;
      case 'follow':
        return preferences.enableFollows;
      case 'share':
        return preferences.enableShares;
      case 'mention':
        return preferences.enableMentions;
      default:
        return true;
    }
  }

  static async createBulkNotifications(notifications: NotificationCreateRequest[]): Promise<Notification[]> {
    const validNotifications: NotificationCreateRequest[] = [];
    
    // Filter notifications based on user preferences
    for (const notification of notifications) {
      const preferences = await this.getUserPreferences(notification.userId);
      if (this.shouldSendNotification(notification.type, preferences)) {
        validNotifications.push(notification);
      }
    }

    if (validNotifications.length === 0) {
      return [];
    }

    const createdNotifications = await NotificationDatabase.createBulkNotifications(validNotifications);

    // Send real-time notifications via WebSocket
    try {
      for (const notification of createdNotifications) {
        notificationWebSocketService.sendNotificationToUser(notification.userId, notification);
        
        // Also send updated unread count
        const unreadCount = await this.getUnreadCount(notification.userId);
        notificationWebSocketService.sendUnreadCountUpdate(notification.userId, unreadCount);
      }
    } catch (error) {
      console.error('Failed to send real-time notifications:', error);
      // Don't throw error - notifications were still created in database
    }

    return createdNotifications;
  }

  static detectMentions(content: string): string[] {
    // Regex to match @username patterns
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      if (match[1]) {
        mentions.push(match[1]); // Extract username without @
      }
    }

    // Remove duplicates
    return [...new Set(mentions)];
  }

  static generateNotificationMessage(type: Notification['type'], actorUsername: string, targetType?: string): string {
    switch (type) {
      case 'like':
        return `${actorUsername} liked your ${targetType || 'post'}`;
      case 'comment':
        return `${actorUsername} commented on your ${targetType || 'post'}`;
      case 'follow':
        return `${actorUsername} started following you`;
      case 'share':
        return `${actorUsername} shared your ${targetType || 'post'}`;
      case 'mention':
        return `${actorUsername} mentioned you in a ${targetType || 'post'}`;
      default:
        return `${actorUsername} interacted with your content`;
    }
  }
}