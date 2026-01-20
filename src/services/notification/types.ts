export interface Notification {
  id: string;
  userId: string;
  type: 'like' | 'comment' | 'follow' | 'share' | 'mention';
  actorId: string; // User who performed the action
  targetId: string; // Post, Comment, or User ID
  message: string;
  isRead: boolean;
  createdAt: Date;
}

export interface NotificationPreferences {
  id: string;
  userId: string;
  enableLikes: boolean;
  enableComments: boolean;
  enableFollows: boolean;
  enableShares: boolean;
  enableMentions: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationCreateRequest {
  userId: string;
  type: Notification['type'];
  actorId: string;
  targetId: string;
  message: string;
}