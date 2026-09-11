import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { User, Post } from '../types';
import SearchBar from '../components/Search/SearchBar';
import { PostCard, SkeletonLoader } from '../components/wren';
import { Icon } from '../components/ui';
import api from '../services/api';

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const Explore: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery.trim(), 350);
  const [searchResults, setSearchResults] = useState<{
    users: User[];
    posts: Post[];
  }>({ users: [], posts: [] });
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'trending' | 'users' | 'posts'>('trending');
  
  const { user } = useAuth();

  useEffect(() => {
    loadExploreContent();
  }, []);

  useEffect(() => {
    if (debouncedQuery) {
      performSearch(debouncedQuery);
    } else {
      setSearchResults({ users: [], posts: [] });
      setActiveTab('trending');
    }
  }, [debouncedQuery]);

  const loadExploreContent = async () => {
    try {
      setIsLoading(true);
      
      // Load all posts from the feed and sort by engagement (likes + comments)
      const feedResponse = await api.get('/content/feed?limit=100&following=false');
      const allPosts = feedResponse.data.posts || [];
      
      // Sort posts by engagement (likes + comments) to get truly trending posts
      const sortedTrendingPosts = allPosts.sort((a: Post, b: Post) => {
        const aEngagement = (a.likeCount || 0) + (a.commentCount || 0);
        const bEngagement = (b.likeCount || 0) + (b.commentCount || 0);
        return bEngagement - aEngagement;
      });
      
      // Take top 20 most engaged posts as trending
      setTrendingPosts(sortedTrendingPosts.slice(0, 20));
      
      // For suggested users, we'll get recent users from the feed posts
      try {
        // Extract unique authors from all posts and get their profile info
        const authorIds = [...new Set(allPosts.map((post: Post) => post.authorId))];
        const userPromises = authorIds.slice(0, 10).map(async (authorId) => {
          try {
            const userResponse = await api.get(`/profile/users/${authorId}`);
            return userResponse.data.user;
          } catch {
            return null;
          }
        });
        
        const users = (await Promise.all(userPromises)).filter(user => user !== null);
        setSuggestedUsers(users);
      } catch {
        console.log('No suggested users available');
        setSuggestedUsers([]);
      }
    } catch (error) {
      console.error('Failed to load explore content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const performSearch = useCallback(async (q: string) => {
    if (!q) return;
    
    try {
      setIsSearching(true);
      
      const [postsRes, usersRes] = await Promise.all([
        api.get(`/content/search/posts?q=${encodeURIComponent(q)}`),
        api.get(`/profile/search/users?q=${encodeURIComponent(q)}`),
      ]);

      const foundPosts: Post[] = postsRes.data.results || [];
      const foundUsers: User[] = usersRes.data.data || [];

      setSearchResults({ users: foundUsers, posts: foundPosts });
      
      // Auto-switch to most relevant tab
      if (foundUsers.length > 0) {
        setActiveTab('users');
      } else if (foundPosts.length > 0) {
        setActiveTab('posts');
      }
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults({ users: [], posts: [] });
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handlePostUpdate = (updatedPost: Post) => {
    setTrendingPosts(prev => 
      prev.map(post => 
        post.id === updatedPost.id ? updatedPost : post
      )
    );
    setSearchResults(prev => ({
      ...prev,
      posts: prev.posts.map(post => 
        post.id === updatedPost.id ? updatedPost : post
      )
    }));
  };

  const handlePostDelete = (deletedPostId: string) => {
    setTrendingPosts(prev => prev.filter(post => post.id !== deletedPostId));
    setSearchResults(prev => ({
      ...prev,
      posts: prev.posts.filter(post => post.id !== deletedPostId)
    }));
  };

  const isSearchActive = searchQuery.trim().length > 0;
  const hasSearchResults = searchResults.users.length > 0 || searchResults.posts.length > 0;

  if (isLoading) {
    return <SkeletonLoader count={3} />;
  }

  return (
    <div className="explore-page">
      <div className="explore-container-wide">
        {/* Search Section */}
        <div className="explore-search-section">
          <SearchBar
            placeholder="Search users and posts..."
            value={searchQuery}
            onChange={setSearchQuery}
            className="explore-search-bar"
          />
        </div>

        {/* Content Layout */}
        {!isSearchActive ? (
          <div className="explore-layout">
            {/* Main Content - Trending Posts */}
            <div className="explore-main">
              <div className="section-header">
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Icon name="features" size={24} /> Trending Posts</h2>
                <p>Posts with the most likes and comments from the community</p>
              </div>
              
              {trendingPosts.length > 0 ? (
                <div className="posts-container">
                  {trendingPosts.map(post => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUser={user || undefined}
                      onPostUpdate={handlePostUpdate}
                      onPostDelete={handlePostDelete}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon"><Icon name="search" size={48} /></div>
                  <h3>No trending posts</h3>
                  <p>Check back later for trending content.</p>
                </div>
              )}
            </div>

            {/* Sidebar - Suggested Users */}
            <div className="explore-sidebar">
              {suggestedUsers.length > 0 && (
                <div className="suggested-users-widget">
                  <div className="widget-header">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Icon name="users" size={20} /> Suggested for you</h3>
                  </div>
                  <div className="users-list-compact">
                    {suggestedUsers.slice(0, 8).map(suggestedUser => (
                      <div key={suggestedUser.id} className="user-item-compact">
                        <Link to={`/profile/${suggestedUser.id}`} className="user-link-compact">
                          {suggestedUser.profilePicture ? (
                            <img
                              src={suggestedUser.profilePicture}
                              alt={suggestedUser.username}
                              className="user-avatar-compact"
                            />
                          ) : (
                            <div className="user-avatar-placeholder-compact">
                              {suggestedUser.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="user-info-compact">
                            <h4 className="user-username-compact">{suggestedUser.username}</h4>
                            {suggestedUser.bio && (
                              <p className="user-bio-compact">{suggestedUser.bio}</p>
                            )}
                          </div>
                        </Link>
                        <button className="btn btn-primary btn-xs follow-btn-compact">
                          Follow
                        </button>
                      </div>
                    ))}
                  </div>
                  <Link to="/explore?tab=users" className="see-all-link">
                    See all suggestions
                  </Link>
                </div>
              )}
              
              {/* Trending Topics Widget */}
              <div className="trending-topics-widget">
                <div className="widget-header" style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><Icon name="dashboard" size={20} /> Trending Topics</h3>
                </div>
                <div className="trending-topics-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="trending-topic" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="topic-name" style={{ fontWeight: 600, color: 'var(--ink)' }}>#Technology</span>
                    <span className="topic-count" style={{ color: 'var(--ink-400)', fontSize: '13px' }}>1.2K posts</span>
                  </div>
                  <div className="trending-topic" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="topic-name" style={{ fontWeight: 600, color: 'var(--ink)' }}>#Photography</span>
                    <span className="topic-count" style={{ color: 'var(--ink-400)', fontSize: '13px' }}>856 posts</span>
                  </div>
                  <div className="trending-topic" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="topic-name" style={{ fontWeight: 600, color: 'var(--ink)' }}>#Travel</span>
                    <span className="topic-count" style={{ color: 'var(--ink-400)', fontSize: '13px' }}>642 posts</span>
                  </div>
                  <div className="trending-topic" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="topic-name" style={{ fontWeight: 600, color: 'var(--ink)' }}>#Food</span>
                    <span className="topic-count" style={{ color: 'var(--ink-400)', fontSize: '13px' }}>534 posts</span>
                  </div>
                  <div className="trending-topic" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="topic-name" style={{ fontWeight: 600, color: 'var(--ink)' }}>#Art</span>
                    <span className="topic-count" style={{ color: 'var(--ink-400)', fontSize: '13px' }}>423 posts</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ── Search Results ── */
          <div className="explore-search-results">
            {/* Tabs — always show both so user can switch freely */}
            <div className="explore-search-tabs">
              <button
                className={`explore-search-tab ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                <Icon name="users" size={15} />
                <span>People</span>
                {searchResults.users.length > 0 && (
                  <span className="explore-tab-pill">{searchResults.users.length}</span>
                )}
              </button>
              <button
                className={`explore-search-tab ${activeTab === 'posts' ? 'active' : ''}`}
                onClick={() => setActiveTab('posts')}
              >
                <Icon name="dashboard" size={15} />
                <span>Posts</span>
                {searchResults.posts.length > 0 && (
                  <span className="explore-tab-pill">{searchResults.posts.length}</span>
                )}
              </button>
            </div>

            {/* Content */}
            <div className="explore-search-content">
              {/* Loading skeleton */}
              {isSearching && (
                <div className="explore-search-loading">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="search-user-card search-skeleton" style={{ pointerEvents: 'none' }}>
                      <div className="search-skeleton-avatar" />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div className="search-skeleton-line" style={{ width: '40%' }} />
                        <div className="search-skeleton-line" style={{ width: '65%', opacity: 0.5 }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Users Tab */}
              {!isSearching && activeTab === 'users' && (
                <div className="explore-results-section">
                  {searchResults.users.length > 0 ? (
                    searchResults.users.map(searchUser => (
                      <Link
                        key={searchUser.id}
                        to={`/profile/${searchUser.id}`}
                        className="search-user-card"
                      >
                        <div className="search-user-avatar-wrap">
                          {searchUser.profilePicture ? (
                            <img
                              src={searchUser.profilePicture}
                              alt={searchUser.username}
                              className="search-user-avatar"
                            />
                          ) : (
                            <div className="search-user-avatar-placeholder">
                              {searchUser.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="search-user-info">
                          <span className="search-user-name">{searchUser.username}</span>
                          {searchUser.bio && (
                            <span className="search-user-bio">{searchUser.bio}</span>
                          )}
                        </div>
                        <span className="search-user-arrow">
                          <Icon name="chevron-right" size={16} />
                        </span>
                      </Link>
                    ))
                  ) : (
                    <div className="explore-empty-state">
                      <Icon name="users" size={40} />
                      <p>No people found for <strong>"{debouncedQuery}"</strong></p>
                      <span>Try a different name or spelling.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Posts Tab */}
              {!isSearching && activeTab === 'posts' && (
                <div className="explore-results-section">
                  {searchResults.posts.length > 0 ? (
                    searchResults.posts.map(post => (
                      <PostCard
                        key={post.id}
                        post={post}
                        currentUser={user || undefined}
                        onPostUpdate={handlePostUpdate}
                        onPostDelete={handlePostDelete}
                      />
                    ))
                  ) : (
                    <div className="explore-empty-state">
                      <Icon name="dashboard" size={40} />
                      <p>No posts found for <strong>"{debouncedQuery}"</strong></p>
                      <span>Try different keywords.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Explore;