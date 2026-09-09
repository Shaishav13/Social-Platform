import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      await api.post('/auth/forgot-password', { email: email.trim() });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
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
            Forgot Password
          </h1>
          <p className="type-ui-m">
            {submitted
              ? 'Your recovery dispatch is ready.'
              : "Enter your email and we'll create a password reset link."}
          </p>
        </div>

        {error && (
          <div className="wren-error" role="alert">
            {error}
          </div>
        )}

        {!submitted ? (
          <form onSubmit={handleSubmit}>
            <div className="wren-form-group">
              <label htmlFor="email" className="wren-label">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                placeholder="author@udtabirdie.com"
                className="wren-input"
                autoComplete="email"
              />
            </div>

            <div style={{ marginTop: '24px' }}>
              <button
                type="submit"
                disabled={isLoading || !email.trim()}
                className="wren-button wren-button--wine"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {isLoading ? 'Generating Link...' : 'Generate Reset Link'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div
              style={{
                padding: '16px',
                backgroundColor: 'var(--paper-200)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                marginBottom: '20px',
              }}
            >
              <p className="type-body-serif" style={{ fontSize: '0.95rem', marginBottom: '10px' }}>
                If an account with <strong>{email}</strong> exists, password recovery instructions have been dispatched.
              </p>
              <p className="type-ui-s" style={{ color: 'var(--ink-600)', margin: 0 }}>
                Please check your inbox (or your local server console in development mode).
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="wren-form-group" style={{ marginBottom: '8px' }}>
                <label htmlFor="manualToken" className="wren-label">
                  Have a recovery token?
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    id="manualToken"
                    placeholder="Paste recovery token here..."
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value.trim())}
                    className="wren-input"
                  />
                  <Link
                    to={resetToken ? `/reset-password?token=${encodeURIComponent(resetToken)}` : '/reset-password'}
                    className="wren-button wren-button--wine"
                    style={{ flexShrink: 0, textDecoration: 'none' }}
                  >
                    Proceed
                  </Link>
                </div>
              </div>
            </div>
          </div>
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
            Remembered your credentials?{' '}
            <Link to="/login" style={{ color: 'var(--wine-700)', fontWeight: 500, textDecoration: 'none' }}>
              Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
