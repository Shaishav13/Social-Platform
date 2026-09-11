import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../ui';
import api from '../../services/api';

interface FollowUser {
  id: string;
  username: string;
  bio?: string;
  profilePicture?: string;
}

interface FollowListModalProps {
  userId: string;
  type: 'followers' | 'following';
  count: number;
  onClose: () => void;
}

export const FollowListModal: React.FC<FollowListModalProps> = ({
  userId,
  type,
  count,
  onClose,
}) => {
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [userId, type]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError('');
      const res = await api.get(`/social/users/${userId}/${type}`);
      setUsers(res.data.data || []);
    } catch {
      setError('Failed to load list. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="follow-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={type === 'followers' ? 'Followers' : 'Following'}
    >
      <div
        className="follow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="follow-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Icon name="users" size={20} />
            <h2 className="follow-modal-title">
              {type === 'followers' ? 'Followers' : 'Following'}
              <span className="follow-modal-count">{count}</span>
            </h2>
          </div>
          <button
            className="follow-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="follow-modal-body">
          {isLoading ? (
            <div className="follow-modal-loading">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="follow-modal-skeleton">
                  <div className="follow-skeleton-avatar" />
                  <div style={{ flex: 1 }}>
                    <div className="follow-skeleton-name" />
                    <div className="follow-skeleton-bio" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="follow-modal-error">
              <Icon name="shield" size={32} />
              <p>{error}</p>
              <button className="wren-btn wren-btn-secondary" onClick={fetchUsers}>
                Try Again
              </button>
            </div>
          ) : users.length === 0 ? (
            <div className="follow-modal-empty">
              <Icon name="users" size={48} />
              <p>
                {type === 'followers'
                  ? 'No followers yet.'
                  : 'Not following anyone yet.'}
              </p>
            </div>
          ) : (
            <ul className="follow-modal-list">
              {users.map((u) => (
                <li key={u.id} className="follow-modal-item">
                  <Link
                    to={`/profile/${u.id}`}
                    className="follow-modal-user-link"
                    onClick={onClose}
                  >
                    {u.profilePicture ? (
                      <img
                        src={u.profilePicture}
                        alt={u.username}
                        className="follow-modal-avatar"
                      />
                    ) : (
                      <div className="follow-modal-avatar-placeholder">
                        {u.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="follow-modal-user-info">
                      <span className="follow-modal-username">{u.username}</span>
                      {u.bio && (
                        <span className="follow-modal-bio">{u.bio}</span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
