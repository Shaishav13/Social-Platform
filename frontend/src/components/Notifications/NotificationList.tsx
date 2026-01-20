import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Notification } from '../../types';
import api from '../../services/api';

const NotificationList: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      const notificationData = response.data.data || [];
      setNotifications(notificationData);
      setUnreadCount(notificationData.filter((n: Notification) => !n.isRead).length);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await api.put(`/notifications/${notificationId}/read`);
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, isRead: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'like': return '❤️';
      case 'comment': return '💬';
      case 'follow': return '👤';
      case 'share': return '🔗';
      case 'mention': return '@';
      default: return '🔔';
    }
  };

  const getNotificationLink = (notification: Notification) => {
    switch (notification.type) {
      case 'like':
      case 'comment':
      case 'share':
        return `/post/${notification.targetId}`;
      case 'follow':
        return `/profile/${notification.actorId}`;
      case 'mention':
        return `/post/${notification.targetId}`;
      default:
        return '#';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return '1 day ago';
    return `${diffInDays} days ago`;
  };

  if (isLoading) {
    return (
      <div className="notifications-container">
        <div className="notifications-loading">Loading notifications...</div>
      </div>
    );
  }

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <h2>Notifications</h2>
        {unreadCount > 0 && (
          <span className="unread-badge">{unreadCount}</span>
        )}
      </div>

      <div className="notifications-list">
        {notifications.length > 0 ? (
          notifications.map(notification => (
            <div 
              key={notification.id}
              className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
              onClick={() => {
                if (!notification.isRead) {
                  markAsRead(notification.id);
                }
              }}
            >
              <Link 
                to={getNotificationLink(notification)}
                className="notification-link"
              >
                <div className="notification-icon">
                  {getNotificationIcon(notification.type)}
                </div>
                
                <div className="notification-content">
                  <div className="notification-actor">
                    {notification.actor?.profilePicture ? (
                      <img 
                        src={notification.actor.profilePicture} 
                        alt={notification.actor.username}
                        className="actor-avatar"
                      />
                    ) : (
                      <div className="actor-avatar-placeholder">
                        {notification.actor?.username?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>
                  
                  <div className="notification-details">
                    <p className="notification-message">{notification.message}</p>
                    <span className="notification-time">{formatDate(notification.createdAt)}</span>
                  </div>
                </div>

                {!notification.isRead && (
                  <div className="unread-indicator" />
                )}
              </Link>
            </div>
          ))
        ) : (
          <div className="no-notifications">
            <div className="no-notifications-icon">🔔</div>
            <h3>No notifications yet</h3>
            <p>When someone likes, comments, or follows you, you'll see it here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationList;