import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { User, Post } from '../types';
import PostCard from '../components/Social/PostCard';
import api from '../services/api';

const Profile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser, logout } = useAuth();
  const navigate = useNavigate();
  
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPostsLoading, setIsPostsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'blogs'>('posts');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwnProfile = currentUser?.id === id;

  useEffect(() => {
    if (id) {
      loadProfile();
      loadUserPosts();
    }
  }, [id]);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/profile/${id}`);
      const userData = response.data;
      
      setProfileUser({
        id: userData.id,
        username: userData.username,
        email: userData.email,
        bio: userData.bio,
        profilePicture: userData.profilePicture,
        isPrivate: userData.isPrivate,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt || userData.createdAt
      });
      setIsFollowing(userData.isFollowing || false);
      setFollowerCount(userData.followerCount || 0);
      setFollowingCount(userData.followingCount || 0);
      setPostCount(userData.postCount || 0);
      setError('');
    } catch (err: any) {
      console.error('Failed to load profile:', err);
      setError('Failed to load profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserPosts = async () => {
    try {
      setIsPostsLoading(true);
      const response = await api.get(`/content/posts?authorId=${id}&limit=20`);
      setPosts(response.data.posts || []);
    } catch (err: any) {
      console.error('Failed to load user posts:', err);
    } finally {
      setIsPostsLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!id || isFollowLoading) return;

    setIsFollowLoading(true);
    const newIsFollowing = !isFollowing;
    const newFollowerCount = newIsFollowing ? followerCount + 1 : followerCount - 1;

    // Optimistic update
    setIsFollowing(newIsFollowing);
    setFollowerCount(newFollowerCount);

    try {
      // Use POST for both follow and unfollow since the backend toggles the status
      await api.post(`/social/users/${id}/follow`);
    } catch (error) {
      // Revert optimistic update on error
      setIsFollowing(isFollowing);
      setFollowerCount(followerCount);
      console.error('Failed to toggle follow:', error);
    } finally {
      setIsFollowLoading(false);
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
    setPostCount(prev => Math.max(0, prev - 1)); // Decrement post count, but don't go below 0
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim() || isDeleting) return;

    setIsDeleting(true);
    try {
      await api.delete('/auth/account', {
        data: { password: deletePassword }
      });
      
      // Account deleted successfully
      alert('Your account has been permanently deleted.');
      logout();
      navigate('/');
    } catch (error: any) {
      console.error('Failed to delete account:', error);
      const errorMessage = error.response?.data?.message || 'Failed to delete account. Please try again.';
      alert(errorMessage);
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setDeletePassword('');
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setDeletePassword('');
  };

  if (isLoading) {
    return (
      <div className="profile-page">
        <div className="profile-loading">
          <div className="loading-spinner">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (error || !profileUser) {
    return (
      <div className="profile-page">
        <div className="profile-error">
          <h2>Profile not found</h2>
          <p>{error || 'The user you are looking for does not exist.'}</p>
          <Link to="/feed" className="btn btn-primary">
            Back to Feed
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        {/* Profile Header */}
        <div className="profile-header">
          <div className="profile-info">
            <div className="profile-avatar-section">
              {profileUser.profilePicture ? (
                <img 
                  src={profileUser.profilePicture} 
                  alt={profileUser.username}
                  className="profile-avatar-large"
                />
              ) : (
                <div className="profile-avatar-large-placeholder">
                  {profileUser.username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="profile-details">
              <div className="profile-name-section">
                <h1 className="profile-username">{profileUser.username}</h1>
                {!isOwnProfile && (
                  <button
                    onClick={handleFollowToggle}
                    disabled={isFollowLoading}
                    className={`btn ${isFollowing ? 'btn-secondary' : 'btn-primary'} follow-btn`}
                  >
                    {isFollowLoading ? '...' : isFollowing ? 'Unfollow' : 'Follow'}
                  </button>
                )}
                {isOwnProfile && (
                  <div className="profile-actions">
                    <Link to="/profile/edit" className="btn btn-secondary">
                      Edit Profile
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        navigate('/');
                      }}
                      className="btn btn-outline logout-btn"
                    >
                      Logout
                    </button>
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="btn btn-danger"
                    >
                      Delete Account
                    </button>
                  </div>
                )}
              </div>

              <div className="profile-stats">
                <div className="stat-item">
                  <span className="stat-number">{postCount}</span>
                  <span className="stat-label">Posts</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{followerCount}</span>
                  <span className="stat-label">Followers</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">{followingCount}</span>
                  <span className="stat-label">Following</span>
                </div>
              </div>

              {profileUser.bio && (
                <div className="profile-bio">
                  <p>{profileUser.bio}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Profile Tabs */}
        <div className="profile-tabs">
          <button
            className={`tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
            onClick={() => setActiveTab('posts')}
          >
            📱 Posts
          </button>
          <button
            className={`tab-btn ${activeTab === 'blogs' ? 'active' : ''}`}
            onClick={() => setActiveTab('blogs')}
          >
            📝 Blogs
          </button>
        </div>

        {/* Profile Content */}
        <div className="profile-content">
          {activeTab === 'posts' && (
            <div className="profile-posts">
              {isPostsLoading ? (
                <div className="posts-loading">
                  <div className="loading-spinner">Loading posts...</div>
                </div>
              ) : posts.length > 0 ? (
                <div className="posts-grid">
                  {posts.map(post => (
                    <PostCard 
                      key={post.id}
                      post={post}
                      currentUser={currentUser || undefined}
                      onPostUpdate={handlePostUpdate}
                      onPostDelete={handlePostDelete}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-posts">
                  <div className="empty-icon">📱</div>
                  <h3>No posts yet</h3>
                  <p>
                    {isOwnProfile 
                      ? "You haven't shared any posts yet. Create your first post!"
                      : `${profileUser.username} hasn't shared any posts yet.`
                    }
                  </p>
                  {isOwnProfile && (
                    <Link to="/create-post" className="btn btn-primary">
                      Create Your First Post
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'blogs' && (
            <div className="profile-blogs">
              <div className="empty-blogs">
                <div className="empty-icon">📝</div>
                <h3>No blogs yet</h3>
                <p>Blog functionality will be implemented in a future update.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={handleCancelDelete}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Account</h2>
              <button 
                className="modal-close-btn"
                onClick={handleCancelDelete}
                disabled={isDeleting}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="delete-warning">
                <div className="warning-icon">⚠️</div>
                <h3>This action cannot be undone!</h3>
                <p>
                  Deleting your account will permanently remove:
                </p>
                <ul>
                  <li>Your profile and all personal information</li>
                  <li>All your posts, comments, and media</li>
                  <li>Your likes, shares, and social interactions</li>
                  <li>Your followers and following relationships</li>
                  <li>All your notifications and activity history</li>
                </ul>
              </div>
              
              <div className="password-confirmation">
                <label htmlFor="delete-password">
                  Enter your password to confirm:
                </label>
                <input
                  id="delete-password"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Your current password"
                  className="password-input"
                  disabled={isDeleting}
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button
                onClick={handleCancelDelete}
                className="btn btn-secondary"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="btn btn-danger"
                disabled={!deletePassword.trim() || isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;