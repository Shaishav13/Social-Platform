import { Notification, NotificationPreferences, NotificationCreateRequest } from '../../services/notification/types';

// In-memory storage for notifications and preferences
let notifications: Notification[] = [];
let preferences: NotificationPreferences[] = [];
let notificationIdCounter = 1;
let preferencesIdCounter = 1;

export class MockNotificationModel {
  static async createNotification(notificationData: NotificationCreateRequest): Promise<Notification> {
    // Check if user has preferences that would block this notification
    const userPreferences = await this.getUserPreferences(notificationData.userId);
    
    if (!this.shouldSendNotification(notificationData.type, userPreferences)) {
      throw new Error(`User has disabled ${notificationData.type} notifications`);
    }

    const notification: Notification = {
      id: `notification_${notificationIdCounter++}`,
      userId: notificationData.userId,
      type: notificationData.type,
      actorId: notificationData.actorId,
      targetId: notificationData.targetId,
      message: notificationData.message,
      isRead: false,
      createdAt: new Date(),
    };

    notifications.push(notification);
    return notification;
  }

  static async getUserNotifications(userId: string, limit: number = 50, offset: number = 0): Promise<Notification[]> {
    const userNotifications = notifications
      .filter(n => n.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit);

    return userNotifications;
  }

  static async getUnreadCount(userId: string): Promise<number> {
    return notifications.filter(n => n.userId === userId && !n.isRead).length;
  }

  static async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const notification = notifications.find(n => n.id === notificationId && n.userId === userId);
    if (notification) {
      notification.isRead = true;
      return true;
    }
    return false;
  }

  static async markAllAsRead(userId: string): Promise<void> {
    notifications
      .filter(n => n.userId === userId)
      .forEach(n => n.isRead = true);
  }

  static async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    const index = notifications.findIndex(n => n.id === notificationId && n.userId === userId);
    if (index !== -1) {
      notifications.splice(index, 1);
      return true;
    }
    return false;
  }

  static async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    let userPreferences = preferences.find(p => p.userId === userId);
    
    // If no preferences exist, create default ones
    if (!userPreferences) {
      userPreferences = await this.createDefaultPreferences(userId);
    }
    
    return userPreferences;
  }

  static async updateUserPreferences(userId: string, updates: Partial<Omit<NotificationPreferences, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<NotificationPreferences> {
    let userPreferences = preferences.find(p => p.userId === userId);
    
    if (!userPreferences) {
      userPreferences = await this.createDefaultPreferences(userId);
    }

    // Update preferences
    Object.assign(userPreferences, updates, { updatedAt: new Date() });
    
    return userPreferences;
  }

  private static async createDefaultPreferences(userId: string): Promise<NotificationPreferences> {
    const defaultPreferences: NotificationPreferences = {
      id: `preferences_${preferencesIdCounter++}`,
      userId,
      enableLikes: true,
      enableComments: true,
      enableFollows: true,
      enableShares: true,
      enableMentions: true,
      emailNotifications: false,
      pushNotifications: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    preferences.push(defaultPreferences);
    return defaultPreferences;
  }

  private static shouldSendNotification(type: Notification['type'], userPreferences: NotificationPreferences): boolean {
    switch (type) {
      case 'like':
        return userPreferences.enableLikes;
      case 'comment':
        return userPreferences.enableComments;
      case 'follow':
        return userPreferences.enableFollows;
      case 'share':
        return userPreferences.enableShares;
      case 'mention':
        return userPreferences.enableMentions;
      default:
        return true;
    }
  }

  static async createBulkNotifications(notificationRequests: NotificationCreateRequest[]): Promise<Notification[]> {
    const validNotifications: NotificationCreateRequest[] = [];
    
    // Filter notifications based on user preferences
    for (const notification of notificationRequests) {
      const userPreferences = await this.getUserPreferences(notification.userId);
      if (this.shouldSendNotification(notification.type, userPreferences)) {
        validNotifications.push(notification);
      }
    }

    if (validNotifications.length === 0) {
      return [];
    }

    const createdNotifications: Notification[] = [];
    for (const notificationData of validNotifications) {
      const notification = await this.createNotification(notificationData);
      createdNotifications.push(notification);
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

  // Reset function for tests
  static reset(): void {
    notifications = [];
    preferences = [];
    notificationIdCounter = 1;
    preferencesIdCounter = 1;
  }
}