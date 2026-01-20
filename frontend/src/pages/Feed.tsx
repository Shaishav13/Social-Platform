import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Post } from '../types';
import PostCard from '../components/Social/PostCard';
import api from '../services/api';

const Feed: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const { user } = useAuth();

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async (pageNum = 1, append = false) => {
    try {
      if (!append) setIsLoading(true);
      else setIsLoadingMore(true);

      const response = await api.get(`/content/feed?page=${pageNum}&limit=10`);
      const newPosts = response.data.posts || [];
      
      if (append) {
        setPosts(prev => [...prev, ...newPosts]);
      } else {
        setPosts(newPosts);
      }
      
      setHasMore(newPosts.length === 10);
      setPage(pageNum);
      setError('');
    } catch (err: any) {
      console.error('Failed to load feed:', err);
      setError('Failed to load feed. Please try again.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handlePostUpdate = (updatedPost: Post) => {
    setPosts(prev => 
      prev.map(post => 
        post.id === updatedPost.id ? updatedPost : post
      )
    );
  };

  const handlePostDelete = (deletedPostId: string) => {
    setPosts(prev => prev.filter(post => post.id !== deletedPostId));
  };

  const loadMore = () => {
    if (!isLoadingMore && hasMore) {
      loadFeed(page + 1, true);
    }
  };

  if (isLoading) {
    return (
      <div className="feed-container">
        <div className="loading-spinner">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="feed-container">
      {/* Feed Content */}
      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button 
            onClick={() => loadFeed()}
            className="btn btn-primary btn-sm"
          >
            Try Again
          </button>
        </div>
      )}

      {posts.length > 0 ? (
        <>
          <div className="posts-list">
            {posts.map(post => (
              <PostCard 
                key={post.id}
                post={post}
                currentUser={user || undefined}
                onPostUpdate={handlePostUpdate}
                onPostDelete={handlePostDelete}
              />
            ))}
          </div>

          {hasMore && (
            <div className="load-more-section">
              <button 
                onClick={loadMore}
                disabled={isLoadingMore}
                className="btn btn-ghost"
              >
                {isLoadingMore ? 'Loading...' : 'Load more posts'}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">📷</div>
          <h3>No posts yet</h3>
          <p>When you follow people, you'll see their posts here.</p>
          <div className="empty-feed-actions">
            <Link to="/explore" className="btn btn-primary">
              Find people to follow
            </Link>
            <Link to="/create-post" className="btn btn-secondary">
              Create your first post
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default Feed;