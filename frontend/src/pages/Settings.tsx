import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Icon } from '../components/ui';
import api from '../services/api';

const Settings: React.FC = () => {
  const { user, updateUser, logout } = useAuth();
  const { theme, density, toggleTheme, toggleDensity } = useTheme();
  const navigate = useNavigate();

  const [isPrivate, setIsPrivate] = useState<boolean>(Boolean(user?.isPrivate));
  const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);
  const [privacySuccess, setPrivacySuccess] = useState('');
  const [privacyError, setPrivacyError] = useState('');

  const [is18Plus, setIs18Plus] = useState<boolean>(Boolean(user?.is18Plus));
  const [isUpdating18Plus, setIsUpdating18Plus] = useState(false);
  const [plus18Success, setPlus18Success] = useState('');
  const [plus18Error, setPlus18Error] = useState('');

  // Calculate if user is 18+ based on their dateOfBirth
  const isEligibleFor18Plus = (): boolean => {
    if (!user?.dateOfBirth) return false;
    const today = new Date();
    const birthDate = new Date(user.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 18;
  };

  const show18PlusSetting = isEligibleFor18Plus();

  // Delete Account Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Email Change State
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailChangeStep, setEmailChangeStep] = useState<'request' | 'verify'>('request');
  const [emailChangeError, setEmailChangeError] = useState('');
  const [emailChangeSuccess, setEmailChangeSuccess] = useState('');
  const [isSubmittingEmail, setIsSubmittingEmail] = useState(false);

  // DOB Change State
  const [isChangingDob, setIsChangingDob] = useState(false);
  const [newDob, setNewDob] = useState(user?.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '');
  const [dobChangeError, setDobChangeError] = useState('');
  const [dobChangeSuccess, setDobChangeSuccess] = useState('');
  const [isSubmittingDob, setIsSubmittingDob] = useState(false);

  const handleTogglePrivacy = async (newVal: boolean) => {
    setIsUpdatingPrivacy(true);
    setPrivacyError('');
    setPrivacySuccess('');

    try {
      const response = await api.put('/auth/profile', {
        isPrivate: newVal
      });

      if (response.data.success) {
        setIsPrivate(newVal);
        updateUser({ ...user, isPrivate: newVal });
        setPrivacySuccess(
          newVal
            ? 'Account set to Private. Only approved readers can view your correspondence.'
            : 'Account set to Public. Anyone on UdtaBirdie can now read and follow you.'
        );
      }
    } catch (err: any) {
      console.error('Failed to update privacy:', err);
      setPrivacyError(err.response?.data?.message || 'Failed to update privacy setting. Please try again.');
    } finally {
      setIsUpdatingPrivacy(false);
    }
  };

  const handleToggle18Plus = async (newVal: boolean) => {
    setIsUpdating18Plus(true);
    setPlus18Error('');
    setPlus18Success('');

    try {
      const response = await api.put('/auth/profile', {
        is18Plus: newVal
      });

      if (response.data.success) {
        setIs18Plus(newVal);
        updateUser({ ...user, is18Plus: newVal });
        setPlus18Success(
          newVal
            ? '18+ mode enabled. You will now see 18+ content in your feed.'
            : '18+ mode disabled. 18+ content is now hidden from your feed.'
        );
      }
    } catch (err: any) {
      console.error('Failed to update 18+ setting:', err);
      setPlus18Error(err.response?.data?.message || 'Failed to update 18+ preference. Please try again.');
    } finally {
      setIsUpdating18Plus(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePassword) {
      setDeleteError('Please enter your password to confirm account deletion.');
      return;
    }

    setIsDeleting(true);
    setDeleteError('');

    try {
      await api.delete('/auth/account', {
        data: { password: deletePassword }
      });
      setShowDeleteModal(false);
      logout();
      navigate('/login');
    } catch (err: any) {
      console.error('Failed to delete account:', err);
      setDeleteError(err.response?.data?.message || 'Failed to delete account. Please verify your password.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newEmail.includes('@')) {
      setEmailChangeError('Please enter a valid email address.');
      return;
    }
    setIsSubmittingEmail(true);
    setEmailChangeError('');
    setEmailChangeSuccess('');

    try {
      const response = await api.post('/auth/profile/email/request', { newEmail });
      if (response.data.success) {
        setEmailChangeStep('verify');
        setEmailChangeSuccess(response.data.message);
      }
    } catch (err: any) {
      setEmailChangeError(err.response?.data?.message || 'Failed to request email change.');
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const handleVerifyEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailOtp || emailOtp.length !== 6) {
      setEmailChangeError('Please enter a valid 6-digit verification code.');
      return;
    }
    setIsSubmittingEmail(true);
    setEmailChangeError('');
    setEmailChangeSuccess('');

    try {
      const response = await api.post('/auth/profile/email/verify', { otp: emailOtp });
      if (response.data.success) {
        updateUser(response.data.data);
        setIsChangingEmail(false);
        setEmailChangeStep('request');
        setNewEmail('');
        setEmailOtp('');
        // Show success somewhere or just alert
        alert('Email successfully changed!');
      }
    } catch (err: any) {
      setEmailChangeError(err.response?.data?.message || 'Failed to verify email change.');
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const handleUpdateDob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDob) {
      setDobChangeError('Please enter a valid date of birth.');
      return;
    }
    setIsSubmittingDob(true);
    setDobChangeError('');
    setDobChangeSuccess('');

    try {
      const response = await api.put('/profile', { dateOfBirth: newDob });
      if (response.data.success) {
        updateUser(response.data.data);
        setIsChangingDob(false);
        setDobChangeSuccess('Date of birth updated successfully.');
      }
    } catch (err: any) {
      setDobChangeError(err.response?.data?.message || 'Failed to update Date of Birth.');
    } finally {
      setIsSubmittingDob(false);
    }
  };

  // Determine if DOB is locked
  const isDobLocked = (): boolean => {
    if (!user?.dobLastChangedAt) return false;
    const daysSinceLastChange = (Date.now() - new Date(user.dobLastChangedAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLastChange < 120; // 4 months
  };

  const getDobUnlockDate = (): string => {
    if (!user?.dobLastChangedAt) return '';
    const unlockDate = new Date(user.dobLastChangedAt);
    unlockDate.setDate(unlockDate.getDate() + 120);
    return unlockDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (!user) {
    return (
      <div style={{ maxWidth: '480px', margin: '60px auto 0', padding: '0 16px' }}>
        <div className="wren-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--ink-500)', marginBottom: '16px' }}><Icon name="settings" size={32} /></div>
          <h2 className="type-display-m" style={{ marginBottom: '8px' }}>Authentication Required</h2>
          <p className="type-ui-m" style={{ color: 'var(--ink-600)', marginBottom: '24px' }}>
            Please log in to manage your account settings and privacy preferences.
          </p>
          <Link to="/login" className="wren-button wren-button--wine">
            Log In to UdtaBirdie
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wren-settings-page" style={{ maxWidth: '680px', margin: '24px auto 80px', padding: '0 20px' }}>
      {/* Navigation Breadcrumb */}
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

      {/* Page Title & Subtitle */}
      <div style={{ marginBottom: '28px' }}>
        <h1 className="type-display-l" style={{ margin: '0 0 6px' }}>
          Account Settings
        </h1>
        <p className="type-ui-m" style={{ color: 'var(--ink-600)', margin: 0 }}>
          Manage your correspondence privacy, reading appearance, and account preferences.
        </p>
      </div>

      {/* SECTION 0: ACCOUNT INFORMATION */}
      <div className="wren-card" style={{ marginBottom: '28px' }}>
        <h2 className="type-display-m" style={{ margin: '0 0 16px', fontSize: '1.25rem' }}>
          Account Information
        </h2>

        {/* Email Setting */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink-900)' }}>Email Address</span>
            {!isChangingEmail && (
              <button 
                type="button" 
                className="wren-button wren-button--ghost" 
                style={{ fontSize: '13px', padding: '4px 8px' }}
                onClick={() => setIsChangingEmail(true)}
              >
                Change
              </button>
            )}
          </div>
          
          {!isChangingEmail ? (
            <div style={{ fontSize: '15px', color: 'var(--ink-600)' }}>{user.email}</div>
          ) : (
            <div style={{ backgroundColor: 'var(--paper-200)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
              {emailChangeStep === 'request' ? (
                <form onSubmit={handleRequestEmailChange}>
                  <label className="wren-label" style={{ marginBottom: '8px' }}>New Email Address</label>
                  <input
                    type="email"
                    className="wren-input"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Enter new email address"
                    required
                    style={{ marginBottom: '12px' }}
                  />
                  {emailChangeError && <div className="wren-error" style={{ marginBottom: '12px' }}>{emailChangeError}</div>}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="wren-button wren-button--ghost" onClick={() => setIsChangingEmail(false)}>Cancel</button>
                    <button type="submit" className="wren-button wren-button--wine" disabled={isSubmittingEmail}>
                      {isSubmittingEmail ? 'Sending...' : 'Send Verification Code'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerifyEmailChange}>
                  <div className="wren-success" style={{ marginBottom: '12px', fontSize: '13.5px' }}>{emailChangeSuccess}</div>
                  <label className="wren-label" style={{ marginBottom: '8px' }}>Verification Code</label>
                  <input
                    type="text"
                    className="wren-input"
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    required
                    style={{ marginBottom: '12px' }}
                  />
                  {emailChangeError && <div className="wren-error" style={{ marginBottom: '12px' }}>{emailChangeError}</div>}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="wren-button wren-button--ghost" onClick={() => setEmailChangeStep('request')}>Back</button>
                    <button type="submit" className="wren-button wren-button--wine" disabled={isSubmittingEmail}>
                      {isSubmittingEmail ? 'Verifying...' : 'Verify & Change Email'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0 0 24px' }} />

        {/* Date of Birth Setting */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink-900)' }}>Date of Birth</span>
            {!isChangingDob && !isDobLocked() && (
              <button 
                type="button" 
                className="wren-button wren-button--ghost" 
                style={{ fontSize: '13px', padding: '4px 8px' }}
                onClick={() => setIsChangingDob(true)}
              >
                Change
              </button>
            )}
          </div>
          
          {isDobLocked() && (
            <div style={{ fontSize: '12.5px', color: 'var(--ochre-600)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon name="lock" size={14} /> Date of birth is locked until {getDobUnlockDate()}.
            </div>
          )}

          {!isChangingDob ? (
            <div style={{ fontSize: '15px', color: 'var(--ink-600)' }}>
              {user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not set'}
            </div>
          ) : (
            <form onSubmit={handleUpdateDob} style={{ backgroundColor: 'var(--paper-200)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
              <label className="wren-label" style={{ marginBottom: '8px' }}>New Date of Birth</label>
              <input
                type="date"
                className="wren-input"
                value={newDob}
                onChange={(e) => setNewDob(e.target.value)}
                required
                max={new Date().toISOString().split('T')[0]}
                style={{ marginBottom: '12px' }}
              />
              <p style={{ fontSize: '12.5px', color: 'var(--ink-600)', marginBottom: '12px' }}>
                Note: You can only change your date of birth once every 4 months.
              </p>
              {dobChangeError && <div className="wren-error" style={{ marginBottom: '12px' }}>{dobChangeError}</div>}
              {dobChangeSuccess && <div className="wren-success" style={{ marginBottom: '12px', fontSize: '13.5px' }}>{dobChangeSuccess}</div>}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="wren-button wren-button--ghost" onClick={() => setIsChangingDob(false)}>Cancel</button>
                <button type="submit" className="wren-button wren-button--wine" disabled={isSubmittingDob}>
                  {isSubmittingDob ? 'Saving...' : 'Save Date of Birth'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* SECTION 1: ACCOUNT PRIVACY & VISIBILITY */}
      <div className="wren-card" style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ display: 'flex', alignItems: 'center', color: 'var(--ink-700)' }}><Icon name={isPrivate ? 'lock' : 'users'} size={24} /></span>
              <h2 className="type-display-m" style={{ margin: 0, fontSize: '1.25rem' }}>
                Account Privacy
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: isPrivate ? 'rgba(162, 63, 46, 0.12)' : 'rgba(75, 107, 78, 0.12)',
                  color: isPrivate ? 'var(--rust-alert)' : 'var(--moss-600)',
                  border: `1px solid ${isPrivate ? 'var(--rust-alert)' : 'var(--moss-600)'}`
                }}
              >
                {isPrivate ? 'Private' : 'Public'}
              </span>
            </div>
            <p className="type-ui-s" style={{ color: 'var(--ink-600)', margin: 0 }}>
              Determine whether your letters and inscription are visible to all readers or restricted to approved followers.
            </p>
          </div>

          <label className="wren-switch" style={{ flexShrink: 0, marginTop: '4px' }}>
            <input
              type="checkbox"
              id="settings-privacy-toggle"
              checked={isPrivate}
              onChange={(e) => handleTogglePrivacy(e.target.checked)}
              disabled={isUpdatingPrivacy}
            />
            <span className="wren-switch-slider"></span>
          </label>
        </div>

        {privacySuccess && (
          <div className="wren-admin-alert wren-admin-alert--success" style={{ margin: '14px 0' }} role="status">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{privacySuccess}</span>
          </div>
        )}

        {privacyError && (
          <div className="wren-error" style={{ margin: '14px 0' }} role="alert">
            {privacyError}
          </div>
        )}

        {/* Privacy Comparison Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginTop: '18px' }}>
          <div
            onClick={() => !isUpdatingPrivacy && isPrivate && handleTogglePrivacy(false)}
            style={{
              padding: '16px',
              backgroundColor: !isPrivate ? 'var(--paper-100)' : 'var(--paper-200)',
              border: `1.5px solid ${!isPrivate ? 'var(--wine-700)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)',
              cursor: isPrivate ? 'pointer' : 'default',
              transition: 'all var(--transition-fast)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--ink-900)' }}>
                <span style={{ display: 'flex', color: 'var(--ink-700)' }}><Icon name="users" size={18} /></span> Public Account
              </div>
              {!isPrivate && (
                <span style={{ color: 'var(--wine-700)', fontSize: '12px', fontWeight: 600 }}>Active</span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--ink-600)', lineHeight: 1.45 }}>
              Anyone on UdtaBirdie can read your letters, view your replies, and follow your correspondence directly without confirmation.
            </p>
          </div>

          <div
            onClick={() => !isUpdatingPrivacy && !isPrivate && handleTogglePrivacy(true)}
            style={{
              padding: '16px',
              backgroundColor: isPrivate ? 'var(--paper-100)' : 'var(--paper-200)',
              border: `1.5px solid ${isPrivate ? 'var(--wine-700)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-sm)',
              cursor: !isPrivate ? 'pointer' : 'default',
              transition: 'all var(--transition-fast)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--ink-900)' }}>
                <span style={{ display: 'flex', color: 'var(--ink-700)' }}><Icon name="lock" size={18} /></span> Private Account
              </div>
              {isPrivate && (
                <span style={{ color: 'var(--wine-700)', fontSize: '12px', fontWeight: 600 }}>Active</span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--ink-600)', lineHeight: 1.45 }}>
              Only readers you approve can view your correspondence. Incoming followers must submit a request for your approval.
            </p>
          </div>
        </div>

        {/* 18+ Toggle Section */}
        {show18PlusSetting && (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ display: 'flex', alignItems: 'center', color: 'var(--ink-700)' }}><Icon name={is18Plus ? 'shield' : 'check'} size={24} /></span>
                <h3 className="type-display-m" style={{ margin: 0, fontSize: '1.1rem' }}>
                  18+ User (NSFW Content)
                </h3>
              </div>
              <p className="type-ui-s" style={{ color: 'var(--ink-600)', margin: 0, maxWidth: '85%' }}>
                Turn this on to mark your account as 18+ and view 18+ content from other authors you follow or who have public accounts. If off, NSFW content is hidden from your feed.
              </p>
            </div>

            <label className="wren-switch" style={{ flexShrink: 0, marginTop: '4px' }}>
              <input
                type="checkbox"
                id="settings-18plus-toggle"
                checked={is18Plus}
                onChange={(e) => handleToggle18Plus(e.target.checked)}
                disabled={isUpdating18Plus}
              />
              <span className="wren-switch-slider"></span>
            </label>
          </div>
        )}

        {plus18Success && (
          <div className="wren-admin-alert wren-admin-alert--success" style={{ margin: '14px 0' }} role="status">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{plus18Success}</span>
          </div>
        )}

        {plus18Error && (
          <div className="wren-error" style={{ margin: '14px 0' }} role="alert">
            {plus18Error}
          </div>
        )}

      </div>

      {/* SECTION 2: READING MATERIAL & APPEARANCE */}
      <div className="wren-card" style={{ marginBottom: '28px' }}>
        <h2 className="type-display-m" style={{ margin: '0 0 4px', fontSize: '1.25rem' }}>
          Reading Material & Appearance
        </h2>
        <p className="type-ui-s" style={{ color: 'var(--ink-600)', margin: '0 0 20px' }}>
          Personalize the tactile aesthetic and text density of your reading interface.
        </p>

        {/* Theme Material Options */}
        <div style={{ marginBottom: '20px' }}>
          <label className="wren-label" style={{ marginBottom: '10px' }}>
            Vellum Paper Theme
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <button
              type="button"
              onClick={() => theme === 'dark' && toggleTheme()}
              className="wren-button"
              style={{
                backgroundColor: theme === 'light' ? 'var(--paper-100)' : 'var(--paper-200)',
                border: `1.5px solid ${theme === 'light' ? 'var(--wine-700)' : 'var(--border)'}`,
                color: 'var(--ink-900)',
                padding: '14px',
                justifyContent: 'flex-start',
                borderRadius: 'var(--radius-sm)',
                gap: '12px'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', color: 'var(--ink-700)' }}><Icon name="sun" size={24} /></span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: '13.5px' }}>Paper Vellum (Light)</div>
                <div style={{ fontSize: '12px', color: 'var(--ink-600)', fontWeight: 400 }}>Greige paper & ink</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => theme === 'light' && toggleTheme()}
              className="wren-button"
              style={{
                backgroundColor: theme === 'dark' ? 'var(--paper-100)' : 'var(--paper-200)',
                border: `1.5px solid ${theme === 'dark' ? 'var(--wine-700)' : 'var(--border)'}`,
                color: 'var(--ink-900)',
                padding: '14px',
                justifyContent: 'flex-start',
                borderRadius: 'var(--radius-sm)',
                gap: '12px'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', color: 'var(--ink-700)' }}><Icon name="moon" size={24} /></span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: '13.5px' }}>Night Study (Dark)</div>
                <div style={{ fontSize: '12px', color: 'var(--ink-600)', fontWeight: 400 }}>Dark paper & luminous ink</div>
              </div>
            </button>
          </div>
        </div>

        {/* Reading Density Options */}
        <div>
          <label className="wren-label" style={{ marginBottom: '10px' }}>
            Correspondence Density
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <button
              type="button"
              onClick={() => density === 'compact' && toggleDensity()}
              className="wren-button"
              style={{
                backgroundColor: density === 'comfortable' ? 'var(--paper-100)' : 'var(--paper-200)',
                border: `1.5px solid ${density === 'comfortable' ? 'var(--wine-700)' : 'var(--border)'}`,
                color: 'var(--ink-900)',
                padding: '14px',
                justifyContent: 'flex-start',
                borderRadius: 'var(--radius-sm)',
                gap: '12px'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', color: 'var(--ink-700)' }}><Icon name="density" size={24} /></span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: '13.5px' }}>Comfortable</div>
                <div style={{ fontSize: '12px', color: 'var(--ink-600)', fontWeight: 400 }}>32px editorial rhythm</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => density === 'comfortable' && toggleDensity()}
              className="wren-button"
              style={{
                backgroundColor: density === 'compact' ? 'var(--paper-100)' : 'var(--paper-200)',
                border: `1.5px solid ${density === 'compact' ? 'var(--wine-700)' : 'var(--border)'}`,
                color: 'var(--ink-900)',
                padding: '14px',
                justifyContent: 'flex-start',
                borderRadius: 'var(--radius-sm)',
                gap: '12px'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', color: 'var(--ink-700)' }}><Icon name="dashboard" size={24} /></span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: '13.5px' }}>Compact</div>
                <div style={{ fontSize: '12px', color: 'var(--ink-600)', fontWeight: 400 }}>20px dense rhythm</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: PROFILE & SECURITY QUICK LINKS */}
      <div className="wren-card" style={{ marginBottom: '28px' }}>
        <h2 className="type-display-m" style={{ margin: '0 0 4px', fontSize: '1.25rem' }}>
          Profile & Security
        </h2>
        <p className="type-ui-s" style={{ color: 'var(--ink-600)', margin: '0 0 20px' }}>
          Your public persona, moniker, bio inscription, and login credentials.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: 'var(--paper-200)', borderRadius: 'var(--radius-sm)', marginBottom: '14px' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink-900)', marginBottom: '2px' }}>
              Public Inscription & Moniker
            </div>
            <div style={{ fontSize: '13px', color: 'var(--ink-600)' }}>
              @{user.username} • {user.email}
            </div>
          </div>
          <Link to="/profile/edit" className="wren-button wren-button--ghost" style={{ fontSize: '13px', padding: '6px 14px' }}>
            Edit Inscription
          </Link>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: 'var(--paper-200)', borderRadius: 'var(--radius-sm)' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink-900)', marginBottom: '2px' }}>
              Authentication Password
            </div>
            <div style={{ fontSize: '13px', color: 'var(--ink-600)' }}>
              Protected with 8+ character salted hash
            </div>
          </div>
          <Link to="/profile/edit" className="wren-button wren-button--ghost" style={{ fontSize: '13px', padding: '6px 14px' }}>
            Change Password
          </Link>
        </div>
      </div>

      {/* SECTION 4: ACCOUNT MANAGEMENT & DANGER ZONE */}
      <div className="wren-card">
        <h2 className="type-display-m" style={{ margin: '0 0 4px', fontSize: '1.25rem' }}>
          Account Actions
        </h2>
        <p className="type-ui-s" style={{ color: 'var(--ink-600)', margin: '0 0 20px' }}>
          Session termination and permanent account deletion.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '18px', marginBottom: '18px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink-900)' }}>
              Active Session
            </div>
            <div style={{ fontSize: '13px', color: 'var(--ink-600)' }}>
              Log out of UdtaBirdie on this device.
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="wren-button wren-button--ghost"
          >
            Log Out
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--rust-alert)' }}>
              Permanent Account Deletion
            </div>
            <div style={{ fontSize: '13px', color: 'var(--ink-600)' }}>
              Permanently remove your letters, profile, and all correspondence.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="wren-button wren-button--rust"
          >
            Delete Account
          </button>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="wren-modal-overlay" onClick={() => !isDeleting && setShowDeleteModal(false)}>
          <div className="wren-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wren-modal-header">
              <h2 className="type-display-m" style={{ color: 'var(--rust-alert)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>⚠️</span> Confirm Account Deletion
              </h2>
              <button
                type="button"
                onClick={() => !isDeleting && setShowDeleteModal(false)}
                className="wren-admin-icon-btn"
                disabled={isDeleting}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleDeleteAccount} className="wren-modal-form">
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--ink-900)', lineHeight: 1.5 }}>
                This action cannot be undone. All your correspondence, manuscript letters, replies, likes, and follow relationships will be permanently removed.
              </p>

              {deleteError && (
                <div className="wren-error" role="alert">
                  {deleteError}
                </div>
              )}

              <div className="wren-form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="delete-password" className="wren-label">
                  Enter your password to confirm:
                </label>
                <input
                  type="password"
                  id="delete-password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Your current password"
                  required
                  disabled={isDeleting}
                  className="wren-input"
                  autoFocus
                />
              </div>

              <div className="wren-modal-actions">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="wren-button wren-button--ghost"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="wren-button wren-button--rust"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting Account...' : 'Permanently Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
