import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Post, User } from '../types';
import PostCard from '../components/Social/PostCard';
import SearchBar from '../components/Search/SearchBar';
import api from '../services/api';

const Search: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'posts' | 'users'>('posts');
  
  const { user: currentUser } = useAuth();

  useEffect(() => {
    if (query) {
      performSearch(query);
    }
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setIsLoading(true);
    setError('');

    try {
      const [postsResponse, usersResponse] = await Promise.all([
        api.get(`/content/search/posts?q=${encodeURIComponent(searchQuery)}`),
        api.get(`/profile/search/users?q=${encodeURIComponent(searchQuery)}`)
      ]);

      setPosts(postsResponse.data.results || []);
      setUsers(usersResponse.data.data || []);
    } catch (err: any) {
      console.error('Search failed:', err);
      setError('Search failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostUpdate = (updatedPost: Post) => {
    setPosts(prev => 
      prev.map(post => 
        post.id === updatedPost.id ? updatedPost : post
      )
    );
  };

  return (
    <div className="search-page">
      <div className="search-container">
        {/* Search Header */}
        <div className="search-header">
          <SearchBar 
            onSearch={performSearch}
            placeholder="Search posts, users, and blogs..."
            className="search-page-bar"
          />
          
          {query && (
            <div className="search-info">
              <h2>Search results for "{query}"</h2>
            </div>
          )}
        </div>

        {query && (
          <>
            {/* Search Tabs */}
            <div className="search-tabs">
              <button
                className={`tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
                onClick={() => setActiveTab('posts')}
              >
                📱 Posts ({posts.length})
              </button>
              <button
                className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                👤 Users ({users.length})
              </button>
            </div>

            {/* Search Results */}
            <div className="search-results">
              {isLoading ? (
                <div className="search-loading">
                  <div className="loading-spinner">Searching...</div>
                </div>
              ) : error ? (
                <div className="error-message">
                  {error}
                  <button 
                    onClick={() => performSearch(query)}
                    className="retry-btn"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <>
                  {activeTab === 'posts' && (
                    <div className="posts-results">
                      {posts.length > 0 ? (
                        <div className="posts-list">
                          {posts.map(post => (
                            <PostCard 
                              key={post.id}
                              post={post}
                              currentUser={currentUser || undefined}
                              onPostUpdate={handlePostUpdate}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="no-results">
                          <div className="no-results-icon">📱</div>
                          <h3>No posts found</h3>
                          <p>Try searching with different keywords.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'users' && (
                    <div className="users-results">
                      {users.length > 0 ? (
                        <div className="users-list">
                          {users.map(user => (
                            <div key={user.id} className="user-result-card">
                              <Link to={`/profile/${user.id}`} className="user-result-link">
                                <div className="user-result-avatar">
                                  {user.profilePicture ? (
                                    <img 
                                      src={user.profilePicture} 
                                      alt={user.username}
                                      className="user-avatar"
                                    />
                                  ) : (
                                    <div className="user-avatar-placeholder">
                                      {user.username.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                                
                                <div className="user-result-info">
                                  <h3 className="user-result-name">{user.username}</h3>
                                  {user.bio && (
                                    <p className="user-result-bio">{user.bio}</p>
                                  )}
                                </div>
                              </Link>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="no-results">
                          <div className="no-results-icon">👤</div>
                          <h3>No users found</h3>
                          <p>Try searching with different keywords.</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {!query && (
          <div className="search-empty">
            <div className="search-empty-icon">🔍</div>
            <h3>Search SocialApp</h3>
            <p>Find posts, users, and blogs by entering keywords above.</p>
            
            <div className="search-suggestions">
              <h4>Popular searches:</h4>
              <div className="suggestion-tags">
                <button 
                  className="suggestion-tag"
                  onClick={() => performSearch('photography')}
                >
                  #photography
                </button>
                <button 
                  className="suggestion-tag"
                  onClick={() => performSearch('technology')}
                >
                  #technology
                </button>
                <button 
                  className="suggestion-tag"
                  onClick={() => performSearch('travel')}
                >
                  #travel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;