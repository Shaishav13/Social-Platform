import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { User } from '../../types';
import { Icon } from '../ui';
import api from '../../services/api';

interface ProfileHeaderProps {
  user: User;
  isOwnProfile?: boolean;
  onBioUpdate?: (newBio: string) => void;
  onFollowToggle?: () => void;
  postCount?: number;
  followersCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
  onFollowersClick?: () => void;
  onFollowingClick?: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  user,
  isOwnProfile = false,
  onBioUpdate,
  onFollowToggle,
  postCount = 0,
  followersCount = 0,
  followingCount = 0,
  isFollowing = false,
  onFollowersClick,
  onFollowingClick,
}) => {
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioText, setBioText] = useState(user.bio || '');
  const [isSavingBio, setIsSavingBio] = useState(false);
  const [followHovered, setFollowHovered] = useState(false);

  const handleSaveBio = async () => {
    try {
      setIsSavingBio(true);
      await api.put(`/profile/users/${user.id}`, { bio: bioText });
      setIsEditingBio(false);
      onBioUpdate?.(bioText);
    } catch {
      alert('Failed to update bio.');
    } finally {
      setIsSavingBio(false);
    }
  };

  return (
    <header className="wren-profile-header">
      <div className="wren-profile-name-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {user.profilePicture ? (
            <img
              src={user.profilePicture}
              alt={user.username}
              className="wren-avatar"
              style={{ width: '64px', height: '64px' }}
            />
          ) : (
            <div
              className="wren-avatar-placeholder"
              style={{ width: '64px', height: '64px', fontSize: '24px' }}
            >
              {user.username?.charAt(0).toUpperCase() || 'W'}
            </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h1 className="wren-profile-name">{user.username}</h1>
              {(user as { isVerified?: boolean }).isVerified && (
                <span style={{ color: 'var(--wine-700)' }} title="Verified writer">
                  <Icon name="check" size={16} />
                </span>
              )}
            </div>
            <div className="wren-profile-handle">@{user.username}</div>
          </div>
        </div>

        {/* Action Button */}
        <div>
          {isOwnProfile ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link
                to="/profile/edit"
                className="wren-btn wren-btn-secondary"
                style={{ minHeight: '36px', padding: '6px 14px', fontSize: '13.5px' }}
              >
                Edit Profile
              </Link>
              <Link
                to="/settings"
                className="wren-btn wren-btn-secondary"
                style={{ minHeight: '36px', padding: '6px 12px', fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                title="Account Settings & Privacy"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
                Settings
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={onFollowToggle}
              onMouseEnter={() => setFollowHovered(true)}
              onMouseLeave={() => setFollowHovered(false)}
              className={`wren-btn-follow ${isFollowing ? 'is-following' : ''}`}
              aria-label={isFollowing ? 'Unfollow user' : 'Follow user'}
            >
              {isFollowing ? (followHovered ? 'Unfollow' : 'Following') : 'Follow'}
            </button>
          )}
        </div>
      </div>

      {/* Bio: editable in place on own profile with 1px dashed underline on hover */}
      {isEditingBio ? (
        <div style={{ marginTop: '12px' }}>
          <textarea
            className="wren-compose-input"
            value={bioText}
            onChange={e => setBioText(e.target.value)}
            rows={3}
            style={{ maxWidth: '48ch', fontSize: '15px' }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              onClick={handleSaveBio}
              className="wren-btn wren-btn-primary"
              style={{ minHeight: '32px', padding: '4px 12px', fontSize: '13px' }}
              disabled={isSavingBio}
            >
              {isSavingBio ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setIsEditingBio(false)}
              className="wren-btn wren-btn-secondary"
              style={{ minHeight: '32px', padding: '4px 12px', fontSize: '13px' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p
          className={`wren-profile-bio ${isOwnProfile ? 'editable' : ''}`}
          onClick={() => isOwnProfile && setIsEditingBio(true)}
          title={isOwnProfile ? 'Click to edit your bio' : undefined}
        >
          {user.bio || (isOwnProfile ? 'Add a short bio to introduce your writing...' : '')}
        </p>
      )}

      {/* Stats: clickable followers and following */}
      <div className="wren-profile-stats">
        <span>
          <strong>{postCount}</strong> posts
        </span>
        <button
          type="button"
          className="wren-profile-stat-btn"
          onClick={onFollowersClick}
          disabled={!onFollowersClick}
        >
          <strong>{followersCount}</strong> followers
        </button>
        <button
          type="button"
          className="wren-profile-stat-btn"
          onClick={onFollowingClick}
          disabled={!onFollowingClick}
        >
          <strong>{followingCount}</strong> following
        </button>
      </div>
    </header>
  );
};

