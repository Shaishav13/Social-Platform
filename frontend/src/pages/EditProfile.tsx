import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { Icon } from '../components/ui';

const EditProfile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: '',
    bio: '',
    isPrivate: false
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isUpdating, setIsUpdating] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [showPasswordSection, setShowPasswordSection] = useState(false);

  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        bio: user.bio || '',
        isPrivate: Boolean(user.isPrivate)
      });
    }
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
    setSuccess('');
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
    setPasswordError('');
    setPasswordSuccess('');
  };

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      setProfilePictureFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setProfilePicturePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUpdating) return;

    // Validate input
    if (formData.username.trim().length < 3) {
      setError('Username must be at least 3 characters long.');
      return;
    }

    if (formData.bio.length > 500) {
      setError('Bio must be no more than 500 characters.');
      return;
    }

    setIsUpdating(true);
    setError('');
    setSuccess('');

    try {
      let profilePictureUrl = user?.profilePicture;

      if (profilePictureFile) {
        setIsUploadingPicture(true);
        const formData = new FormData();
        formData.append('avatar', profilePictureFile);
        const uploadResponse = await api.post('/profile/avatar', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (uploadResponse.data.url) {
          profilePictureUrl = uploadResponse.data.url;
        }
        setIsUploadingPicture(false);
      }

      const response = await api.put('/profile', {
        username: formData.username.trim(),
        bio: formData.bio.trim(),
        isPrivate: formData.isPrivate,
        ...(profilePictureUrl && { profilePicture: profilePictureUrl })
      });

      if (response.data.success) {
        setSuccess('Profile updated successfully! Returning to profile...');
        updateUser(response.data.data);

        setTimeout(() => {
          navigate(`/profile/${user?.id}`);
        }, 1200);
      }
    } catch (err: any) {
      console.error('Profile update failed:', err);
      const errorMessage = err.response?.data?.message || 'Failed to update profile. Please try again.';
      setError(errorMessage);
    } finally {
      setIsUpdating(false);
      setIsUploadingPicture(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isChangingPassword) return;

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setPasswordError('All password fields are required.');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    const hasUpperCase = /[A-Z]/.test(passwordData.newPassword);
    const hasLowerCase = /[a-z]/.test(passwordData.newPassword);
    const hasNumbers = /\d/.test(passwordData.newPassword);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      setPasswordError('Password must meet all five security requirements below.');
      return;
    }

    setIsChangingPassword(true);
    setPasswordError('');
    setPasswordSuccess('');

    try {
      const response = await api.put('/auth/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      if (response.data.success) {
        setPasswordSuccess('Password changed successfully! Redirecting to login...');
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });

        setTimeout(() => {
          navigate('/login');
        }, 1800);
      }
    } catch (err: any) {
      console.error('Password change failed:', err);
      const errorMessage = err.response?.data?.message || 'Failed to change password. Please check your current password.';
      setPasswordError(errorMessage);
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Live password requirement flags
  const pwd = passwordData.newPassword;
  const checks = {
    length: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    number: /\d/.test(pwd),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd)
  };

  if (!user) {
    return (
      <div style={{ maxWidth: '480px', margin: '60px auto 0', padding: '0 16px' }}>
        <div className="wren-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--ink-500)', marginBottom: '16px' }}><Icon name="lock" size={32} /></div>
          <h2 className="type-display-m" style={{ marginBottom: '8px' }}>Authentication Required</h2>
          <p className="type-ui-m" style={{ color: 'var(--ink-600)', marginBottom: '24px' }}>
            Please log in to edit your profile and account settings.
          </p>
          <Link to="/login" className="wren-button wren-button--wine">
            Log In to UdtaBirdie
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wren-edit-profile-page" style={{ maxWidth: '680px', margin: '24px auto 80px', padding: '0 20px' }}>
      {/* Navigation Breadcrumb / Back Link */}
      <div style={{ marginBottom: '20px' }}>
        <Link
          to={`/profile/${user.id}`}
          className="wren-button wren-button--ghost"
          style={{
            padding: '6px 14px',
            fontSize: '13px',
            gap: '8px',
            display: 'inline-flex',
            alignItems: 'center'
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Profile
        </Link>
      </div>

      {/* Page Title & Intro */}
      <div style={{ marginBottom: '28px' }}>
        <h1 className="type-display-l" style={{ margin: '0 0 6px' }}>
          Edit Profile
        </h1>
        <p className="type-ui-m" style={{ color: 'var(--ink-600)', margin: 0 }}>
          Refine your public moniker, correspondence bio, and security credentials.
        </p>
      </div>

      {/* Section 1: Profile Information */}
      <div className="wren-card" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative' }}>
            {profilePicturePreview ? (
              <img
                src={profilePicturePreview}
                alt="Profile preview"
                className="wren-avatar"
                style={{ width: '72px', height: '72px', objectFit: 'cover' }}
              />
            ) : user.profilePicture ? (
              <img
                src={user.profilePicture}
                alt={user.username}
                className="wren-avatar"
                style={{ width: '72px', height: '72px', objectFit: 'cover' }}
              />
            ) : (
              <div
                className="wren-avatar-placeholder"
                style={{ width: '72px', height: '72px', fontSize: '24px' }}
              >
                {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
          </div>
          <div>
            <h2 className="type-display-m" style={{ margin: '0 0 8px', fontSize: '1.25rem' }}>
              Profile Information
            </h2>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                type="file"
                id="edit-profile-picture-input"
                accept="image/*"
                onChange={handleProfilePictureChange}
                style={{ display: 'none' }}
                disabled={isUpdating || isUploadingPicture}
              />
              <label 
                htmlFor="edit-profile-picture-input" 
                className="wren-btn wren-btn-outline"
                style={{ cursor: 'pointer', padding: '6px 12px', fontSize: '13px' }}
              >
                {isUploadingPicture ? 'Uploading...' : 'Change Photo'}
              </label>
              {(profilePicturePreview || profilePictureFile) && (
                <button
                  type="button"
                  onClick={() => {
                    setProfilePictureFile(null);
                    setProfilePicturePreview(null);
                  }}
                  className="wren-btn wren-btn-ghost"
                  style={{ padding: '6px 12px', fontSize: '13px' }}
                  disabled={isUpdating || isUploadingPicture}
                >
                  Remove
                </button>
              )}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ink-600)', marginTop: '8px' }}>
              JPG, PNG, GIF up to 5MB. Recommended: 400x400px
            </div>
          </div>
        </div>

        {error && (
          <div className="wren-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="wren-admin-alert wren-admin-alert--success" role="status">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleProfileUpdate}>
          {/* Username Field */}
          <div className="wren-form-group">
            <label htmlFor="username" className="wren-label">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              placeholder="e.g. roger_ascham"
              minLength={3}
              maxLength={50}
              required
              disabled={isUpdating}
              className="wren-input"
              autoComplete="username"
            />
            <small style={{ color: 'var(--ink-600)', fontSize: '12.5px', marginTop: '4px', display: 'block' }}>
              Username must be 3–50 characters long and can only contain letters, numbers, and underscores.
            </small>
          </div>

          {/* Bio Field */}
          <div className="wren-form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="bio" className="wren-label">
                Bio & Inscription
              </label>
              <span
                style={{
                  fontSize: '12.5px',
                  fontFamily: 'var(--font-sans)',
                  color: formData.bio.length > 480 ? 'var(--rust-alert)' : 'var(--ink-600)'
                }}
              >
                {formData.bio.length}/500 characters
              </span>
            </div>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              placeholder="Tell readers about your thoughts, crafts, or background..."
              maxLength={500}
              rows={4}
              disabled={isUpdating}
              className="wren-textarea"
            />
            <small style={{ color: 'var(--ink-600)', fontSize: '12.5px', marginTop: '4px', display: 'block' }}>
              A brief inscription displayed at the head of your public page.
            </small>
          </div>

          {/* Account Privacy Setting */}
          <div
            style={{
              padding: '16px 18px',
              backgroundColor: 'var(--paper-200)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              marginTop: '8px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '16px'
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ display: 'flex', alignItems: 'center', color: 'var(--ink-700)' }}><Icon name={formData.isPrivate ? 'lock' : 'users'} size={18} /></span>
                <span style={{ fontWeight: 600, fontSize: '14.5px', color: 'var(--ink-900)' }}>
                  {formData.isPrivate ? 'Private Account' : 'Public Account'}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    backgroundColor: formData.isPrivate ? 'rgba(162, 63, 46, 0.12)' : 'rgba(75, 107, 78, 0.12)',
                    color: formData.isPrivate ? 'var(--rust-alert)' : 'var(--moss-600)',
                    border: `1px solid ${formData.isPrivate ? 'var(--rust-alert)' : 'var(--moss-600)'}`
                  }}
                >
                  {formData.isPrivate ? 'Protected' : 'Open'}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink-600)', lineHeight: 1.45 }}>
                {formData.isPrivate
                  ? 'Only readers you approve via Follow Requests can read your letters and profile. New followers must be confirmed.'
                  : 'Anyone on UdtaBirdie can read your correspondence, view your inscriptions, and follow you directly.'}
              </p>
            </div>
            <label className="wren-switch" style={{ marginTop: '2px', flexShrink: 0 }}>
              <input
                type="checkbox"
                id="isPrivate"
                name="isPrivate"
                checked={formData.isPrivate}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, isPrivate: e.target.checked }));
                  setError('');
                  setSuccess('');
                }}
                disabled={isUpdating}
              />
              <span className="wren-switch-slider"></span>
            </label>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
            <button
              type="submit"
              className="wren-button wren-button--wine"
              disabled={isUpdating}
              style={{ minWidth: '130px' }}
            >
              {isUpdating ? 'Updating...' : 'Update Profile'}
            </button>
            <Link to={`/profile/${user.id}`} className="wren-button wren-button--ghost">
              Cancel
            </Link>
          </div>
        </form>
      </div>

      {/* Section 2: Change Password (Accordion) */}
      <div className="wren-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 className="type-display-m" style={{ margin: '0 0 4px', fontSize: '1.25rem' }}>
              Change Password
            </h2>
            <p className="type-ui-s" style={{ color: 'var(--ink-600)', margin: 0 }}>
              Update the security credentials used to sign in to your account.
            </p>
          </div>
          <button
            type="button"
            className="wren-button wren-button--ghost"
            onClick={() => setShowPasswordSection(!showPasswordSection)}
            style={{ fontSize: '13px', padding: '6px 14px' }}
            aria-expanded={showPasswordSection}
          >
            {showPasswordSection ? 'Hide' : 'Show Password Fields'}
          </button>
        </div>

        {showPasswordSection && (
          <form onSubmit={handlePasswordUpdate} style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
            {passwordError && (
              <div className="wren-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="wren-admin-alert wren-admin-alert--success" role="status">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>{passwordSuccess}</span>
              </div>
            )}

            {/* Current Password */}
            <div className="wren-form-group">
              <label htmlFor="currentPassword" className="wren-label">
                Current Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  id="currentPassword"
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  placeholder="Enter your current password"
                  required
                  disabled={isChangingPassword}
                  className="wren-input"
                  style={{ paddingRight: '40px' }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--ink-600)',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                >
                  {showCurrentPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="wren-form-group">
              <label htmlFor="newPassword" className="wren-label">
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  id="newPassword"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  placeholder="Enter your new password"
                  minLength={8}
                  required
                  disabled={isChangingPassword}
                  className="wren-input"
                  style={{ paddingRight: '40px' }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--ink-600)',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                >
                  {showNewPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="wren-form-group">
              <label htmlFor="confirmPassword" className="wren-label">
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  placeholder="Confirm your new password"
                  minLength={8}
                  required
                  disabled={isChangingPassword}
                  className="wren-input"
                  style={{ paddingRight: '40px' }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--ink-600)',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Real-time Password Requirements Checklist */}
            <div
              style={{
                backgroundColor: 'var(--paper-200)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px 16px',
                marginTop: '16px',
                marginBottom: '20px'
              }}
            >
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ink-900)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Password Requirements
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: checks.length ? 'var(--moss-600)' : 'var(--ink-600)' }}>
                  <span style={{ display: 'inline-block', width: '14px', textAlign: 'center', fontWeight: 'bold' }}>
                    {checks.length ? '✓' : '•'}
                  </span>
                  <span>At least 8 characters</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: checks.upper ? 'var(--moss-600)' : 'var(--ink-600)' }}>
                  <span style={{ display: 'inline-block', width: '14px', textAlign: 'center', fontWeight: 'bold' }}>
                    {checks.upper ? '✓' : '•'}
                  </span>
                  <span>One uppercase letter (A–Z)</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: checks.lower ? 'var(--moss-600)' : 'var(--ink-600)' }}>
                  <span style={{ display: 'inline-block', width: '14px', textAlign: 'center', fontWeight: 'bold' }}>
                    {checks.lower ? '✓' : '•'}
                  </span>
                  <span>One lowercase letter (a–z)</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: checks.number ? 'var(--moss-600)' : 'var(--ink-600)' }}>
                  <span style={{ display: 'inline-block', width: '14px', textAlign: 'center', fontWeight: 'bold' }}>
                    {checks.number ? '✓' : '•'}
                  </span>
                  <span>One number (0–9)</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: checks.special ? 'var(--moss-600)' : 'var(--ink-600)' }}>
                  <span style={{ display: 'inline-block', width: '14px', textAlign: 'center', fontWeight: 'bold' }}>
                    {checks.special ? '✓' : '•'}
                  </span>
                  <span>One special character (!@#$%^&*)</span>
                </li>
              </ul>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="submit"
                className="wren-button wren-button--wine"
                disabled={isChangingPassword}
                style={{ minWidth: '160px' }}
              >
                {isChangingPassword ? 'Changing Password...' : 'Update Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default EditProfile;