import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { User, Post } from '../types';
import SearchBar from '../components/Search/SearchBar';
import { PostCard, SkeletonLoader } from '../components/wren';
import api from '../services/api';

const Explore: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
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
    if (searchQuery.trim()) {
      performSearch();
    } else {
      setSearchResults({ users: [], posts: [] });
      setActiveTab('trending');
    }
  }, [searchQuery]);

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

  const performSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setIsSearching(true);
      
      // Search in posts from the main feed
      const feedResponse = await api.get('/content/feed?limit=200&following=false');
      const allPosts = feedResponse.data.posts || [];
      
      // Filter posts that match the search query
      const matchingPosts = allPosts.filter((post: Post) => 
        post.content?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      // Get all unique author IDs from matching posts
      const authorIds = [...new Set(matchingPosts.map((post: Post) => post.authorId))];
      
      // Get user profiles for authors and also search by username
      const userPromises = authorIds.slice(0, 20).map(async (authorId) => {
        try {
          const userResponse = await api.get(`/profile/users/${authorId}`);
          const user = userResponse.data.user;
          // Also check if username matches search query
          if (user.username?.toLowerCase().includes(searchQuery.toLowerCase())) {
            return user;
          }
          return null;
        } catch {
          return null;
        }
      });
      
      const matchingUsers = (await Promise.all(userPromises)).filter(user => user !== null);
      
      setSearchResults({
        users: matchingUsers,
        posts: matchingPosts.slice(0, 20)
      });
      
      // Set active tab based on results
      if (matchingUsers.length > 0) {
        setActiveTab('users');
      } else if (matchingPosts.length > 0) {
        setActiveTab('posts');
      }
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults({ users: [], posts: [] });
    } finally {
      setIsSearching(false);
    }
  };

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
                <h2>🔥 Trending Posts</h2>
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
                  <div className="empty-state-icon">📈</div>
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
                    <h3>👥 Suggested for you</h3>
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
                <div className="widget-header">
                  <h3>📊 Trending Topics</h3>
                </div>
                <div className="trending-topics-list">
                  <div className="trending-topic">
                    <span className="topic-name">#Technology</span>
                    <span className="topic-count">1.2K posts</span>
                  </div>
                  <div className="trending-topic">
                    <span className="topic-name">#Photography</span>
                    <span className="topic-count">856 posts</span>
                  </div>
                  <div className="trending-topic">
                    <span className="topic-name">#Travel</span>
                    <span className="topic-count">642 posts</span>
                  </div>
                  <div className="trending-topic">
                    <span className="topic-name">#Food</span>
                    <span className="topic-count">534 posts</span>
                  </div>
                  <div className="trending-topic">
                    <span className="topic-name">#Art</span>
                    <span className="topic-count">423 posts</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="search-results-layout">
            {/* Search Results Tabs */}
            <div className="explore-tabs">
              {(searchResults.users.length > 0) && (
                <button
                  className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                  onClick={() => setActiveTab('users')}
                >
                  Users ({searchResults.users.length})
                </button>
              )}
              {(searchResults.posts.length > 0) && (
                <button
                  className={`tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
                  onClick={() => setActiveTab('posts')}
                >
                  Posts ({searchResults.posts.length})
                </button>
              )}
            </div>

            {/* Search Results Content */}
            <div className="search-results-content">
              {isSearching && (
                <div className="loading-state">
                  <div className="loading-spinner">Searching...</div>
                </div>
              )}

              {activeTab === 'users' && (
                <div className="search-results-users">
                  {searchResults.users.length > 0 ? (
                    <div className="users-list">
                      {searchResults.users.map(searchUser => (
                        <div key={searchUser.id} className="user-result">
                          <Link to={`/profile/${searchUser.id}`} className="user-result-link">
                            {searchUser.profilePicture ? (
                              <img
                                src={searchUser.profilePicture}
                                alt={searchUser.username}
                                className="user-result-avatar"
                              />
                            ) : (
                              <div className="user-result-avatar-placeholder">
                                {searchUser.username.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="user-result-info">
                              <h4 className="user-result-username">{searchUser.username}</h4>
                              {searchUser.bio && (
                                <p className="user-result-bio">{searchUser.bio}</p>
                              )}
                            </div>
                          </Link>
                          {searchUser.id !== user?.id && (
                            <button className="btn btn-outline btn-sm">
                              Follow
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-state-icon">👤</div>
                      <h3>No users found</h3>
                      <p>Try searching with different keywords.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'posts' && (
                <div className="search-results-posts">
                  {searchResults.posts.length > 0 ? (
                    <div className="posts-container">
                      {searchResults.posts.map(post => (
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
                      <div className="empty-state-icon">📝</div>
                      <h3>No posts found</h3>
                      <p>Try searching with different keywords.</p>
                    </div>
                  )}
                </div>
              )}

              {!isSearching && !hasSearchResults && (
                <div className="empty-state">
                  <div className="empty-state-icon">🔍</div>
                  <h3>No results found</h3>
                  <p>Try searching for users, posts, or different keywords.</p>
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