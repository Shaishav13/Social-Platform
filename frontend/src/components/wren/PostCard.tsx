import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Post, User } from '../../types';
import { InteractionBar } from './InteractionBar';
import { Icon, MediaViewerModal } from '../ui';
import { resolveMediaUrl } from '../../utils/media';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

interface PostCardProps {
  post: Post;
  currentUser?: User;
  onPostUpdate?: (updatedPost: Post) => void;
  onPostDelete?: (postId: string) => void;
  onUpdate?: (updatedPost: Post) => void;
  onDelete?: (postId: string) => void;
  isDetailView?: boolean;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUser,
  onPostUpdate,
  onPostDelete,
  onUpdate,
  onDelete,
  isDetailView = false,
}) => {
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || '');
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { user: authUser } = useAuth();
  const effectiveUser = currentUser || authUser;

  // Check if current user is author of post or platform admin
  const isOwner = Boolean(
    effectiveUser && (
      effectiveUser.id === post.authorId ||
      effectiveUser.id === post.author?.id
    )
  );
  const isAdmin = effectiveUser?.role === 'admin';
  const canManage = isOwner || isAdmin;

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
        setConfirmDelete(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleMediaClick = (idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setViewerIndex(idx);
    setViewerOpen(true);
  };

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const handleLikeToggle = async () => {
    const nextState = !isLiked;
    setIsLiked(nextState);
    setLikeCount(prev => (nextState ? prev + 1 : Math.max(0, prev - 1)));

    try {
      if (nextState) {
        await api.post(`/social/posts/${post.id}/like`);
      } else {
        await api.delete(`/social/posts/${post.id}/like`);
      }
      (onPostUpdate || onUpdate)?.({ ...post, isLiked: nextState, likeCount: nextState ? likeCount + 1 : Math.max(0, likeCount - 1) });
    } catch {
      // Revert if API fails
      setIsLiked(!nextState);
      setLikeCount(prev => (!nextState ? prev + 1 : Math.max(0, prev - 1)));
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await api.delete(`/content/posts/${post.id}`);
      setIsMenuOpen(false);
      setConfirmDelete(false);
      if (onPostDelete) onPostDelete(post.id);
      if (onDelete) onDelete(post.id);
    } catch (err: any) {
      console.error('Failed to delete letter:', err);
      alert(err.response?.data?.message || 'Failed to delete letter. Check your connection or permissions.');
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      await api.put(`/content/posts/${post.id}`, { content: editContent.trim() });
      setIsEditing(false);
      (onPostUpdate || onUpdate)?.({ ...post, content: editContent.trim() });
    } catch {
      alert('Failed to update letter.');
    }
  };

  // Resolve media URLs
  const mediaUrls = post.mediaUrls || [];

  return (
    <article className="wren-post" aria-labelledby={`post-author-${post.id}`}>
      {/* Post Header: Author and metadata */}
      <div className="wren-post-header">
        <div className="wren-author-info">
          <Link to={`/profile/${post.authorId || post.author?.id}`}>
            {post.author?.profilePicture && !imgError ? (
              <img
                src={resolveMediaUrl(post.author.profilePicture)}
                alt={post.author.username}
                className="wren-avatar"
                style={{ width: '32px', height: '32px' }}
                onError={() => setImgError(true)}
              />
            ) : (
              <div
                className="wren-avatar-placeholder"
                style={{ width: '32px', height: '32px', fontSize: '13px' }}
              >
                {post.author?.username?.charAt(0).toUpperCase() || 'W'}
              </div>
            )}
          </Link>

          <div>
            <Link
              to={`/profile/${post.authorId || post.author?.id}`}
              className="wren-author-name"
              id={`post-author-${post.id}`}
            >
              {post.author?.username || 'Anonymous'}
            </Link>
            <span className="wren-author-handle" style={{ marginLeft: '6px' }}>
              @{post.author?.username || 'anonymous'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <time className="wren-post-timestamp" dateTime={post.createdAt}>
            {formatTimestamp(post.createdAt)}
          </time>

          {canManage && (
            <div style={{ position: 'relative' }} ref={menuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(!isMenuOpen);
                  setConfirmDelete(false);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--ink-600)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                aria-label="Post options"
                title="Options"
              >
                <Icon name="more" size={16} />
              </button>

              {isMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    backgroundColor: 'var(--paper-100)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                    zIndex: 50,
                    minWidth: confirmDelete ? '160px' : '110px',
                    padding: confirmDelete ? '10px' : '4px 0',
                  }}
                >
                  {confirmDelete ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--ink-700)', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                        Delete permanently?
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={isDeleting}
                          style={{
                            flex: 1,
                            backgroundColor: 'var(--rust-alert, #A63D40)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '5px 8px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {isDeleting ? '...' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          disabled={isDeleting}
                          style={{
                            flex: 1,
                            backgroundColor: 'var(--paper-200)',
                            color: 'var(--ink-800)',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            padding: '5px 8px',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => { setIsEditing(true); setIsMenuOpen(false); }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '8px 12px',
                            background: 'none',
                            border: 'none',
                            color: 'var(--ink-900)',
                            cursor: 'pointer',
                            fontSize: '13px',
                          }}
                        >
                          Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 12px',
                          background: 'none',
                          border: 'none',
                          color: 'var(--rust-alert)',
                          cursor: 'pointer',
                          fontSize: '13px',
                          borderTop: isOwner ? '1px solid var(--border)' : 'none',
                        }}
                      >
                        {isAdmin && !isOwner ? 'Admin Delete' : 'Delete'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Post Content: Serif humanist body */}
      {isEditing ? (
        <div style={{ marginTop: '8px' }}>
          <textarea
            className="wren-compose-input"
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            rows={3}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button onClick={handleSaveEdit} className="wren-btn wren-btn-primary" style={{ padding: '4px 12px', fontSize: '13px' }}>
              Save
            </button>
            <button onClick={() => setIsEditing(false)} className="wren-btn wren-btn-secondary" style={{ padding: '4px 12px', fontSize: '13px' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="wren-post-body">
          {isDetailView ? (
            <p>{post.content}</p>
          ) : (
            <Link to={`/post/${post.id}`} style={{ display: 'block', color: 'inherit' }}>
              <p>{post.content}</p>
            </Link>
          )}
        </div>
      )}

      {/* Post Media: Clean inline framed display & multiple media layouts */}
      {mediaUrls.length > 0 && (
        <div
          className="wren-post-media"
          style={{
            position: 'relative',
            marginTop: 'calc(var(--space-unit) * 1.5)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--paper-200)',
          }}
        >
          {/* Multiple Media Count Badge */}
          {mediaUrls.length > 1 && (
            <div
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                zIndex: 5,
                backgroundColor: 'rgba(28, 26, 24, 0.75)',
                backdropFilter: 'blur(6px)',
                color: '#FAF8F5',
                padding: '3px 9px',
                borderRadius: '12px',
                fontSize: '12px',
                fontFamily: 'var(--font-sans)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                pointerEvents: 'none',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              <span>{currentMediaIndex + 1}/{mediaUrls.length}</span>
            </div>
          )}

          {/* Carousel Arrows */}
          {mediaUrls.length > 1 && currentMediaIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setCurrentMediaIndex(prev => prev - 1); }}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 5,
                backgroundColor: 'rgba(28, 26, 24, 0.75)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
          )}

          {mediaUrls.length > 1 && currentMediaIndex < mediaUrls.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setCurrentMediaIndex(prev => prev + 1); }}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 5,
                backgroundColor: 'rgba(28, 26, 24, 0.75)',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          )}

          {/* Current Media */}
          <div
            onClick={(e) => handleMediaClick(currentMediaIndex, e)}
            style={{ cursor: 'pointer', position: 'relative', width: '100%', minHeight: '300px', maxHeight: '520px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--paper-200)' }}
            title="Click to view full size"
          >
            {mediaUrls[currentMediaIndex].match(/\.(mp4|webm|mov)$/i) ? (
              <video src={resolveMediaUrl(mediaUrls[currentMediaIndex])} controls preload="metadata" style={{ width: '100%', maxHeight: '520px', objectFit: 'contain' }} />
            ) : (
              <img
                src={resolveMediaUrl(mediaUrls[currentMediaIndex])}
                alt={`Attachment ${currentMediaIndex + 1}`}
                loading="lazy"
                style={{ width: '100%', minHeight: '300px', maxHeight: '520px', objectFit: 'contain', display: 'block', transition: 'transform 0.2s ease', color: 'var(--ink-400)', textAlign: 'center', lineHeight: '300px' }}
              />
            )}
          </div>
        </div>
      )}

      {/* Post Action Bar */}
      <InteractionBar
        postId={post.id}
        likeCount={likeCount}
        commentCount={post.commentCount || 0}
        isLiked={isLiked}
        onLikeToggle={handleLikeToggle}
        onCommentClick={() => {
          if (!isDetailView) {
            window.location.href = `/post/${post.id}`;
          }
        }}
      />

      {/* Full-Size Photo/Video Viewer Modal with Multi-Media Slider Navigation */}
      <MediaViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        mediaUrls={mediaUrls}
        initialIndex={viewerIndex}
        authorName={post.author?.username}
        authorUsername={post.author?.username}
        caption={post.content}
      />
    </article>
  );
};
