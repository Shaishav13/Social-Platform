import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Post, User } from '../types';
import PostCard from '../components/Social/PostCard';
import { Icon } from '../components/ui';
import api from '../services/api';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const UserCard: React.FC<{ user: User; currentUserId?: string }> = ({ user, currentUserId }) => (
  <Link to={`/profile/${user.id}`} className="search-user-card">
    <div className="search-user-avatar-wrap">
      {user.profilePicture ? (
        <img src={user.profilePicture} alt={user.username} className="search-user-avatar" />
      ) : (
        <div className="search-user-avatar-placeholder">
          {user.username.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
    <div className="search-user-info">
      <span className="search-user-name">{user.username}</span>
      {user.bio && <span className="search-user-bio">{user.bio}</span>}
    </div>
    <span className="search-user-arrow"><Icon name="chevron-right" size={16} /></span>
  </Link>
);

const SkeletonUserCard = () => (
  <div className="search-user-card search-skeleton">
    <div className="search-skeleton-avatar" />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div className="search-skeleton-line" style={{ width: '40%' }} />
      <div className="search-skeleton-line" style={{ width: '70%', opacity: 0.5 }} />
    </div>
  </div>
);

const Search: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const initialQuery = searchParams.get('q') || '';
  const [inputValue, setInputValue] = useState(initialQuery);
  const debouncedQuery = useDebounce(inputValue.trim(), 350);

  const [posts, setPosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'posts'>('users');

  const { user: currentUser } = useAuth();

  // Sync URL param → input on mount only
  useEffect(() => {
    if (initialQuery) {
      setInputValue(initialQuery);
    }
    inputRef.current?.focus();
  }, []);

  // Perform search whenever debounced query changes
  useEffect(() => {
    if (debouncedQuery) {
      setSearchParams({ q: debouncedQuery }, { replace: true });
      performSearch(debouncedQuery);
    } else if (!debouncedQuery && inputValue.trim() === '') {
      setPosts([]);
      setUsers([]);
      setError('');
      setSearchParams({}, { replace: true });
    }
  }, [debouncedQuery]);

  // Auto-switch to tab with results
  useEffect(() => {
    if (!isLoading) {
      if (users.length > 0) setActiveTab('users');
      else if (posts.length > 0) setActiveTab('posts');
    }
  }, [users, posts, isLoading]);

  const performSearch = useCallback(async (q: string) => {
    setIsLoading(true);
    setError('');

    try {
      const [postsRes, usersRes] = await Promise.all([
        api.get(`/content/search/posts?q=${encodeURIComponent(q)}`),
        api.get(`/profile/search/users?q=${encodeURIComponent(q)}`),
      ]);

      setPosts(postsRes.data.results || []);
      setUsers(usersRes.data.data || []);
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handlePostUpdate = (updatedPost: Post) => {
    setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
  };

  const hasQuery = inputValue.trim().length > 0;
  const hasResults = users.length > 0 || posts.length > 0;

  return (
    <div className="search-page-v2">
      {/* Top Search Bar */}
      <div className="search-topbar">
        <button
          className="search-back-btn"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <Icon name="chevron-left" size={22} />
        </button>
        <div className="search-input-wrap">
          <Icon name="search" size={18} className="search-input-icon" />
          <input
            ref={inputRef}
            type="search"
            className="search-input-v2"
            placeholder="Search people, posts..."
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            aria-label="Search"
            autoComplete="off"
          />
          {hasQuery && (
            <button
              className="search-clear-btn"
              onClick={() => setInputValue('')}
              aria-label="Clear search"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="search-body">
        {/* Empty state: no query */}
        {!hasQuery && (
          <div className="search-empty-v2">
            <div className="search-empty-icon-wrap">
              <Icon name="search" size={36} />
            </div>
            <h3>Find people &amp; posts</h3>
            <p>Search by username, keyword, or topic to discover content and creators.</p>
          </div>
        )}

        {/* Query: loading state */}
        {hasQuery && isLoading && (
          <div style={{ padding: '0 0 24px' }}>
            <div className="search-tabs-v2">
              <button className="search-tab-v2 active">
                <Icon name="users" size={15} /> People
              </button>
              <button className="search-tab-v2">
                <Icon name="dashboard" size={15} /> Posts
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
              {[1, 2, 3, 4].map(i => <SkeletonUserCard key={i} />)}
            </div>
          </div>
        )}

        {/* Query: results */}
        {hasQuery && !isLoading && !error && (
          <>
            <div className="search-tabs-v2">
              <button
                className={`search-tab-v2 ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                <Icon name="users" size={15} />
                People
                {users.length > 0 && <span className="search-tab-count">{users.length}</span>}
              </button>
              <button
                className={`search-tab-v2 ${activeTab === 'posts' ? 'active' : ''}`}
                onClick={() => setActiveTab('posts')}
              >
                <Icon name="dashboard" size={15} />
                Posts
                {posts.length > 0 && <span className="search-tab-count">{posts.length}</span>}
              </button>
            </div>

            {activeTab === 'users' && (
              <div className="search-results-section">
                {users.length > 0 ? (
                  users.map(u => <UserCard key={u.id} user={u} currentUserId={currentUser?.id} />)
                ) : (
                  <div className="search-no-results">
                    <Icon name="users" size={40} />
                    <p>No people found for <strong>"{debouncedQuery}"</strong></p>
                    <span>Try a different name or spelling.</span>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'posts' && (
              <div className="search-results-section">
                {posts.length > 0 ? (
                  posts.map(p => (
                    <PostCard
                      key={p.id}
                      post={p}
                      currentUser={currentUser || undefined}
                      onPostUpdate={handlePostUpdate}
                    />
                  ))
                ) : (
                  <div className="search-no-results">
                    <Icon name="dashboard" size={40} />
                    <p>No posts found for <strong>"{debouncedQuery}"</strong></p>
                    <span>Try different keywords.</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Error state */}
        {hasQuery && error && (
          <div className="search-error-state">
            <Icon name="shield" size={40} />
            <p>{error}</p>
            <button
              className="wren-btn wren-btn-secondary"
              onClick={() => performSearch(debouncedQuery)}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;