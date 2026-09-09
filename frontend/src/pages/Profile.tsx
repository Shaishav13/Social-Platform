import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { User, Post } from '../types';
import { PostCard, ProfileHeader, SkeletonLoader } from '../components/wren';
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [editFormData, setEditFormData] = useState({
    username: '',
    bio: '',
    isPrivate: false
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const isOwnProfile = currentUser?.id === id;

  useEffect(() => {
    if (id) {
      loadProfile();
      loadUserPosts();
    }
  }, [id]);

  useEffect(() => {
    if (profileUser) {
      setEditFormData({
        username: profileUser.username || '',
        bio: profileUser.bio || '',
        isPrivate: profileUser.isPrivate || false
      });
      // Reset profile picture states when profile changes
      setProfilePictureFile(null);
      setProfilePicturePreview(null);
    }
  }, [profileUser]);

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
      // If it's a 403 error, the profile might be private
      if (err.response?.status === 403) {
        setPosts([]);
      }
    } finally {
      setIsPostsLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!id || isFollowLoading) return;

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

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUpdating) return;

    setIsUpdating(true);
    try {
      // First upload profile picture if a new one is selected
      let profilePictureUrl = profileUser?.profilePicture;
      
      if (profilePictureFile) {
        setIsUploadingPicture(true);
        const formData = new FormData();
        formData.append('avatar', profilePictureFile);

        const uploadResponse = await api.post('/profile/avatar', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (uploadResponse.data.url) {
          profilePictureUrl = uploadResponse.data.url;
        }
        setIsUploadingPicture(false);
      }

      // Then update profile information
      const response = await api.put('/profile', {
        username: editFormData.username.trim(),
        bio: editFormData.bio.trim(),
        isPrivate: editFormData.isPrivate,
        ...(profilePictureUrl && { profilePicture: profilePictureUrl })
      });

      if (response.data.success) {
        setProfileUser(prev => prev ? {
          ...prev,
          username: editFormData.username.trim(),
          bio: editFormData.bio.trim(),
          isPrivate: editFormData.isPrivate,
          profilePicture: profilePictureUrl
        } : null);
        setShowEditModal(false);
        setProfilePictureFile(null);
        setProfilePicturePreview(null);
        // Reload posts if privacy setting changed
        loadUserPosts();
      }
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      alert(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsUpdating(false);
      setIsUploadingPicture(false);
    }
  };

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }

      setProfilePictureFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfilePicturePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeProfilePicture = () => {
    setProfilePictureFile(null);
    setProfilePicturePreview(null);
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
        onBioUpdate={(newBio) => setProfileUser(prev => prev ? { ...prev, bio: newBio } : null)}
        onFollowToggle={handleFollowToggle}
        postCount={postCount}
        followersCount={followerCount}
        followingCount={followingCount}
        isFollowing={isFollowing}
      />

        {/* Profile Content */}
        <div className="profile-content">
          {/* Privacy Message for Private Accounts */}
          {profileUser.isPrivate && !canViewPosts() && (
            <div className="private-account-message">
              <div className="private-icon">🔒</div>
              <h3>This account is private</h3>
              <p>Follow {profileUser.username} to see their posts and activity.</p>
            </div>
          )}

          {/* Posts Section */}
          {canViewPosts() && (
            <div className="profile-posts-section">
              <div className="section-header">
                <h2>
                  <span className="section-icon">📱</span>
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

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content edit-profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <span className="modal-icon">✏️</span>
                Edit Profile
              </h2>
              <button 
                className="modal-close-btn"
                onClick={() => setShowEditModal(false)}
                disabled={isUpdating}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleEditProfile} className="modal-body">
              <div className="form-group profile-picture-section">
                <label>Profile Picture</label>
                <div className="profile-picture-upload">
                  <div className="current-picture">
                    {profilePicturePreview ? (
                      <img 
                        src={profilePicturePreview} 
                        alt="Profile preview"
                        className="profile-picture-preview"
                      />
                    ) : profileUser?.profilePicture ? (
                      <img 
                        src={profileUser.profilePicture} 
                        alt="Current profile"
                        className="profile-picture-preview"
                      />
                    ) : (
                      <div className="profile-picture-placeholder">
                        {profileUser?.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="picture-upload-controls">
                    <input
                      type="file"
                      id="profile-picture-input"
                      accept="image/*"
                      onChange={handleProfilePictureChange}
                      className="picture-input"
                      disabled={isUpdating}
                    />
                    <label 
                      htmlFor="profile-picture-input" 
                      className="btn btn-secondary picture-upload-btn"
                    >
                      <span className="btn-icon">📷</span>
                      Choose Photo
                    </label>
                    {(profilePicturePreview || profilePictureFile) && (
                      <button
                        type="button"
                        onClick={removeProfilePicture}
                        className="btn btn-ghost remove-picture-btn"
                        disabled={isUpdating}
                      >
                        <span className="btn-icon">🗑️</span>
                        Remove
                      </button>
                    )}
                  </div>
                  <small className="upload-hint">
                    JPG, PNG, GIF up to 5MB. Recommended: 400x400px
                  </small>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="edit-username">Username</label>
                <input
                  id="edit-username"
                  type="text"
                  value={editFormData.username}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="Enter your username"
                  maxLength={50}
                  required
                  disabled={isUpdating}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-bio">Bio</label>
                <textarea
                  id="edit-bio"
                  value={editFormData.bio}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell us about yourself..."
                  maxLength={500}
                  rows={4}
                  disabled={isUpdating}
                />
                <small className="char-count">{editFormData.bio.length}/500</small>
              </div>

              <div className="form-group privacy-setting">
                <div className="privacy-toggle">
                  <input
                    id="edit-private"
                    type="checkbox"
                    checked={editFormData.isPrivate}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, isPrivate: e.target.checked }))}
                    disabled={isUpdating}
                  />
                  <label htmlFor="edit-private" className="toggle-label">
                    <span className="toggle-switch"></span>
                    <div className="toggle-content">
                      <span className="toggle-title">
                        {editFormData.isPrivate ? '🔒 Private Account' : '🌍 Public Account'}
                      </span>
                      <span className="toggle-description">
                        {editFormData.isPrivate 
                          ? 'Only your followers can see your posts'
                          : 'Anyone can see your posts'
                        }
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </form>
            
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="btn btn-secondary"
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                onClick={handleEditProfile}
                className="btn btn-primary"
                disabled={isUpdating || isUploadingPicture}
              >
                {isUploadingPicture ? (
                  <>
                    <span className="loading-spinner small"></span>
                    Uploading Photo...
                  </>
                ) : isUpdating ? (
                  <>
                    <span className="loading-spinner small"></span>
                    Saving...
                  </>
                ) : (
                  <>
                    <span className="btn-icon">💾</span>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={handleCancelDelete}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <span className="modal-icon">⚠️</span>
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
                    <span className="btn-icon">🗑️</span>
                    Delete My Account
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;