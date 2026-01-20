import { useState } from 'react';
import api from '../../services/api';

interface ShareButtonProps {
  postId: string;
  shareCount: number;
  onShareChange?: (newCount: number) => void;
}

const ShareButton: React.FC<ShareButtonProps> = ({ 
  postId, 
  shareCount: initialShareCount,
  onShareChange 
}) => {
  const [shareCount, setShareCount] = useState(initialShareCount);
  const [isLoading, setIsLoading] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);

  const handleShare = async () => {
    if (isLoading) return;

    setIsLoading(true);
    const newShareCount = shareCount + 1;

    // Optimistic update
    setShareCount(newShareCount);

    try {
      await api.post(`/social/posts/${postId}/share`);

      // Notify parent component
      if (onShareChange) {
        onShareChange(newShareCount);
      }
    } catch (error) {
      // Revert optimistic update on error
      setShareCount(shareCount);
      console.error('Failed to share post:', error);
    } finally {
      setIsLoading(false);
      setShowShareMenu(false);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out this post',
          url: `${window.location.origin}/post/${postId}`,
        });
      } catch (error) {
        console.log('Share cancelled or failed');
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(`${window.location.origin}/post/${postId}`);
        alert('Link copied to clipboard!');
      } catch (error) {
        console.error('Failed to copy link:', error);
      }
    }
    setShowShareMenu(false);
  };

  return (
    <div className="share-container">
      <button 
        className="action-btn share-btn"
        onClick={() => setShowShareMenu(!showShareMenu)}
        disabled={isLoading}
      >
        <span className="action-icon">🔗</span>
        <span className="action-count">{shareCount}</span>
        <span className="action-text">Share</span>
      </button>

      {showShareMenu && (
        <div className="share-menu">
          <button 
            className="share-option"
            onClick={handleShare}
            disabled={isLoading}
          >
            📢 Share to Feed
          </button>
          <button 
            className="share-option"
            onClick={handleNativeShare}
          >
            📋 Copy Link
          </button>
        </div>
      )}
    </div>
  );
};

export default ShareButton;