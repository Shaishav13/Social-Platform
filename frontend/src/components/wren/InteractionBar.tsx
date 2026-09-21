import React, { useState } from 'react';
import { Icon } from '../ui';

interface InteractionBarProps {
  postId: string;
  likeCount: number;
  commentCount: number;
  isLiked?: boolean;
  isSaved?: boolean;
  isReposted?: boolean;
  repostCount?: number;
  allowReposts?: boolean;
  onLikeToggle?: () => void;
  onCommentClick?: () => void;
  onRepostClick?: () => void;
  onSaveClick?: () => void;
}

export const InteractionBar: React.FC<InteractionBarProps> = ({
  likeCount,
  commentCount,
  isLiked = false,
  isSaved = false,
  isReposted = false,
  repostCount = 0,
  allowReposts = false,
  onLikeToggle,
  onCommentClick,
  onRepostClick,
  onSaveClick,
}) => {
  const [localLiked, setLocalLiked] = useState(isLiked);
  const [localLikeCount, setLocalLikeCount] = useState(likeCount);
  const [localSaved, setLocalSaved] = useState(isSaved);
  const [localReposted, setLocalReposted] = useState(isReposted);
  const [localRepostCount, setLocalRepostCount] = useState(repostCount);

  // Sync state if props change
  React.useEffect(() => {
    setLocalLiked(isLiked);
    setLocalLikeCount(likeCount);
    setLocalSaved(isSaved);
    setLocalReposted(isReposted);
    setLocalRepostCount(repostCount);
  }, [isLiked, likeCount, isSaved, isReposted, repostCount]);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalLiked(prev => {
      const next = !prev;
      setLocalLikeCount(c => (next ? c + 1 : Math.max(0, c - 1)));
      return next;
    });
    onLikeToggle?.();
  };

  const handleRepost = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalReposted(prev => {
      const next = !prev;
      setLocalRepostCount(c => (next ? c + 1 : Math.max(0, c - 1)));
      return next;
    });
    onRepostClick?.();
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalSaved(prev => !prev);
    onSaveClick?.();
  };

  return (
    <div className="wren-interaction-bar post-actions" role="toolbar" aria-label="Post actions">
      {/* 1. Reply: hide '0' count when count === 0 */}
      <button
        type="button"
        onClick={onCommentClick}
        className="wren-action-item reply-action comment-btn"
        title="Reply"
        aria-label={`Reply to post. ${commentCount > 0 ? `${commentCount} replies` : ''}`}
      >
        <Icon name="reply" size={17} className="wren-action-icon" />
        {commentCount > 0 && <span className="type-ui-s">{commentCount}</span>}
      </button>

      {/* 2. Repost: moss hover / active - only if author enabled reposting */}
      {allowReposts && (
        <button
          type="button"
          onClick={handleRepost}
          className={`wren-action-item repost-action share-btn ${localReposted ? 'is-active' : ''}`}
          title={localReposted ? 'Undo repost' : 'Repost'}
          aria-label={`Repost. ${localRepostCount > 0 ? `${localRepostCount} reposts` : ''}`}
        >
          <Icon name="repost" size={17} className="wren-action-icon" />
          {localRepostCount > 0 && <span className="type-ui-s">{localRepostCount}</span>}
        </button>
      )}

      {/* 3. Like: wine-700 active with 180ms ease-out scale */}
      <button
        type="button"
        onClick={handleLike}
        className={`wren-action-item like-action like-btn ${localLiked ? 'is-active' : ''}`}
        title={localLiked ? 'Unlike' : 'Like'}
        aria-label={`Like post. ${localLikeCount > 0 ? `${localLikeCount} likes` : ''}`}
      >
        <Icon name="like" size={17} isFilled={localLiked} className="wren-action-icon" />
        {localLikeCount > 0 && <span className="type-ui-s">{localLikeCount}</span>}
      </button>

      {/* 4. Save: ochre-600 active */}
      <button
        type="button"
        onClick={handleSave}
        className={`wren-action-item save-action ${localSaved ? 'is-active' : ''}`}
        title={localSaved ? 'Remove from saved' : 'Save'}
        aria-label="Save post"
      >
        <Icon name="save" size={17} isFilled={localSaved} className="wren-action-icon" />
      </button>
    </div>
  );
};
