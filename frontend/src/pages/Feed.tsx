import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Post } from '../types';
import { PostCard, ComposeLetter, SkeletonLoader } from '../components/wren';
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
    } catch (err: unknown) {
      console.error('Failed to load feed:', err);
      setError('Your letters couldn’t be loaded. Check your connection and try again.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handlePostUpdate = (updatedPost: Post) => {
    setPosts(prev =>
      prev.map(post => (post.id === updatedPost.id ? updatedPost : post))
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

  return (
    <div className="wren-feed-view">
      {/* Editorial Composer at head of feed */}
      <ComposeLetter onPostCreated={() => loadFeed(1, false)} />

      {/* Error alert in active plain language */}
      {error && (
        <div className="wren-error" role="alert">
          <span>{error}</span>
          <button
            onClick={() => loadFeed(1, false)}
            style={{
              marginLeft: '12px',
              background: 'none',
              border: 'none',
              textDecoration: 'underline',
              cursor: 'pointer',
              color: 'inherit',
              fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state: skeleton matching real serif line-height and varying line widths */}
      {isLoading ? (
        <SkeletonLoader count={3} />
      ) : posts.length > 0 ? (
        <div className="wren-posts-flow">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={user || undefined}
              onPostUpdate={handlePostUpdate}
              onPostDelete={handlePostDelete}
            />
          ))}

          {hasMore && (
            <div style={{ padding: '24px 0', textAlign: 'center' }}>
              <button
                onClick={loadMore}
                disabled={isLoadingMore}
                className="wren-btn wren-btn-secondary"
                style={{ width: '100%' }}
              >
                {isLoadingMore ? 'Loading...' : 'Read more entries'}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Empty Feed state per Blueprint §3.1 */
        <div className="wren-empty-state">
          <h2 className="wren-empty-title">Nothing new since your last visit.</h2>
          <Link to="/explore" className="wren-empty-link">
            Find people to follow.
          </Link>
        </div>
      )}
    </div>
  );
};

export default Feed;