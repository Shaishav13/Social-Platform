import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { User, Post } from '../types';
import { PostCard, ProfileHeader, SkeletonLoader, FollowListModal } from '../components/wren';
import { Icon } from '../components/ui';
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
  const [isRequested, setIsRequested] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const isOwnProfile = currentUser?.id === id || (profileUser ? currentUser?.id === profileUser.id : false);

  useEffect(() => {
    if (id) {
      loadProfile();
    }
  }, [id]);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

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
      setIsRequested(userData.isRequested || false);
      setFollowerCount(userData.followerCount || 0);
      setFollowingCount(userData.followingCount || 0);
      setPostCount(userData.postCount || 0);
      setError('');
      
      // Load user posts with resolved UUID
      loadUserPosts(userData.id);
    } catch (err: any) {
      console.error('Failed to load profile:', err);
      setError('Failed to load profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserPosts = async (targetAuthorId?: string) => {
    const authorId = targetAuthorId || profileUser?.id || id;
    if (!authorId) return;
    try {
      setIsPostsLoading(true);
      const response = await api.get(`/content/posts?authorId=${authorId}&limit=20`);
      setPosts(response.data.posts || []);
    } catch (err: any) {
      console.error('Failed to load user posts:', err);
      // If it's a 403 error, the profile might be private
      if (err.response?.status === 403) {
        setPosts([]);
      }
    } finally {
      setIsPostsLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    const targetId = profileUser?.id || id;
    if (!targetId || isFollowLoading) return;

    setIsFollowLoading(true);

    try {
      if (isFollowing) {
        // Unfollow
        await api.delete(`/social/users/${id}/follow`);
        setIsFollowing(false);
        setIsRequested(false);
        setFollowerCount(prev => Math.max(0, prev - 1));
      } else if (isRequested) {
        // Cancel follow request
        await api.delete(`/social/users/${id}/follow-request`);
        setIsRequested(false);
      } else {
        // Send follow request or follow directly
        const response = await api.post(`/social/users/${id}/follow`);
        const result = response.data.data;
        
        setIsFollowing(result.following || false);
        setIsRequested(result.requested || false);
        setFollowerCount(result.followerCount || followerCount);
        
        // Reload posts if follow status changed (for private accounts)
        if (result.following) {
          loadUserPosts();
        }
      }
    } catch (error) {
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
    setPostCount(prev => Math.max(0, prev - 1));
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim() || isDeleting) return;

    setIsDeleting(true);
    try {
      await api.delete('/auth/account', {
        data: { password: deletePassword }
      });
      
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

  const canViewPosts = () => {
    if (isOwnProfile) return true;
    if (!profileUser?.isPrivate) return true;
    return isFollowing;
  };

  if (isLoading) {
    return <SkeletonLoader count={3} />;
  }

  if (error || !profileUser) {
    return (
      <div className="wren-empty-state">
        <h2 className="wren-empty-title">Profile not found</h2>
        <p className="type-ui-m">{error || 'The user you are looking for does not exist.'}</p>
        <Link to="/feed" className="wren-btn wren-btn-secondary">
          Return to Feed
        </Link>
      </div>
    );
  }

  return (
    <div className="wren-profile-view">
      <ProfileHeader
        user={profileUser}
        isOwnProfile={isOwnProfile}
        onFollowToggle={handleFollowToggle}
        postCount={postCount}
        followersCount={followerCount}
        followingCount={followingCount}
        isFollowing={isFollowing}
        onFollowersClick={() => setFollowModal('followers')}
        onFollowingClick={() => setFollowModal('following')}
      />

        {/* Profile Content */}
        <div className="profile-content">
          {/* Privacy Message for Private Accounts */}
          {profileUser.isPrivate && !canViewPosts() && (
            <div className="private-account-message">
              <div className="private-icon"><Icon name="lock" size={32} /></div>
              <h3>This account is private</h3>
              <p>Follow {profileUser.username} to see their posts and activity.</p>
            </div>
          )}

          {/* Posts Section */}
          {canViewPosts() && (
            <div className="profile-posts-section">
              <div className="section-header">
                <h2>
                  <span className="section-icon"><Icon name="dashboard" size={20} /></span>
                  Posts
                </h2>
                {isOwnProfile && (
                  <Link to="/create-post" className="btn btn-create-post">
                    <span className="btn-icon">+</span>
                    Create Post
                  </Link>
                )}
              </div>

              {isPostsLoading ? (
                <div className="posts-loading">
                  <div className="loading-spinner"></div>
                  <p>Loading posts...</p>
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
                <div className="wren-empty-state">
                  <h3 className="wren-empty-title">This is where their posts will show up.</h3>
                  {isOwnProfile && (
                    <Link to="/create-post" className="wren-empty-link">
                      Write your first letter.
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
        </div>



      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={handleCancelDelete}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <span className="modal-icon"><Icon name="shield" size={20} /></span>
                Delete Account
              </h2>
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
                <div className="warning-content">
                  <h3>This action cannot be undone!</h3>
                  <p>Deleting your account will permanently remove:</p>
                  <ul>
                    <li>Your profile and all personal information</li>
                    <li>All your posts, comments, and media</li>
                    <li>Your likes, shares, and social interactions</li>
                    <li>Your followers and following relationships</li>
                    <li>All your notifications and activity history</li>
                  </ul>
                </div>
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
                {isDeleting ? (
                  <>
                    <span className="loading-spinner small"></span>
                    Deleting...
                  </>
                ) : (
                  <>
                    <span className="btn-icon"><Icon name="trash" size={16} /></span>
                    Delete My Account
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Follow List Modal */}
      {followModal && id && (
        <FollowListModal
          userId={id}
          type={followModal}
          count={followModal === 'followers' ? followerCount : followingCount}
          onClose={() => setFollowModal(null)}
        />
      )}
    </div>
  );
};

export default Profile;