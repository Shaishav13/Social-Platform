import express from 'express';
import { NotificationModel } from './models';
import { authenticateToken } from '../auth/middleware';
import { notificationWebSocketService } from './websocket';

const router = express.Router();

/**
 * GET /notifications - Get user's notifications
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const notifications = await NotificationModel.getUserNotifications(userId, limit, offset);
    const unreadCount = await NotificationModel.getUnreadCount(userId);

    res.json({
      notifications,
      unreadCount,
      pagination: {
        limit,
        offset,
        hasMore: notifications.length === limit
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * GET /notifications/unread-count - Get count of unread notifications
 */
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const unreadCount = await NotificationModel.getUnreadCount(userId);

    res.json({ unreadCount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

/**
 * PUT /notifications/:id/read - Mark notification as read
 */
router.put('/:id/read', authenticateToken, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const notificationId = req.params.id;

    const success = await NotificationModel.markAsRead(notificationId, userId);

    if (!success) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

/**
 * PUT /notifications/read-all - Mark all notifications as read
 */
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;

    await NotificationModel.markAllAsRead(userId);

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

/**
 * DELETE /notifications/:id - Delete a notification
 */
router.delete('/:id', authenticateToken, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const notificationId = req.params.id;

    const success = await NotificationModel.deleteNotification(notificationId, userId);

    if (!success) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

/**
 * GET /notifications/preferences - Get user's notification preferences
 */
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const preferences = await NotificationModel.getUserPreferences(userId);

    res.json(preferences);
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
});

/**
 * PUT /notifications/preferences - Update user's notification preferences
 */
router.put('/preferences', authenticateToken, async (req, res): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const {
      enableLikes,
      enableComments,
      enableFollows,
      enableShares,
      enableMentions,
      emailNotifications,
      pushNotifications
    } = req.body;

    // Validate boolean values
    const updates: any = {};
    if (typeof enableLikes === 'boolean') updates.enableLikes = enableLikes;
    if (typeof enableComments === 'boolean') updates.enableComments = enableComments;
    if (typeof enableFollows === 'boolean') updates.enableFollows = enableFollows;
    if (typeof enableShares === 'boolean') updates.enableShares = enableShares;
    if (typeof enableMentions === 'boolean') updates.enableMentions = enableMentions;
    if (typeof emailNotifications === 'boolean') updates.emailNotifications = emailNotifications;
    if (typeof pushNotifications === 'boolean') updates.pushNotifications = pushNotifications;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No valid preferences provided' });
      return;
    }

    const preferences = await NotificationModel.updateUserPreferences(userId, updates);

    res.json(preferences);
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

/**
 * GET /notifications/websocket/status - Get WebSocket connection status
 */
router.get('/websocket/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const isConnected = notificationWebSocketService.isUserConnected(userId);
    const totalConnections = notificationWebSocketService.getTotalConnectionCount();
    const connectedUsers = notificationWebSocketService.getConnectedUserCount();

    res.json({
      isConnected,
      totalConnections,
      connectedUsers,
      websocketUrl: `/notifications/live`
    });
  } catch (error) {
    console.error('Error getting WebSocket status:', error);
    res.status(500).json({ error: 'Failed to get WebSocket status' });
  }
});

export default router;