import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { Notification } from '../../types';
import { SkeletonLoader } from '../wren';
import api from '../../services/api';

const NotificationList: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      console.log('Notification API response:', response.data);
      
      // Handle the API response structure
      const notificationData = response.data.notifications || [];
      const unreadCountFromAPI = response.data.unreadCount || 0;
      
      setNotifications(notificationData);
      setUnreadCount(unreadCountFromAPI);
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

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => 
        prev.map(n => ({ ...n, isRead: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read if unread
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    // For follow requests, don't navigate - handle inline
    if (notification.type === 'follow_request') {
      return;
    }

    // Navigate to the appropriate page
    const link = getNotificationLink(notification);
    if (link !== '#') {
      navigate(link);
    }
  };

  const handleFollowRequest = async (notificationId: string, action: 'accept' | 'decline') => {
    try {
      // Find the notification to get the actor ID
      const notification = notifications.find(n => n.id === notificationId);
      if (!notification) {
        console.error('Notification not found');
        return;
      }

      // Get all pending follow requests to find the matching one
      const response = await api.get('/social/follow-requests');
      const requests = response.data.data || [];
      
      // Find the request that matches this notification's actor
      const request = requests.find((r: any) => r.requesterId === notification.actorId);
      if (!request) {
        console.error('Follow request not found');
        return;
      }

      // Accept or decline the request
      const actionResponse = await api.post(`/social/follow-requests/${request.id}/${action}`);
      console.log(`Follow request ${action} response:`, actionResponse.data);

      // Remove the notification from the list
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      
      // Update unread count if it was unread
      if (!notification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }

      // Show success message
      console.log(`Follow request ${action}ed successfully`);
    } catch (error) {
      console.error(`Failed to ${action} follow request:`, error);
      alert(`Failed to ${action} follow request. Please try again.`);
    }
  };

  // Update parent component's unread count when notifications are loaded
  useEffect(() => {
    if (window.updateHeaderUnreadCount) {
      window.updateHeaderUnreadCount(unreadCount);
    }
  }, [unreadCount]);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'like': return '❤️';
      case 'comment': return '💬';
      case 'follow': return '👤';
      case 'follow_request': return '👋';
      case 'follow_accepted': return '✅';
      case 'share': return '🔗';
      case 'mention': return '@';
      default: return '🔔';
    }
  };

  const getNotificationLink = (notification: Notification) => {
    switch (notification.type) {
      case 'like':
      case 'share':
        // For likes and shares, go directly to the post
        return `/post/${notification.postId || notification.targetId}`;
      case 'comment':
        // For comments, go to the post with comment highlighted
        return `/post/${notification.postId}?comment=${notification.targetId}`;
      case 'mention':
        // For mentions, check if it's a post or comment mention
        if (notification.postId && notification.postId !== notification.targetId) {
          // It's a comment mention - use postId for navigation
          return `/post/${notification.postId}?comment=${notification.targetId}`;
        } else {
          // It's a post mention
          return `/post/${notification.targetId}`;
        }
      case 'follow':
      case 'follow_accepted':
        // For follows, go to the follower's profile
        return `/profile/${notification.actorId}`;
      case 'follow_request':
        // For follow requests, stay on notifications page to handle the request
        return '#';
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
    return <SkeletonLoader count={3} />;
  }

  return (
    <div className="notifications-container">
      <div className="notifications-header">
        <h2>Notifications</h2>
        <div className="notifications-header-actions">
          <Link to="/test-follow-requests" className="btn btn-ghost btn-sm">
            Test System
          </Link>
          <Link to="/follow-requests" className="btn btn-secondary btn-sm">
            Follow Requests
          </Link>
          {unreadCount > 0 && (
            <>
              <span className="unread-badge">{unreadCount}</span>
              <button 
                onClick={markAllAsRead}
                className="mark-all-read-btn"
                title="Mark all as read"
              >
                ✓
              </button>
            </>
          )}
        </div>
      </div>

      <div className="notifications-list">
        {notifications.length > 0 ? (
          notifications.map(notification => (
            <div 
              key={notification.id}
              className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="notification-link">
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
                    
                    {notification.type === 'follow_request' && (
                      <div className="follow-request-actions">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFollowRequest(notification.id, 'accept');
                          }}
                          className="btn btn-primary btn-sm"
                        >
                          Accept
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFollowRequest(notification.id, 'decline');
                          }}
                          className="btn btn-secondary btn-sm"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {!notification.isRead && (
                  <div className="unread-indicator" />
                )}
              </div>
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