import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import type { Post } from '../../types';

export const MarginNotes: React.FC = () => {
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadMarginContext();
  }, []);

  const loadMarginContext = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/content/feed?limit=6&following=false');
      const posts = res.data.posts || [];
      // Sort by engagement or take recent
      setTrendingPosts(posts.slice(0, 4));
    } catch {
      // Quiet fallback
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <aside className="wren-margin" role="complementary" aria-label="Margin Notes">
      <div className="wren-margin-section">
        <div className="wren-margin-label">Margin Notes · Context</div>
        <p className="type-ui-m" style={{ marginBottom: '16px', lineHeight: 1.5 }}>
          Wren treats each post as correspondence — written with intent, read with pause.
        </p>
      </div>

      <div className="wren-margin-section">
        <div className="wren-margin-label">Trending Threads</div>
        {isLoading ? (
          <div className="type-ui-m" style={{ color: 'var(--ink-300)' }}>
            Listening...
          </div>
        ) : trendingPosts.length > 0 ? (
          trendingPosts.map(post => {
            const title = post.content ? post.content.slice(0, 70) : 'Untitled letter';
            return (
              <div key={post.id} className="wren-margin-thread">
                <Link to={`/post/${post.id}`} className="wren-margin-thread-title">
                  {title}...
                </Link>
                <div className="wren-margin-thread-meta">
                  {post.author?.username ? `@${post.author.username}` : 'Anonymous'} ·{' '}
                  {post.likeCount || 0} likes · {post.commentCount || 0} replies
                </div>
              </div>
            );
          })
        ) : (
          <div className="type-ui-m" style={{ color: 'var(--ink-300)' }}>
            No recent active threads.
          </div>
        )}
      </div>

      <div className="wren-margin-section">
        <div className="wren-margin-label">Navigation Footnote</div>
        <div className="type-ui-s" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Link to="/explore" style={{ color: 'var(--wine-700)' }}>
            Discover letters & thinkers →
          </Link>
          <span style={{ color: 'var(--ink-300)' }}>
            UdtaBirdie · Wren Editorial Engine
          </span>
        </div>
      </div>
    </aside>
  );
};
