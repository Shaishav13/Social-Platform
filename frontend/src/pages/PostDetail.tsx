import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PostCard, SkeletonLoader } from '../components/wren';
import CommentSection from '../components/Social/CommentSection';
import type { Post } from '../types';
import api from '../services/api';

const PostDetail: React.FC = () => {
  const { postId } = useParams<{ postId: string }>();
  const [searchParams] = useSearchParams();
  const commentId = searchParams.get('comment');
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!postId) {
      navigate('/feed');
      return;
    }

    loadPost();
  }, [postId, isAuthenticated, navigate]);

  const loadPost = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // First try to get the post directly
      let response;
      try {
        response = await api.get(`/content/posts/${postId}`);
      } catch (error: any) {
        // If 404, this might be a comment ID instead of post ID
        // Try to find the post by searching through comments
        if (error.response?.status === 404) {
          console.log('Post not found directly, might be a comment ID. Searching...');
          
          // This is a fallback for old notifications that might have comment IDs as post IDs
          // In practice, this should rarely happen with the fixed notification system
          try {
            const feedResponse = await api.get('/content/posts');
            const posts = feedResponse.data.data || [];
            
            for (const feedPost of posts) {
              try {
                const commentsResponse = await api.get(`/social/posts/${feedPost.id}/comments`);
                const comments = commentsResponse.data.data || [];
                
                if (comments.some((c: any) => c.id === postId)) {
                  // Found the post that contains this comment
                  response = { data: { success: true, data: feedPost } };
                  // Update the URL to show the correct post with comment highlighted
                  window.history.replaceState(null, '', `/post/${feedPost.id}?comment=${postId}`);
                  break;
                }
              } catch (commentError) {
                // Skip posts without comments
              }
            }
          } catch (searchError) {
            console.error('Failed to search for post:', searchError);
          }
        }
        
        if (!response) {
          throw error; // Re-throw the original error if we couldn't find the post
        }
      }

      if (response.data.success) {
        setPost(response.data.data);
      } else {
        setError('Post not found');
      }
    } catch (error: any) {
      console.error('Error loading post:', error);
      if (error.response?.status === 404) {
        setError('Post not found');
      } else {
        setError('Failed to load post');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostUpdate = (updatedPost: Post) => {
    setPost(updatedPost);
  };

  const handlePostDelete = () => {
    navigate('/feed');
  };

  if (isLoading) {
    return <SkeletonLoader count={2} />;
  }

  if (error || !post) {
    return (
      <div className="wren-empty-state">
        <h2 className="wren-empty-title">Letter not found</h2>
        <p className="type-ui-m" style={{ maxWidth: '48ch' }}>
          {error || 'This letter doesn’t exist or may have been removed by its author.'}
        </p>
        <button 
          onClick={() => navigate('/feed')}
          className="wren-btn wren-btn-secondary"
        >
          Return to Feed
        </button>
      </div>
    );
  }

  return (
    <div className="post-detail-page">
      <div className="post-detail-container">
        <div className="post-detail-header">
          <button 
            onClick={() => navigate(-1)}
            className="back-button"
            title="Go back"
          >
            ← Back
          </button>
          <h2>Post Details</h2>
        </div>

        <div className="post-detail-content">
          <PostCard 
            post={post}
            onUpdate={handlePostUpdate}
            onDelete={handlePostDelete}
            isDetailView={true}
          />
          
          <div className="post-comments-section">
            <CommentSection 
              postId={post.id}
              highlightCommentId={commentId}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostDetail;