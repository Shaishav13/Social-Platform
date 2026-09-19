import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import type { Notification } from '../../types';
import { SkeletonLoader } from '../wren';
import { resolveMediaUrl } from '../../utils/media';
import api from '../../services/api';

type NotificationFilter = 'all' | 'unread' | 'mentions' | 'interactions' | 'follows';

const NotificationList: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');
  const [pendingFollowRequestsCount, setPendingFollowRequestsCount] = useState(0);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadNotifications();
    loadFollowRequestsCount();
  }, []);

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/notifications');
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

  const loadFollowRequestsCount = async () => {
    try {
      const response = await api.get('/social/follow-requests');
      const requests = response.data.data || [];
      setPendingFollowRequestsCount(requests.length);
    } catch {
      // Non-critical
    }
  };

  const markAsRead = async (notificationId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }

    if (notification.type === 'follow_request') {
      return;
    }

    const link = getNotificationLink(notification);
    if (link && link !== '#') {
      navigate(link);
    }
  };

  const handleFollowRequest = async (notificationId: string, action: 'accept' | 'decline', e: React.MouseEvent) => {
    e.stopPropagation();
    setProcessingRequestId(notificationId);
    try {
      const notification = notifications.find(n => n.id === notificationId);
      if (!notification) return;

      const response = await api.get('/social/follow-requests');
      const requests = response.data.data || [];
      const request = requests.find((r: any) => r.requesterId === notification.actorId);

      if (request) {
        await api.post(`/social/follow-requests/${request.id}/${action}`);
      }

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (!notification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      setPendingFollowRequestsCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error(`Failed to ${action} follow request:`, error);
    } finally {
      setProcessingRequestId(null);
    }
  };

  useEffect(() => {
    if ((window as any).updateHeaderUnreadCount) {
      (window as any).updateHeaderUnreadCount(unreadCount);
    }
  }, [unreadCount]);

  const getNotificationLink = (notification: Notification) => {
    switch (notification.type) {
      case 'like':
      case 'share':
        return `/post/${notification.postId || notification.targetId}`;
      case 'comment':
        return `/post/${notification.postId}?comment=${notification.targetId}`;
      case 'mention':
        if (notification.postId && notification.postId !== notification.targetId) {
          return `/post/${notification.postId}?comment=${notification.targetId}`;
        }
        return `/post/${notification.targetId}`;
      case 'follow':
      case 'follow_accepted':
        return `/profile/${notification.actor?.username || notification.actorId}`;
      case 'follow_request':
        return '#';
      default:
        return notification.postId ? `/post/${notification.postId}` : '#';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Filter notifications based on active tab
  const filteredNotifications = notifications.filter(n => {
    switch (activeFilter) {
      case 'unread':
        return !n.isRead;
      case 'mentions':
        return n.type === 'mention';
      case 'interactions':
        return n.type === 'like' || n.type === 'comment' || n.type === 'share';
      case 'follows':
        return n.type === 'follow' || n.type === 'follow_request' || n.type === 'follow_accepted';
      case 'all':
      default:
        return true;
    }
  });

  const mentionsCount = notifications.filter(n => n.type === 'mention' && !n.isRead).length;

  const renderBadgeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'like':
        return (
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              backgroundColor: '#e11d48',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              border: '2px solid var(--paper-100)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
        );
      case 'comment':
        return (
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              backgroundColor: '#0d9488',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              border: '2px solid var(--paper-100)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z" />
            </svg>
          </div>
        );
      case 'mention':
        return (
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              backgroundColor: 'var(--wine-700, #8b2438)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              border: '2px solid var(--paper-100)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              fontSize: '10px',
              fontWeight: 800,
            }}
          >
            @
          </div>
        );
      case 'follow':
      case 'follow_accepted':
        return (
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              border: '2px solid var(--paper-100)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          </div>
        );
      case 'follow_request':
        return (
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              backgroundColor: '#d97706',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              border: '2px solid var(--paper-100)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
          </div>
        );
      case 'share':
        return (
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              border: '2px solid var(--paper-100)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </div>
        );
      default:
        return (
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              backgroundColor: 'var(--ink-500)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              border: '2px solid var(--paper-100)',
            }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
            </svg>
          </div>
        );
    }
  };

  const renderEmptyState = () => {
    switch (activeFilter) {
      case 'unread':
        return {
          title: "You're all caught up!",
          description: "No unread notifications right now. Feel free to explore new correspondence in the feed or write a fresh letter.",
        };
      case 'mentions':
        return {
          title: 'No mentions yet',
          description: 'When someone mentions you with @username in their posts, letters, or comments, they will appear here.',
        };
      case 'interactions':
        return {
          title: 'No interactions yet',
          description: 'When readers appreciate your writings with likes or replies, they will appear here.',
        };
      case 'follows':
        return {
          title: 'No follower updates',
          description: 'When other readers follow your correspondence or request to join your readership, you will see them here.',
        };
      case 'all':
      default:
        return {
          title: 'No notifications yet',
          description: 'When readers like, comment, mention, or follow your correspondence, your notifications will arrive here.',
        };
    }
  };

  const emptyInfo = renderEmptyState();

  return (
    <div style={{ maxWidth: '680px', margin: '24px auto 80px', padding: '0 20px' }}>
      {/* Header Section */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <h1 className="type-display-l" style={{ margin: 0 }}>
                Notifications
              </h1>
              {unreadCount > 0 && (
                <span
                  style={{
                    backgroundColor: 'var(--wine-700, #8b2438)',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>
            <p className="type-ui-m" style={{ color: 'var(--ink-600)', margin: 0 }}>
              Correspondence responses, mentions, and reader signals.
            </p>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link
              to="/follow-requests"
              className="wren-button wren-button--ghost"
              style={{
                fontSize: '13px',
                padding: '6px 12px',
                gap: '6px',
                display: 'inline-flex',
                alignItems: 'center',
                borderColor: pendingFollowRequestsCount > 0 ? 'var(--wine-700)' : undefined,
                color: pendingFollowRequestsCount > 0 ? 'var(--wine-700)' : undefined,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              <span>Follow Requests</span>
              {pendingFollowRequestsCount > 0 && (
                <span
                  style={{
                    backgroundColor: 'var(--wine-700, #8b2438)',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '10px',
                  }}
                >
                  {pendingFollowRequestsCount}
                </span>
              )}
            </Link>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="wren-button wren-button--ghost"
                style={{ fontSize: '13px', padding: '6px 12px', gap: '6px', display: 'inline-flex', alignItems: 'center' }}
                title="Mark all as read"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Mark all read</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            marginTop: '20px',
            overflowX: 'auto',
            paddingBottom: '4px',
            scrollbarWidth: 'none',
          }}
        >
          {[
            { id: 'all', label: 'All', count: notifications.length },
            { id: 'unread', label: 'Unread', count: unreadCount },
            { id: 'mentions', label: 'Mentions', count: mentionsCount },
            { id: 'interactions', label: 'Interactions' },
            { id: 'follows', label: 'Follows' },
          ].map(tab => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id as NotificationFilter)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 500,
                  fontFamily: 'var(--font-sans)',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: isActive ? 'var(--wine-700, #8b2438)' : 'var(--paper-200)',
                  color: isActive ? '#ffffff' : 'var(--ink-700)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '1px 6px',
                      borderRadius: '10px',
                      backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : 'var(--paper-300)',
                      color: isActive ? '#ffffff' : 'var(--ink-800)',
                      fontWeight: 700,
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notifications List Container */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SkeletonLoader count={4} />
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div
          className="wren-card"
          style={{
            textAlign: 'center',
            padding: '52px 24px',
            borderStyle: 'dashed',
            backgroundColor: 'var(--paper-100)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--paper-200)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: 'var(--ink-500)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <h2 className="type-display-m" style={{ margin: '0 0 8px', fontSize: '19px', color: 'var(--ink-900)' }}>
            {emptyInfo.title}
          </h2>
          <p className="type-ui-m" style={{ color: 'var(--ink-600)', maxWidth: '420px', margin: '0 auto 24px', lineHeight: 1.5 }}>
            {emptyInfo.description}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <Link to="/feed" className="wren-btn wren-btn-primary" style={{ padding: '8px 18px', fontSize: '13.5px' }}>
              Explore Feed
            </Link>
            {activeFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className="wren-btn wren-btn-secondary"
                style={{ padding: '8px 18px', fontSize: '13.5px' }}
              >
                View All
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'var(--paper-100)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md, 8px)',
            overflow: 'hidden',
          }}
        >
          {filteredNotifications.map((notification, index) => {
            const isUnread = !notification.isRead;
            const actorName = notification.actor?.username || 'Someone';
            const actorInitial = actorName.charAt(0).toUpperCase();
            const avatarUrl = notification.actor?.profilePicture ? resolveMediaUrl(notification.actor.profilePicture) : null;
            const isLast = index === filteredNotifications.length - 1;

            return (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                  padding: '16px 20px',
                  backgroundColor: isUnread ? 'rgba(139, 36, 56, 0.035)' : 'transparent',
                  borderLeft: isUnread ? '3.5px solid var(--wine-700, #8b2438)' : '3.5px solid transparent',
                  borderBottom: isLast ? 'none' : '1px solid var(--border)',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = isUnread ? 'rgba(139, 36, 56, 0.06)' : 'var(--paper-200)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = isUnread ? 'rgba(139, 36, 56, 0.035)' : 'transparent';
                }}
              >
                {/* Actor Avatar with Status Micro-Badge */}
                <div style={{ position: 'relative', flexShrink: 0, marginTop: '2px' }}>
                  <Link
                    to={`/profile/${notification.actor?.username || notification.actorId}`}
                    onClick={e => e.stopPropagation()}
                    style={{ textDecoration: 'none' }}
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={actorName}
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '1.5px solid var(--border)',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--wine-900, #5a1a2a)',
                          color: 'var(--paper-100)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '15px',
                          border: '1.5px solid var(--border)',
                        }}
                      >
                        {actorInitial}
                      </div>
                    )}
                  </Link>
                  {renderBadgeIcon(notification.type)}
                </div>

                {/* Content & Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                    <div style={{ fontSize: '14.5px', color: 'var(--ink-900)', fontFamily: 'var(--font-sans)', lineHeight: 1.45 }}>
                      <Link
                        to={`/profile/${notification.actor?.username || notification.actorId}`}
                        onClick={e => e.stopPropagation()}
                        style={{
                          fontWeight: 700,
                          color: 'var(--ink-900)',
                          textDecoration: 'none',
                          marginRight: '5px',
                        }}
                      >
                        {actorName}
                      </Link>
                      <span style={{ color: isUnread ? 'var(--ink-900)' : 'var(--ink-700)', fontWeight: isUnread ? 500 : 400 }}>
                        {notification.message}
                      </span>
                    </div>

                    <time
                      dateTime={notification.createdAt}
                      style={{
                        fontSize: '12px',
                        color: isUnread ? 'var(--wine-700, #8b2438)' : 'var(--ink-500)',
                        fontWeight: isUnread ? 600 : 400,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      {formatDate(notification.createdAt)}
                    </time>
                  </div>

                  {/* Follow Request Action Buttons */}
                  {notification.type === 'follow_request' && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button
                        type="button"
                        disabled={processingRequestId === notification.id}
                        onClick={e => handleFollowRequest(notification.id, 'accept', e)}
                        className="wren-btn wren-btn-primary"
                        style={{ padding: '5px 14px', fontSize: '12.5px' }}
                      >
                        {processingRequestId === notification.id ? '...' : 'Accept'}
                      </button>
                      <button
                        type="button"
                        disabled={processingRequestId === notification.id}
                        onClick={e => handleFollowRequest(notification.id, 'decline', e)}
                        className="wren-btn wren-btn-secondary"
                        style={{ padding: '5px 14px', fontSize: '12.5px' }}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>

                {/* Right edge: Unread Indicator & Mark Read Action */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, alignSelf: 'center' }}>
                  {isUnread && (
                    <>
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--wine-700, #8b2438)',
                          boxShadow: '0 0 0 2px rgba(139, 36, 56, 0.2)',
                        }}
                        title="Unread"
                      />
                      <button
                        type="button"
                        onClick={e => markAsRead(notification.id, e)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px',
                          color: 'var(--ink-400)',
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: '50%',
                          transition: 'color 0.15s',
                        }}
                        title="Mark as read"
                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--wine-700, #8b2438)')}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--ink-400)')}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationList;