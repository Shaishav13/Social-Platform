import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { Comment, User } from '../../types';
import { useConfig } from '../../contexts/ConfigContext';
import api from '../../services/api';
import { RichText } from '../ui/RichText';
import { useMentionAutocomplete, MentionDropdown } from '../ui';

interface CommentSectionProps {
  postId: string;
  currentUser?: User;
  highlightCommentId?: string | null;
  onCommentCountChange?: (newCount: number) => void;
}

// â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function resolveProfilePic(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${url}`;
}

interface AvatarProps {
  username?: string;
  profilePicture?: string | null;
  size?: number;
}

const Avatar: React.FC<AvatarProps> = ({ username, profilePicture, size = 36 }) => {
  const [imgErr, setImgErr] = useState(false);
  const resolved = resolveProfilePic(profilePicture);
  const initial = (username || 'U').charAt(0).toUpperCase();

  if (resolved && !imgErr) {
    return (
      <img
        src={resolved}
        alt={username}
        onError={() => setImgErr(true)}
        style={{
          width: size, height: size, borderRadius: '50%', objectFit: 'cover',
          flexShrink: 0, border: '1.5px solid var(--border)',
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      backgroundColor: 'var(--wine-900, #5a1a2a)', color: 'var(--paper-100)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: Math.max(12, Math.floor(size * 0.38)) + 'px',
      border: '1.5px solid var(--border)',
    }}>
      {initial}
    </div>
  );
};

// â”€â”€ CommentItem â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface CommentItemProps {
  comment: Comment;
  isReply?: boolean;
  currentUser?: User;
  postId: string;
  isHighlighted?: boolean;
  highlightRef?: React.RefObject<HTMLDivElement | null>;
  onReplyAdded?: (parentId: string, reply: Comment) => void;
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment, isReply = false, currentUser, postId,
  isHighlighted = false, highlightRef, onReplyAdded,
}) => {
  const { features } = useConfig();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState('');
  const replyInputRef = useRef<HTMLInputElement>(null);
  const {
    isOpen: isReplyMentionOpen,
    suggestions: replyMentionSuggestions,
    activeIndex: replyMentionActiveIndex,
    isLoading: isReplyMentionLoading,
    checkForMention: checkReplyMention,
    handleKeyDown: handleReplyMentionKeyDown,
    selectUser: selectReplyMentionUser,
  } = useMentionAutocomplete(replyText, setReplyText, replyInputRef);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isLiked, setIsLiked] = useState(comment.isLiked || false);
  const [likeCount, setLikeCount] = useState(comment.likeCount || 0);
  const [showAllReplies, setShowAllReplies] = useState(false);
  const REPLIES_TO_SHOW = 3;
  const replies = comment.replies || [];
  const visibleReplies = showAllReplies ? replies : replies.slice(0, REPLIES_TO_SHOW);
  const hiddenCount = replies.length - REPLIES_TO_SHOW;

  const handleLike = async () => {
    if (!currentUser) return;
    const prev = isLiked;
    setIsLiked(!prev);
    setLikeCount(c => prev ? c - 1 : c + 1);
    try {
      await api.post(`/social/comments/${comment.id}/like`);
    } catch {
      setIsLiked(prev);
      setLikeCount(c => prev ? c + 1 : c - 1);
    }
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || isSubmittingReply) return;
    setIsSubmittingReply(true);
    try {
      const response = await api.post(`/social/posts/${postId}/comments`, {
        content: replyText.trim(),
        parentId: comment.id,
      });
      const newReply = response.data.data;
      setReplyText('');
      setShowReplyForm(false);
      if (onReplyAdded) onReplyAdded(comment.id, newReply);
    } catch (err) {
      console.error('Failed to post reply:', err);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  return (
    <div
      ref={isHighlighted ? (highlightRef as any) : undefined}
      style={{
        display: 'flex', gap: '10px',
        padding: isReply ? '10px 0 0 0' : '14px 0',
        borderBottom: isReply ? 'none' : '1px solid var(--border)',
        backgroundColor: isHighlighted ? 'rgba(139, 36, 56, 0.06)' : 'transparent',
        borderRadius: isHighlighted ? '8px' : undefined,
        transition: 'background-color 0.3s',
      }}
    >
      <Link to={`/profile/${comment.authorId}`} style={{ flexShrink: 0, marginTop: '2px' }}>
        <Avatar username={comment.author?.username} profilePicture={comment.author?.profilePicture} size={isReply ? 30 : 36} />
      </Link>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Comment bubble */}
        <div style={{
          backgroundColor: 'var(--paper-200)',
          borderRadius: '14px',
          padding: '10px 14px',
          display: 'inline-block',
          maxWidth: '100%',
        }}>
          <Link
            to={`/profile/${comment.authorId}`}
            style={{
              fontWeight: 700, fontSize: '13.5px',
              color: 'var(--ink-900)', textDecoration: 'none',
              fontFamily: 'var(--font-sans)',
              display: 'block', marginBottom: '3px',
            }}
          >
            {comment.author?.username || 'Unknown'}
          </Link>
          <RichText
            text={comment.content}
            style={{
              fontSize: '14px', lineHeight: '1.55',
              color: 'var(--ink-800)', wordBreak: 'break-word',
              fontFamily: 'var(--font-sans)',
            }}
          />
        </div>

        {/* Meta row: time + like + reply */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          marginTop: '6px', marginLeft: '4px',
        }}>
          <span style={{ fontSize: '12px', color: 'var(--ink-500)', fontFamily: 'var(--font-sans)' }}>
            {formatDate(comment.createdAt)}
          </span>

          <button
            onClick={handleLike}
            style={{
              background: 'none', border: 'none', cursor: currentUser ? 'pointer' : 'default',
              padding: '2px 0', display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '12.5px', fontWeight: 700,
              color: isLiked ? 'var(--wine-700, #8b2438)' : 'var(--ink-500)',
              fontFamily: 'var(--font-sans)', transition: 'color 0.15s',
            }}
          >
            {isLiked ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            )}
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>

          {!isReply && currentUser && features.commenting && (
            <button
              onClick={() => {
                setShowReplyForm(s => {
                  const next = !s;
                  if (next && comment.author?.username) {
                    setReplyText(`@${comment.author.username} `);
                  }
                  return next;
                });
              }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '2px 0', fontSize: '12.5px', fontWeight: 700,
                color: showReplyForm ? 'var(--wine-700, #8b2438)' : 'var(--ink-500)',
                fontFamily: 'var(--font-sans)', transition: 'color 0.15s',
              }}
            >
              Reply
            </button>
          )}
        </div>

        {/* Reply input form */}
        {showReplyForm && currentUser && (
          <form onSubmit={handleSubmitReply} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px' }}>
            <Avatar username={currentUser.username} profilePicture={currentUser.profilePicture} size={28} />
            <div style={{ position: 'relative', flex: 1, display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                ref={replyInputRef}
                autoFocus
                type="text"
                value={replyText}
                onChange={e => {
                  setReplyText(e.target.value);
                  checkReplyMention();
                }}
                onKeyUp={checkReplyMention}
                onClick={checkReplyMention}
                onKeyDown={e => {
                  if (handleReplyMentionKeyDown(e)) return;
                }}
                placeholder={`Reply to ${comment.author?.username || 'this comment'}…`}
                disabled={isSubmittingReply}
                style={{
                  flex: 1, padding: '8px 14px',
                  border: '1.5px solid var(--border)', borderRadius: '20px',
                  backgroundColor: 'var(--paper)', fontSize: '13.5px',
                  outline: 'none', fontFamily: 'var(--font-sans)',
                  transition: 'border-color 0.2s', color: 'var(--ink-900)',
                }}
                onFocus={e => (e.target.style.borderColor = 'var(--wine-700, #8b2438)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
              <MentionDropdown
                isOpen={isReplyMentionOpen}
                suggestions={replyMentionSuggestions}
                activeIndex={replyMentionActiveIndex}
                isLoading={isReplyMentionLoading}
                onSelect={selectReplyMentionUser}
                style={{ bottom: '100%', left: 0, marginBottom: '6px' }}
              />
              <button
                type="submit"
                disabled={!replyText.trim() || isSubmittingReply}
                style={{
                  padding: '7px 16px', borderRadius: '20px',
                  backgroundColor: replyText.trim() ? 'var(--wine-700, #8b2438)' : 'var(--paper-300)',
                  color: replyText.trim() ? '#fff' : 'var(--ink-400)',
                  border: 'none', cursor: replyText.trim() ? 'pointer' : 'default',
                  fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-sans)',
                  transition: 'all 0.15s',
                }}
              >
                {isSubmittingReply ? 'â€¦' : 'Post'}
              </button>
            </div>
          </form>
        )}

        {/* Nested Replies */}
        {replies.length > 0 && (
          <div style={{
            marginTop: '8px',
            paddingLeft: '12px',
            borderLeft: '2px solid var(--border)',
          }}>
            {visibleReplies.map(reply => (
              <CommentItem
                key={reply.id}
                comment={reply}
                isReply={true}
                currentUser={currentUser}
                postId={postId}
              />
            ))}
            {hiddenCount > 0 && !showAllReplies && (
              <button
                onClick={() => setShowAllReplies(true)}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--wine-700, #8b2438)', fontWeight: 700, fontSize: '12.5px',
                  cursor: 'pointer', padding: '6px 0', fontFamily: 'var(--font-sans)',
                }}
              >
                â†³ View {hiddenCount} more {hiddenCount === 1 ? 'reply' : 'replies'}
              </button>
            )}
            {showAllReplies && replies.length > REPLIES_TO_SHOW && (
              <button
                onClick={() => setShowAllReplies(false)}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--ink-500)', fontWeight: 700, fontSize: '12.5px',
                  cursor: 'pointer', padding: '6px 0', fontFamily: 'var(--font-sans)',
                }}
              >
                â†‘ Hide replies
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// â”€â”€ CommentSection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CommentSection: React.FC<CommentSectionProps> = ({
  postId, currentUser, highlightCommentId, onCommentCountChange,
}) => {
  const { features } = useConfig();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const commentInputRef = useRef<HTMLInputElement>(null);
  const {
    isOpen: isCommentMentionOpen,
    suggestions: commentMentionSuggestions,
    activeIndex: commentMentionActiveIndex,
    isLoading: isCommentMentionLoading,
    checkForMention: checkCommentMention,
    handleKeyDown: handleCommentMentionKeyDown,
    selectUser: selectCommentMentionUser,
  } = useMentionAutocomplete(newComment, setNewComment, commentInputRef);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const highlightedRef = useRef<HTMLDivElement | null>(null);

  const loadComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/social/posts/${postId}/comments`);
      setComments(res.data.data || []);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => { loadComments(); }, [loadComments]);

  useEffect(() => {
    if (highlightCommentId && comments.length > 0 && highlightedRef.current) {
      setTimeout(() => highlightedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
    }
  }, [highlightCommentId, comments]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await api.post(`/social/posts/${postId}/comments`, { content: newComment.trim() });
      const comment = res.data.data;
      // Enrich with current user info in case backend doesn't return author details
      const enriched: Comment = {
        ...comment,
        author: comment.author || {
          id: currentUser?.id,
          username: currentUser?.username,
          profilePicture: currentUser?.profilePicture,
        } as any,
      };
      setComments(prev => [enriched, ...prev]);
      setNewComment('');
      if (onCommentCountChange) onCommentCountChange(comments.length + 1);
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplyAdded = (parentId: string, reply: Comment) => {
    const enriched: Comment = {
      ...reply,
      author: reply.author || {
        id: currentUser?.id,
        username: currentUser?.username,
        profilePicture: currentUser?.profilePicture,
      } as any,
    };
    setComments(prev => prev.map(c =>
      c.id === parentId
        ? { ...c, replies: [...(c.replies || []), enriched] }
        : c
    ));
  };

  return (
    <div style={{ marginTop: '8px' }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        marginBottom: '16px', paddingTop: '16px',
        borderTop: '2px solid var(--border)',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <h3 style={{
          margin: 0, fontSize: '15px', fontWeight: 700,
          color: 'var(--ink-800)', fontFamily: 'var(--font-sans)',
        }}>
          {isLoading ? 'Comments' : comments.length > 0 ? `${comments.length} Comment${comments.length !== 1 ? 's' : ''}` : 'Comments'}
        </h3>
      </div>

      {/* Comment input */}
      {!features.commenting ? (
        <div style={{
          padding: '14px 18px',
          backgroundColor: 'var(--paper-200)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          color: 'var(--ink-600)',
          fontSize: '13.5px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontStyle: 'italic',
        }}>
          <span role="img" aria-label="Closed">🔒</span>
          <span>Dialogue & marginalia replies are temporarily paused by platform administrators.</span>
        </div>
      ) : currentUser ? (
        <form onSubmit={handleSubmitComment} style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <Avatar username={currentUser.username} profilePicture={currentUser.profilePicture} size={38} />
            <div style={{
              position: 'relative',
              flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 6px 6px 16px',
              backgroundColor: 'var(--paper-200)',
              borderRadius: '24px',
              border: '1.5px solid var(--border)',
            }}>
              <input
                ref={commentInputRef}
                type="text"
                value={newComment}
                onChange={e => {
                  setNewComment(e.target.value);
                  checkCommentMention();
                }}
                onKeyUp={checkCommentMention}
                onClick={checkCommentMention}
                onKeyDown={e => {
                  if (handleCommentMentionKeyDown(e)) return;
                }}
                placeholder="Add a comment…"
                disabled={isSubmitting}
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  fontSize: '14.5px', color: 'var(--ink-900)', fontFamily: 'var(--font-sans)',
                }}
              />
              <MentionDropdown
                isOpen={isCommentMentionOpen}
                suggestions={commentMentionSuggestions}
                activeIndex={commentMentionActiveIndex}
                isLoading={isCommentMentionLoading}
                onSelect={selectCommentMentionUser}
                style={{ bottom: '100%', left: 0, marginBottom: '8px' }}
              />
              <button
                type="submit"
                disabled={!newComment.trim() || isSubmitting}
                style={{
                  padding: '7px 18px', borderRadius: '20px',
                  backgroundColor: newComment.trim() ? 'var(--wine-700, #8b2438)' : 'transparent',
                  color: newComment.trim() ? '#fff' : 'var(--ink-400)',
                  border: 'none', cursor: newComment.trim() ? 'pointer' : 'default',
                  fontSize: '13.5px', fontWeight: 700, fontFamily: 'var(--font-sans)',
                  transition: 'all 0.2s', whiteSpace: 'nowrap',
                }}
              >
                {isSubmitting ? '…' : 'Post'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <p style={{ color: 'var(--ink-500)', fontSize: '14px', marginBottom: '16px', fontFamily: 'var(--font-sans)' }}>
          <Link to="/login" style={{ color: 'var(--wine-700, #8b2438)', fontWeight: 700 }}>Log in</Link> to leave a comment.
        </p>
      )}

      {/* Comments list */}
      <div>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', gap: '10px', opacity: 1 - i * 0.25 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'var(--paper-300)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 14, width: '30%', backgroundColor: 'var(--paper-300)', borderRadius: 6, marginBottom: 8 }} />
                  <div style={{ height: 14, width: '75%', backgroundColor: 'var(--paper-300)', borderRadius: 6 }} />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '32px 16px',
            color: 'var(--ink-500)', fontSize: '14px',
            fontFamily: 'var(--font-sans)', fontStyle: 'italic',
          }}>
            No comments yet â€” be the first to share your thoughts!
          </div>
        ) : (
          <div>
            {comments.map(comment => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUser={currentUser}
                postId={postId}
                isHighlighted={highlightCommentId === comment.id}
                highlightRef={highlightCommentId === comment.id ? highlightedRef : undefined}
                onReplyAdded={handleReplyAdded}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentSection;
