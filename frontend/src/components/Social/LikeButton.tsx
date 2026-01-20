import { useState } from 'react';
import api from '../../services/api';

interface LikeButtonProps {
  postId: string;
  isLiked: boolean;
  likeCount: number;
  onLikeChange?: (isLiked: boolean, newCount: number) => void;
}

const LikeButton: React.FC<LikeButtonProps> = ({ 
  postId, 
  isLiked: initialIsLiked, 
  likeCount: initialLikeCount,
  onLikeChange 
}) => {
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isLoading, setIsLoading] = useState(false);

  const handleLikeToggle = async () => {
    if (isLoading) return;

    setIsLoading(true);
    const newIsLiked = !isLiked;
    const newLikeCount = newIsLiked ? likeCount + 1 : likeCount - 1;

    // Optimistic update
    setIsLiked(newIsLiked);
    setLikeCount(newLikeCount);

    try {
      if (newIsLiked) {
        await api.post(`/social/posts/${postId}/like`);
      } else {
        await api.delete(`/social/posts/${postId}/like`);
      }

      // Notify parent component
      if (onLikeChange) {
        onLikeChange(newIsLiked, newLikeCount);
      }
    } catch (error) {
      // Revert optimistic update on error
      setIsLiked(isLiked);
      setLikeCount(likeCount);
      console.error('Failed to toggle like:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button 
      className={`action-btn like-btn ${isLiked ? 'liked' : ''}`}
      onClick={handleLikeToggle}
      disabled={isLoading}
    >
      <span className="action-icon">
        {isLiked ? '❤️' : '🤍'}
      </span>
      <span className="action-count">{likeCount}</span>
      <span className="action-text">Like</span>
    </button>
  );
};

export default LikeButton;