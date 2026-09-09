import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/forgot-password', { email: email.trim() });
      setSubmitted(true);
      if (response.data.resetToken) {
        setResetToken(response.data.resetToken);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetUrl = `${window.location.origin}/reset-password?token=${resetToken}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(resetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
              <p className="type-body-serif" style={{ fontSize: '0.95rem', marginBottom: '12px' }}>
                A reset token was generated for <strong>{email}</strong>. This token expires in <strong>1 hour</strong>.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  value={resetUrl}
                  className="wren-input"
                  style={{ fontSize: '0.8125rem' }}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="wren-button wren-button--ghost"
                  style={{ flexShrink: 0 }}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Link
                to={`/reset-password?token=${resetToken}`}
                className="wren-button wren-button--wine"
                style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}
              >
                Reset Password Now
              </Link>
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
