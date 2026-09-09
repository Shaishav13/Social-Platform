import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui';
import type { RegisterData } from '../types';

const Register: React.FC = () => {
  const [formData, setFormData] = useState<RegisterData>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (
      !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/.test(formData.password)
    ) {
      newErrors.password = 'Include uppercase, lowercase, a number, and a symbol';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      await register(formData);
      navigate('/feed');
    } catch (err: unknown) {
      const responseData = (err as { response?: { data?: { errors?: string[]; message?: string } } })?.response?.data;
      let errorMessage = 'Registration failed. Please try again.';
      if (responseData) {
        if (responseData.errors && responseData.errors.length > 0) {
          errorMessage = responseData.errors[0];
        } else if (responseData.message) {
          errorMessage = responseData.message;
        }
      }
      setErrors({ general: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
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
            Create an Account
          </h1>
          <p className="type-ui-m">Join UdtaBirdie to write, share, and connect</p>
        </div>

        {errors.general && (
          <div className="wren-error" role="alert">
            {errors.general}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="wren-form-group">
            <label htmlFor="username" className="wren-label">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              disabled={isLoading}
              className="wren-input"
              autoComplete="username"
            />
            {errors.username && <span className="type-ui-s" style={{ color: 'var(--rust-alert)' }}>{errors.username}</span>}
          </div>

          <div className="wren-form-group">
            <label htmlFor="email" className="wren-label">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              disabled={isLoading}
              className="wren-input"
              autoComplete="email"
            />
            {errors.email && <span className="type-ui-s" style={{ color: 'var(--rust-alert)' }}>{errors.email}</span>}
          </div>

          <div className="wren-form-group">
            <label htmlFor="password" className="wren-label">
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                disabled={isLoading}
                className="wren-input"
                style={{ width: '100%', paddingRight: '40px' }}
                autoComplete="new-password"
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
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.password && <span className="type-ui-s" style={{ color: 'var(--rust-alert)' }}>{errors.password}</span>}
          </div>

          <div className="wren-form-group">
            <label htmlFor="confirmPassword" className="wren-label">
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              disabled={isLoading}
              className="wren-input"
              autoComplete="new-password"
            />
            {errors.confirmPassword && (
              <span className="type-ui-s" style={{ color: 'var(--rust-alert)' }}>{errors.confirmPassword}</span>
            )}
          </div>

          <div style={{ marginTop: '24px' }}>
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading}
              isLoading={isLoading}
              style={{ width: '100%' }}
            >
              Sign Up
            </Button>
          </div>
        </form>

        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <p className="type-ui-m">
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--wine-700)', fontWeight: 500 }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;