import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Comment, User } from '../../types';
import api from '../../services/api';

interface CommentSectionProps {
  postId: string;
  currentUser?: User;
  highlightCommentId?: string | null;
  onCommentCountChange?: (newCount: number) => void;
}

const CommentSection: React.FC<CommentSectionProps> = ({ 
  postId, 
  currentUser,
  highlightCommentId,
  onCommentCountChange 
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const highlightedCommentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadComments();
  }, [postId]);

  useEffect(() => {
    // Scroll to highlighted comment after comments are loaded
    if (highlightCommentId && comments.length > 0 && highlightedCommentRef.current) {
      setTimeout(() => {
        highlightedCommentRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }, 100);
    }
  }, [highlightCommentId, comments]);

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

  const CommentItem: React.FC<{ comment: Comment; isReply?: boolean }> = ({ comment, isReply = false }) => {
    const isHighlighted = highlightCommentId === comment.id;
    
    return (
      <div 
        className={`comment-item ${isReply ? 'reply' : ''} ${isHighlighted ? 'highlighted' : ''}`}
        ref={isHighlighted ? highlightedCommentRef : null}
      >
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
            <div className="reply-input-container" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginTop: '12px', marginLeft: '32px' }}>
              {currentUser?.profilePicture ? (
                <img 
                  src={currentUser.profilePicture} 
                  alt={currentUser.username}
                  className="reply-avatar"
                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div className="reply-avatar-placeholder" style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--brand-surface)', color: 'var(--brand-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', flexShrink: 0 }}>
                  {currentUser?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input
                  type="text"
                  value={replyTexts[comment.id] || ''}
                  onChange={(e) => setReplyTexts(prev => ({ ...prev, [comment.id]: e.target.value }))}
                  placeholder={`Reply to ${comment.author?.username}...`}
                  className="reply-input"
                  disabled={isSubmitting}
                  autoFocus
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '20px', backgroundColor: 'var(--paper)', fontSize: '14px', outline: 'none' }}
                />
                <div className="reply-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button 
                    type="button"
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyTexts(prev => ({ ...prev, [comment.id]: '' }));
                    }}
                    className="wren-btn wren-btn-secondary"
                    disabled={isSubmitting}
                    style={{ padding: '6px 12px', fontSize: '13px', borderRadius: '16px' }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={!(replyTexts[comment.id] || '').trim() || isSubmitting}
                    className="wren-btn wren-btn-primary"
                    style={{ padding: '6px 16px', fontSize: '13px', borderRadius: '16px', opacity: !(replyTexts[comment.id] || '').trim() || isSubmitting ? 0.6 : 1 }}
                  >
                    {isSubmitting ? 'Posting...' : 'Reply'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Nested Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="replies-container">
          {comment.replies.slice(0, expandedReplies[comment.id] ? undefined : 3).map(reply => (
            <CommentItem key={reply.id} comment={reply} isReply={true} />
          ))}
          {!expandedReplies[comment.id] && comment.replies.length > 3 && (
            <button 
              className="view-more-replies-btn"
              onClick={() => setExpandedReplies(prev => ({ ...prev, [comment.id]: true }))}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--ink-500)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 0',
                marginTop: '4px',
                fontFamily: 'var(--font-sans)',
                textAlign: 'left'
              }}
            >
              ---- View {comment.replies.length - 3} more replies
            </button>
          )}
        </div>
      )}
    </div>
    );
  };

  return (
    <div className="comment-section">
      {/* Comment Form */}
      {currentUser && (
        <form onSubmit={handleSubmitComment} className="comment-form">
          <div className="comment-input-container" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginTop: '16px', padding: '16px', backgroundColor: 'var(--paper-100)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            {currentUser.profilePicture ? (
              <img 
                src={currentUser.profilePicture} 
                alt={currentUser.username}
                className="comment-form-avatar"
                style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div className="comment-form-avatar-placeholder" style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--brand-surface)', color: 'var(--brand-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px', flexShrink: 0 }}>
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
              style={{ flex: 1, padding: '12px 16px', border: '1px solid var(--border)', borderRadius: '24px', backgroundColor: 'var(--paper)', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', width: '100%' }}
            />
            <button 
              type="submit"
              disabled={!newComment.trim() || isSubmitting}
              className="wren-btn wren-btn-primary"
              style={{ padding: '10px 20px', borderRadius: '24px', alignSelf: 'center', opacity: !newComment.trim() || isSubmitting ? 0.6 : 1 }}
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