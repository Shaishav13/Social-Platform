export interface Notification {
  id: string;
  userId: string;
  type: 'like' | 'comment' | 'follow' | 'follow_request' | 'follow_accepted' | 'share' | 'mention';
  actorId: string; // User who performed the action
  targetId: string; // Post, Comment, or User ID
  postId?: string; // Post ID for better navigation (for comments, mentions)
  metadata?: string; // JSON string for additional context
  message: string;
  isRead: boolean;
  createdAt: Date;
  actor?: {
    id: string;
    username: string;
    profilePicture?: string;
  };
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
  postId?: string;
  metadata?: string;
  message: string;
}