import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Post, User } from '../../types';
import LikeButton from './LikeButton';
import CommentSection from './CommentSection';
import ShareButton from './ShareButton';
import api from '../../services/api';
import { resolveMediaUrl, handleMediaError, getMediaAltText } from '../../utils/media';

interface PostCardProps {
  post: Post;
  currentUser?: User;
  onPostUpdate?: (updatedPost: Post) => void;
  onPostDelete?: (postId: string) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, currentUser, onPostUpdate, onPostDelete }) => {
  const [showComments, setShowComments] = useState(false);
  const [localPost, setLocalPost] = useState(post);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const handlePostUpdate = (updatedPost: Post) => {
    setLocalPost(updatedPost);
    if (onPostUpdate) {
      onPostUpdate(updatedPost);
    }
  };

  const handleEditPost = async () => {
    if (!editContent.trim() || isUpdating) return;

    setIsUpdating(true);
    try {
      const response = await api.put(`/content/posts/${localPost.id}`, {
        content: editContent.trim()
      });

      const updatedPost = { ...localPost, content: editContent.trim() };
      setLocalPost(updatedPost);
      setIsEditing(false);
      setShowMenu(false);
      
      if (onPostUpdate) {
        onPostUpdate(updatedPost);
      }
    } catch (error) {
      console.error('Failed to update post:', error);
      alert('Failed to update post. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(localPost.content || '');
    setIsEditing(false);
    setShowMenu(false);
  };

  const handleDeletePost = async () => {
    if (!currentUser || currentUser.id !== localPost.authorId) {
      return;
    }

    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    setShowMenu(false);
    try {
      await api.delete(`/content/posts/${localPost.id}`);
      
      // Notify parent component about deletion
      if (onPostDelete) {
        onPostDelete(localPost.id);
      }
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('Failed to delete post. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return diffInMinutes < 1 ? 'Just now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return diffInDays === 1 ? '1 day ago' : `${diffInDays} days ago`;
    }
  };

  return (
    <article className="post-card">
      {/* Post Header */}
      <div className="post-header">
        <div className="author-info">
          <Link to={`/profile/${localPost.authorId}`} className="author-link">
            {localPost.author?.profilePicture ? (
              <img 
                src={localPost.author.profilePicture} 
                alt={localPost.author.username}
                className="author-avatar"
              />
            ) : (
              <div className="author-avatar-placeholder">
                {localPost.author?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </Link>
          
          <div className="author-details">
            <Link to={`/profile/${localPost.authorId}`} className="author-name">
              {localPost.author?.username || 'Unknown User'}
            </Link>
            <span className="post-time">{formatDate(localPost.createdAt)}</span>
          </div>
        </div>

        <div className="post-menu">
          {currentUser && currentUser.id === localPost.authorId && (
            <div className="post-menu-container" ref={menuRef}>
              <button 
                className="menu-btn"
                onClick={() => setShowMenu(!showMenu)}
                title="Post options"
              >
                ⋯
              </button>
              
              {showMenu && (
                <div className="post-menu-dropdown">
                  <button 
                    className="menu-item edit-btn"
                    onClick={() => {
                      setIsEditing(true);
                      setEditContent(localPost.content || '');
                      setShowMenu(false);
                    }}
                    disabled={isDeleting || isUpdating}
                  >
                    <span className="menu-icon">✏️</span>
                    Edit post
                  </button>
                  <button 
                    className="menu-item delete-btn"
                    onClick={handleDeletePost}
                    disabled={isDeleting || isUpdating}
                  >
                    <span className="menu-icon">{isDeleting ? '⏳' : '🗑️'}</span>
                    {isDeleting ? 'Deleting...' : 'Delete post'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Post Content */}
      <div className="post-content">
        {isEditing ? (
          <div className="post-edit-form">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="post-edit-textarea"
              placeholder="What's on your mind?"
              disabled={isUpdating}
              rows={3}
            />
            <div className="post-edit-actions">
              <button 
                className="btn btn-secondary btn-sm"
                onClick={handleCancelEdit}
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary btn-sm"
                onClick={handleEditPost}
                disabled={!editContent.trim() || isUpdating}
              >
                {isUpdating ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          localPost.content && (
            <p className="post-text">{localPost.content}</p>
          )
        )}
      </div>

      {/* Media Content */}
      {localPost.mediaUrls && localPost.mediaUrls.length > 0 && (
        <div className="post-media-container">
          <div className={`post-media ${localPost.mediaUrls.length > 1 ? 'multiple' : 'single'}`}>
            {localPost.mediaType === 'image' ? (
              localPost.mediaUrls.map((url, index) => (
                <div key={index} className="media-item">
                  <img 
                    src={resolveMediaUrl(url)} 
                    alt={getMediaAltText(index, 'image')}
                    className="post-image"
                    onError={(e) => handleMediaError(e, url)}
                  />
                </div>
              ))
            ) : localPost.mediaType === 'video' ? (
              localPost.mediaUrls.map((url, index) => (
                <div key={index} className="media-item">
                  <video 
                    src={resolveMediaUrl(url)} 
                    controls
                    className="post-video"
                    preload="metadata"
                    onError={(e) => handleMediaError(e, url)}
                  >
                    <p>Your browser doesn't support HTML video. Here is a <a href={resolveMediaUrl(url)}>link to the video</a> instead.</p>
                  </video>
                </div>
              ))
            ) : null}
          </div>
        </div>
      )}

      {/* Post Actions */}
      <div className="post-actions">
        <div className="action-buttons">
          <LikeButton 
            postId={localPost.id}
            isLiked={localPost.isLiked || false}
            likeCount={localPost.likeCount}
            onLikeChange={(isLiked, newCount) => {
              handlePostUpdate({
                ...localPost,
                isLiked,
                likeCount: newCount
              });
            }}
          />

          <button 
            className="action-btn comment-btn"
            onClick={() => setShowComments(!showComments)}
          >
            <span className="action-icon">💬</span>
            <span className="action-count">{localPost.commentCount}</span>
            <span className="action-text">Comment</span>
          </button>

          <ShareButton 
            postId={localPost.id}
            shareCount={localPost.shareCount}
            onShareChange={(newCount) => {
              handlePostUpdate({
                ...localPost,
                shareCount: newCount
              });
            }}
          />
        </div>

        {/* Engagement Summary */}
        {(localPost.likeCount > 0 || localPost.commentCount > 0 || localPost.shareCount > 0) && (
          <div className="engagement-summary">
            {localPost.likeCount > 0 && (
              <span className="engagement-item">
                {localPost.likeCount} {localPost.likeCount === 1 ? 'like' : 'likes'}
              </span>
            )}
            {localPost.commentCount > 0 && (
              <span className="engagement-item">
                {localPost.commentCount} {localPost.commentCount === 1 ? 'comment' : 'comments'}
              </span>
            )}
            {localPost.shareCount > 0 && (
              <span className="engagement-item">
                {localPost.shareCount} {localPost.shareCount === 1 ? 'share' : 'shares'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Comments Section */}
      {showComments && (
        <CommentSection 
          postId={localPost.id}
          currentUser={currentUser}
          onCommentCountChange={(newCount) => {
            handlePostUpdate({
              ...localPost,
              commentCount: newCount
            });
          }}
        />
      )}
    </article>
  );
};

export default PostCard;