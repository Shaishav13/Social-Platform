import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { LoginCredentials } from '../types';

const Login: React.FC = () => {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/feed';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login(credentials);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="auth-page-epic">
      <div className="auth-background">
        <div className="auth-background-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
          <div className="shape shape-4"></div>
        </div>
      </div>
      
      <div className="auth-container-epic">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <div className="logo-icon">🐦</div>
              <h1 className="logo-text">UdtaBirdie</h1>
            </div>
            <h2 className="auth-title">Welcome Back</h2>
            <p className="auth-subtitle">Sign in to continue your journey</p>
          </div>

          {error && (
            <div className="error-message-epic">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form-epic">
            <div className="form-group-epic">
              <div className="input-wrapper">
                <span className="input-icon">📧</span>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={credentials.email}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  placeholder="Enter your email"
                  className="form-input-epic"
                />
                <label htmlFor="email" className="floating-label">Email Address</label>
              </div>
            </div>

            <div className="form-group-epic">
              <div className="input-wrapper">
                <span className="input-icon">🔒</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={credentials.password}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  placeholder="Enter your password"
                  className="form-input-epic"
                />
                <label htmlFor="password" className="floating-label">Password</label>
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-epic btn-primary-epic"
            >
              {isLoading ? (
                <>
                  <span className="loading-spinner"></span>
                  Signing in...
                </>
              ) : (
                <>
                  <span className="btn-icon">🚀</span>
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <div className="social-login">
            <button className="social-btn google-btn" disabled>
              <span className="social-icon">🔍</span>
              Continue with Google
            </button>
            <button className="social-btn github-btn" disabled>
              <span className="social-icon">⚫</span>
              Continue with GitHub
            </button>
          </div>

          <div className="auth-footer-epic">
            <p>
              Don't have an account?{' '}
              <Link to="/register" className="auth-link-epic">
                Create one now
              </Link>
            </p>
          </div>
        </div>

        <div className="auth-side-panel">
          <div className="side-content">
            <h3>Join the Community</h3>
            <p>Connect with friends, share moments, and discover amazing content from people around the world.</p>
            <div className="features-list">
              <div className="feature-item">
                <span className="feature-icon">✨</span>
                <span>Share your moments</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🌍</span>
                <span>Connect globally</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🔒</span>
                <span>Privacy focused</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;