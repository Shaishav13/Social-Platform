import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Comment, User } from '../../types';
import api from '../../services/api';

interface CommentSectionProps {
  postId: string;
  currentUser?: User;
  onCommentCountChange?: (newCount: number) => void;
}

const CommentSection: React.FC<CommentSectionProps> = ({ 
  postId, 
  currentUser,
  onCommentCountChange 
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});

  useEffect(() => {
    loadComments();
  }, [postId]);

  const loadComments = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/social/posts/${postId}/comments`);
      setComments(response.data.data || []);
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await api.post(`/social/posts/${postId}/comments`, {
        content: newComment.trim()
      });

      const comment = response.data.data;
      setComments(prev => [comment, ...prev]);
      setNewComment('');
      
      if (onCommentCountChange) {
        onCommentCountChange(comments.length + 1);
      }
    } catch (error) {
      console.error('Failed to post comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    const replyText = replyTexts[parentId] || '';
    if (!replyText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await api.post(`/social/posts/${postId}/comments`, {
        content: replyText.trim(),
        parentId
      });

      const reply = response.data.data;
      
      // Add reply to the parent comment
      setComments(prev => prev.map(comment => {
        if (comment.id === parentId) {
          return {
            ...comment,
            replies: [...(comment.replies || []), reply]
          };
        }
        return comment;
      }));

      // Clear the reply text for this specific comment
      setReplyTexts(prev => ({ ...prev, [parentId]: '' }));
      setReplyingTo(null);
      
      if (onCommentCountChange) {
        onCommentCountChange(comments.length + 1);
      }
    } catch (error) {
      console.error('Failed to post reply:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d`;
  };

  const CommentItem: React.FC<{ comment: Comment; isReply?: boolean }> = ({ comment, isReply = false }) => (
    <div className={`comment-item ${isReply ? 'reply' : ''}`}>
      <Link to={`/profile/${comment.authorId}`} className="comment-author-link">
        {comment.author?.profilePicture ? (
          <img 
            src={comment.author.profilePicture} 
            alt={comment.author.username}
            className="comment-avatar"
          />
        ) : (
          <div className="comment-avatar-placeholder">
            {comment.author?.username?.charAt(0).toUpperCase() || 'U'}
          </div>
        )}
      </Link>
      
      <div className="comment-content">
        <div className="comment-body">
          <Link to={`/profile/${comment.authorId}`} className="comment-author">
            {comment.author?.username || 'Unknown User'}
          </Link>
          <span className="comment-text">{comment.content}</span>
        </div>
        
        <div className="comment-meta">
          <span className="comment-time">{formatDate(comment.createdAt)}</span>
          <button className="comment-action-btn like-btn">
            <span className="action-icon">{comment.isLiked ? '❤️' : '🤍'}</span>
            {comment.likeCount > 0 && <span className="like-count">{comment.likeCount}</span>}
          </button>
          
          {!isReply && (
            <button 
              className="comment-action-btn reply-btn"
              onClick={() => {
                const newReplyingTo = replyingTo === comment.id ? null : comment.id;
                setReplyingTo(newReplyingTo);
                // Clear reply text when closing the reply form
                if (newReplyingTo === null) {
                  setReplyTexts(prev => ({ ...prev, [comment.id]: '' }));
                }
              }}
            >
              Reply
            </button>
          )}
        </div>

        {/* Reply Form */}
        {replyingTo === comment.id && (
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmitReply(comment.id);
            }}
            className="reply-form"
          >
            <div className="reply-input-container">
              {currentUser?.profilePicture ? (
                <img 
                  src={currentUser.profilePicture} 
                  alt={currentUser.username}
                  className="reply-avatar"
                />
              ) : (
                <div className="reply-avatar-placeholder">
                  {currentUser?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <input
                type="text"
                value={replyTexts[comment.id] || ''}
                onChange={(e) => setReplyTexts(prev => ({ ...prev, [comment.id]: e.target.value }))}
                placeholder={`Reply to ${comment.author?.username}...`}
                className="reply-input"
                disabled={isSubmitting}
                autoFocus
              />
              <div className="reply-actions">
                <button 
                  type="button"
                  onClick={() => {
                    setReplyingTo(null);
                    setReplyTexts(prev => ({ ...prev, [comment.id]: '' }));
                  }}
                  className="reply-cancel-btn"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!(replyTexts[comment.id] || '').trim() || isSubmitting}
                  className="reply-submit-btn"
                >
                  {isSubmitting ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Nested Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="replies-container">
          {comment.replies.map(reply => (
            <CommentItem key={reply.id} comment={reply} isReply={true} />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="comment-section">
      {/* Comment Form */}
      {currentUser && (
        <form onSubmit={handleSubmitComment} className="comment-form">
          <div className="comment-input-container">
            {currentUser.profilePicture ? (
              <img 
                src={currentUser.profilePicture} 
                alt={currentUser.username}
                className="comment-form-avatar"
              />
            ) : (
              <div className="comment-form-avatar-placeholder">
                {currentUser.username?.charAt(0).toUpperCase()}
              </div>
            )}
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="comment-input"
              disabled={isSubmitting}
            />
            <button 
              type="submit"
              disabled={!newComment.trim() || isSubmitting}
              className="comment-submit-btn"
            >
              {isSubmitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      )}

      {/* Comments List */}
      <div className="comments-list">
        {isLoading ? (
          <div className="comments-loading">Loading comments...</div>
        ) : comments.length > 0 ? (
          comments.map(comment => (
            <CommentItem key={comment.id} comment={comment} />
          ))
        ) : (
          <div className="no-comments">No comments yet. Be the first to comment!</div>
        )}
      </div>
    </div>
  );
};

export default CommentSection;