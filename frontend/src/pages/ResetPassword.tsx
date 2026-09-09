import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [token] = useState(searchParams.get('token') || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('No reset token found. Please request a new recovery link.');
    }
  }, [token]);

  // Password strength indicator
  const getStrength = (pwd: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) score++;
    const map = [
      { label: '', color: '' },
      { label: 'Very Weak', color: 'var(--rust-alert)' },
      { label: 'Weak', color: 'var(--rust-alert)' },
      { label: 'Fair', color: 'var(--ochre-600)' },
      { label: 'Good', color: 'var(--moss-600)' },
      { label: 'Strong', color: 'var(--moss-600)' },
    ];
    return { score, ...map[score] };
  };

  const strength = getStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (strength.score < 4) {
      setError('Please choose a stronger password (minimum 8 chars with uppercase, lowercase, numbers, and symbols)');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      const msgs = err.response?.data?.errors;
      setError(
        msgs?.join(' ') ||
          err.response?.data?.message ||
          'Failed to reset password. The link may have expired.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '440px', margin: '40px auto 0' }}>
      <div className="wren-card">
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <img
              src="/logo2.png"
              alt="UdtaBirdie"
              style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '4px' }}
            />
            <span
              className="type-ui-s"
              style={{ letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-600)', fontWeight: 600 }}
            >
              UdtaBirdie
            </span>
          </div>
          <h1 className="type-display-m" style={{ marginBottom: '6px' }}>
            Reset Password
          </h1>
          <p className="type-ui-m">
            {success ? 'Password successfully updated!' : 'Choose a secure new password for your account'}
          </p>
        </div>

        {error && (
          <div className="wren-error" role="alert">
            {error}
          </div>
        )}

        {success ? (
          <div>
            <div
              style={{
                padding: '16px',
                backgroundColor: 'rgba(75, 107, 78, 0.1)',
                border: '1px solid var(--moss-600)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '20px',
                textAlign: 'center',
              }}
            >
              <p className="type-ui-m" style={{ color: 'var(--moss-600)', fontWeight: 600, marginBottom: '6px' }}>
                Password Updated Successfully
              </p>
              <p className="type-meta">Redirecting you to sign in within 3 seconds...</p>
            </div>
            <Link
              to="/login"
              className="wren-button wren-button--wine"
              style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}
            >
              Proceed to Sign In
            </Link>
          </div>
        ) : !token ? (
          <div>
            <p className="type-meta" style={{ marginBottom: '16px' }}>
              This recovery link is invalid or has expired.
            </p>
            <Link
              to="/forgot-password"
              className="wren-button wren-button--wine"
              style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}
            >
              Request a New Recovery Link
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="wren-form-group">
              <label htmlFor="newPassword" className="wren-label">
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="At least 8 characters"
                  className="wren-input"
                  style={{ paddingRight: '50px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--ink-600)',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                >
                  {showNew ? 'Hide' : 'Show'}
                </button>
              </div>

              {newPassword && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', gap: '4px', height: '4px', marginBottom: '6px' }}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        style={{
                          flex: 1,
                          borderRadius: '2px',
                          backgroundColor: i <= strength.score ? strength.color : 'var(--border)',
                          transition: 'background-color 0.2s',
                        }}
                      />
                    ))}
                  </div>
                  <span className="type-meta" style={{ color: strength.color, fontWeight: 500 }}>
                    {strength.label}
                  </span>
                </div>
              )}
            </div>

            <div className="wren-form-group">
              <label htmlFor="confirmPassword" className="wren-label">
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  placeholder="Repeat your password"
                  className="wren-input"
                  style={{ paddingRight: '50px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--ink-600)',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div style={{ marginTop: '24px' }}>
              <button
                type="submit"
                disabled={isLoading || !newPassword || !confirmPassword}
                className="wren-button wren-button--wine"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {isLoading ? 'Updating Password...' : 'Save New Password'}
              </button>
            </div>
          </form>
        )}

        <div
          style={{
            marginTop: '24px',
            paddingTop: '20px',
            borderTop: '1px solid var(--border)',
            textAlign: 'center',
          }}
        >
          <p className="type-ui-m">
            <Link to="/login" style={{ color: 'var(--wine-700)', fontWeight: 500, textDecoration: 'none' }}>
              ← Return to Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
