import { NotificationModel } from './models';
import { NotificationCreateRequest } from './types';
import { AuthDatabase } from '../auth/database';

export class NotificationEventHandlers {
  /**
   * Handle like events - create notification for post owner
   */
  static async handleLikeEvent(postId: string, postOwnerId: string, actorId: string): Promise<void> {
    // Don't notify if user likes their own post
    if (postOwnerId === actorId) {
      return;
    }

    const actor = await AuthDatabase.findUserById(actorId);
    if (!actor) {
      return;
    }

    const message = NotificationModel.generateNotificationMessage('like', actor.username, 'post');

    const notificationData: NotificationCreateRequest = {
      userId: postOwnerId,
      type: 'like',
      actorId,
      targetId: postId,
      postId: postId,
      message,
    };

    try {
      await NotificationModel.createNotification(notificationData);
    } catch (error) {
      // User may have disabled like notifications - this is expected
      console.log(`Notification not sent: ${error}`);
    }
  }

  /**
   * Handle comment events - create notification for post owner
   */
  static async handleCommentEvent(postId: string, postOwnerId: string, actorId: string, commentId: string): Promise<void> {
    // Don't notify if user comments on their own post
    if (postOwnerId === actorId) {
      return;
    }

    const actor = await AuthDatabase.findUserById(actorId);
    if (!actor) {
      return;
    }

    const message = NotificationModel.generateNotificationMessage('comment', actor.username, 'post');

    const notificationData: NotificationCreateRequest = {
      userId: postOwnerId,
      type: 'comment',
      actorId,
      targetId: commentId, // Use comment ID as target
      postId: postId, // Include post ID for navigation
      message,
    };

    try {
      await NotificationModel.createNotification(notificationData);
    } catch (error) {
      console.log(`Notification not sent: ${error}`);
    }
  }

  /**
   * Handle follow events - create notification for followed user (for public accounts)
   */
  static async handleFollowEvent(followedUserId: string, followerUserId: string): Promise<void> {
    const follower = await AuthDatabase.findUserById(followerUserId);
    if (!follower) {
      return;
    }

    const message = NotificationModel.generateNotificationMessage('follow', follower.username);

    const notificationData: NotificationCreateRequest = {
      userId: followedUserId,
      type: 'follow',
      actorId: followerUserId,
      targetId: followedUserId, // Target is the followed user
      message,
    };

    try {
      await NotificationModel.createNotification(notificationData);
    } catch (error) {
      console.log(`Notification not sent: ${error}`);
    }
  }
  static async handleFollowRequestEvent(targetUserId: string, requesterUserId: string): Promise<void> {
    const requester = await AuthDatabase.findUserById(requesterUserId);
    if (!requester) {
      return;
    }

    const message = NotificationModel.generateNotificationMessage('follow_request', requester.username);

    const notificationData: NotificationCreateRequest = {
      userId: targetUserId,
      type: 'follow_request',
      actorId: requesterUserId,
      targetId: targetUserId, // Target is the user who received the request
      message,
    };

    try {
      await NotificationModel.createNotification(notificationData);
    } catch (error) {
      console.log(`Notification not sent: ${error}`);
    }
  }

  /**
   * Handle follow request accepted events - create notification for requester
   */
  static async handleFollowAcceptedEvent(requesterUserId: string, targetUserId: string): Promise<void> {
    const targetUser = await AuthDatabase.findUserById(targetUserId);
    if (!targetUser) {
      return;
    }

    const message = NotificationModel.generateNotificationMessage('follow_accepted', targetUser.username);

    const notificationData: NotificationCreateRequest = {
      userId: requesterUserId,
      type: 'follow_accepted',
      actorId: targetUserId,
      targetId: requesterUserId, // Target is the requester who gets notified
      message,
    };

    try {
      await NotificationModel.createNotification(notificationData);
    } catch (error) {
      console.log(`Notification not sent: ${error}`);
    }
  }

  /**
   * Handle share events - create notification for post owner
   */
  static async handleShareEvent(postId: string, postOwnerId: string, actorId: string): Promise<void> {
    // Don't notify if user shares their own post
    if (postOwnerId === actorId) {
      return;
    }

    const actor = await AuthDatabase.findUserById(actorId);
    if (!actor) {
      return;
    }

    const message = NotificationModel.generateNotificationMessage('share', actor.username, 'post');

    const notificationData: NotificationCreateRequest = {
      userId: postOwnerId,
      type: 'share',
      actorId,
      targetId: postId,
      postId: postId,
      message,
    };

    try {
      await NotificationModel.createNotification(notificationData);
    } catch (error) {
      console.log(`Notification not sent: ${error}`);
    }
  }

  /**
   * Handle mention events - create notifications for mentioned users
   */
  static async handleMentionEvent(content: string, actorId: string, targetId: string, postId: string, targetType: 'post' | 'comment' = 'post'): Promise<void> {
    const mentions = NotificationModel.detectMentions(content);
    if (mentions.length === 0) {
      return;
    }

    const actor = await AuthDatabase.findUserById(actorId);
    if (!actor) {
      return;
    }

    const notifications: NotificationCreateRequest[] = [];

    // Find users by username and create notifications
    for (const username of mentions) {
      const mentionedUser = await AuthDatabase.findUserByUsername(username);
      if (mentionedUser && mentionedUser.id !== actorId) {
        const message = NotificationModel.generateNotificationMessage('mention', actor.username, targetType);

        notifications.push({
          userId: mentionedUser.id,
          type: 'mention',
          actorId,
          targetId,
          postId: postId,
          message,
        });
      }
    }

    if (notifications.length > 0) {
      try {
        await NotificationModel.createBulkNotifications(notifications);
      } catch (error) {
        console.log(`Some mention notifications not sent: ${error}`);
      }
    }
  }

  /**
   * Handle blog comment events - create notification for blog owner
   */
  static async handleBlogCommentEvent(blogId: string, blogOwnerId: string, actorId: string, commentId: string): Promise<void> {
    // Don't notify if user comments on their own blog
    if (blogOwnerId === actorId) {
      return;
    }

    const actor = await AuthDatabase.findUserById(actorId);
    if (!actor) {
      return;
    }

    const message = NotificationModel.generateNotificationMessage('comment', actor.username, 'blog');

    const notificationData: NotificationCreateRequest = {
      userId: blogOwnerId,
      type: 'comment',
      actorId,
      targetId: commentId,
      message,
    };

    try {
      await NotificationModel.createNotification(notificationData);
    } catch (error) {
      console.log(`Notification not sent: ${error}`);
    }
  }
}