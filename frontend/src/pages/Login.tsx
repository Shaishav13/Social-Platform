import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui';
import type { LoginCredentials } from '../types';

const Login: React.FC = () => {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/feed';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setRequiresVerification(false);

    try {
      await login(credentials);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const respData = (err as { response?: { data?: { message?: string; requiresVerification?: boolean; email?: string } } })?.response?.data;
      if (respData?.requiresVerification) {
        setRequiresVerification(true);
        setUnverifiedEmail(respData.email || credentials.email);
        setError(respData.message || 'Your email address is not verified. Please verify your email before logging in.');
      } else {
        const errorMsg = respData?.message || 'Login failed. Please check your credentials.';
        setError(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div style={{ maxWidth: '440px', margin: '40px auto 0' }}>
      <div className="wren-card">
        <div style={{ marginBottom: '28px' }}>
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
            Sign In
          </h1>
          <p className="type-ui-m">Enter your correspondence credentials to continue</p>
        </div>

        {error && (
          <div className="wren-error" role="alert">
            <div>{error}</div>
            {requiresVerification && (
              <div style={{ marginTop: '12px' }}>
                <Link
                  to={`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`}
                  className="type-ui-s"
                  style={{
                    display: 'inline-block',
                    backgroundColor: 'var(--wine-700)',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Verify Email Now →
                </Link>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="wren-form-group">
            <label htmlFor="email" className="wren-label">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={credentials.email}
              onChange={handleChange}
              required
              disabled={isLoading}
              className="wren-input"
              autoComplete="email"
            />
          </div>

          <div className="wren-form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="password" className="wren-label">
                Password
              </label>
              <Link to="/forgot-password" className="type-ui-s" style={{ color: 'var(--wine-700)' }}>
                Forgot?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={credentials.password}
                onChange={handleChange}
                required
                disabled={isLoading}
                className="wren-input"
                style={{ width: '100%', paddingRight: '40px' }}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--ink-600)',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div style={{ marginTop: '24px' }}>
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading}
              isLoading={isLoading}
              style={{ width: '100%' }}
            >
              Sign In
            </Button>
          </div>
        </form>

        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <p className="type-ui-m">
            Don't have an account?{' '}
            <Link to="/register" style={{ color: 'var(--wine-700)', fontWeight: 500 }}>
              Create one here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;