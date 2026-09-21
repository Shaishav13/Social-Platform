import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import { Button, Icon } from '../components/ui';
import api from '../services/api';

type Step = 'username' | 'credentials' | 'verify' | 'age' | 'profile';

const Register: React.FC = () => {
  const { features, settings } = useConfig();
  const [step, setStep] = useState<Step>('username');
  
  // Form State
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [bio, setBio] = useState('');
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);

  // Status & Validation
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isUsernameChecking, setIsUsernameChecking] = useState(false);
  const [is18Plus, setIs18Plus] = useState(false);
  const [show18PlusOption, setShow18PlusOption] = useState(false);
  
  const { register, verifyEmail, updateUser, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If user is already authenticated and they are on the initial steps,
    // redirect them to feed. (This prevents logged-in users from seeing the register form).
    if (isAuthenticated && ['username', 'credentials', 'verify'].includes(step)) {
      navigate('/feed');
    }
  }, [isAuthenticated, step, navigate]);

  const handleNextStep = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrors({});

    if (step === 'username') {
      if (!username.trim()) {
        setErrors({ username: 'Username is required' });
        return;
      }
      if (username.length < 3) {
        setErrors({ username: 'Username must be at least 3 characters' });
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        setErrors({ username: 'Only letters, numbers, and underscores allowed' });
        return;
      }

      setIsUsernameChecking(true);
      try {
        const response = await api.get(`/auth/check-username?username=${encodeURIComponent(username)}`);
        if (response.data.available) {
          setSuggestions([]);
          setStep('credentials');
        } else {
          setErrors({ username: 'Username is already taken' });
          if (response.data.suggestions) {
            setSuggestions(response.data.suggestions);
          }
        }
      } catch (err) {
        setErrors({ general: 'Failed to check username availability' });
      } finally {
        setIsUsernameChecking(false);
      }
    } 
    else if (step === 'credentials') {
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setErrors({ email: 'Please enter a valid email address' });
        return;
      }
      if (password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/.test(password)) {
        setErrors({ password: 'Include uppercase, lowercase, a number, and a symbol (min 8 chars)' });
        return;
      }
      if (password !== confirmPassword) {
        setErrors({ confirmPassword: 'Passwords do not match' });
        return;
      }

      setIsLoading(true);
      try {
        const result = await register({ username, email, password, confirmPassword });
        if (result.requiresVerification) {
          setStep('verify');
        } else {
          // Fallback if verification not required (unlikely with this flow)
          navigate('/feed');
        }
      } catch (err: any) {
        setErrors({ general: err.response?.data?.message || 'Registration failed' });
      } finally {
        setIsLoading(false);
      }
    }
    else if (step === 'verify') {
      if (otp.length !== 6) {
        setErrors({ otp: 'Please enter the 6-digit code' });
        return;
      }

      setIsLoading(true);
      try {
        await verifyEmail({ email, otp });
        // At this point, user is logged in
        setStep('age');
      } catch (err: any) {
        setErrors({ otp: err.response?.data?.message || 'Invalid or expired code' });
      } finally {
        setIsLoading(false);
      }
    }
    else if (step === 'age') {
      if (!dateOfBirth) {
        setErrors({ dateOfBirth: 'Please enter your date of birth' });
        return;
      }

      setIsLoading(true);
      try {
        // Update user profile with DOB and is18Plus flag
        const response = await api.put('/profile', {
          dateOfBirth,
          is18Plus: show18PlusOption ? is18Plus : false
        });
        if (response.data.success) {
          updateUser(response.data.data);
          setStep('profile');
        }
      } catch (err: any) {
        setErrors({ general: err.response?.data?.message || 'Failed to update age' });
      } finally {
        setIsLoading(false);
      }
    }
    else if (step === 'profile') {
      setIsLoading(true);
      try {
        let profilePictureUrl = user?.profilePicture;
        
        if (profilePictureFile) {
          const form = new FormData();
          form.append('avatar', profilePictureFile);
          const uploadRes = await api.post('/profile/avatar', form, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          if (uploadRes.data.url) {
            profilePictureUrl = uploadRes.data.url;
          }
        }

        const response = await api.put('/profile', {
          bio: bio.trim(),
          ...(profilePictureUrl && { profilePicture: profilePictureUrl })
        });
        
        if (response.data.success) {
          updateUser(response.data.data);
          navigate('/feed');
        }
      } catch (err: any) {
        setErrors({ general: err.response?.data?.message || 'Failed to update profile' });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const calculateAge = (dobString: string) => {
    if (!dobString) {
      setShow18PlusOption(false);
      return;
    }
    const today = new Date();
    const birthDate = new Date(dobString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    setShow18PlusOption(age >= 18);
    if (age < 18) setIs18Plus(false);
  };

  const handleDobChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateOfBirth(e.target.value);
    calculateAge(e.target.value);
  };

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setErrors({ general: 'Please select an image file' });
        return;
      }
      setProfilePictureFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setProfilePicturePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const renderUsernameStep = () => (
    <form onSubmit={handleNextStep}>
      <div className="wren-form-group">
        <label htmlFor="username" className="wren-label">Choose a Username</label>
        <input
          type="text"
          id="username"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setErrors({});
            setSuggestions([]);
          }}
          className="wren-input"
          placeholder="e.g. udtareader"
          autoFocus
        />
        {errors.username && <span className="type-ui-s" style={{ color: 'var(--rust-alert)', marginTop: '4px', display: 'block' }}>{errors.username}</span>}
      </div>

      {suggestions.length > 0 && (
        <div style={{ marginTop: '12px', marginBottom: '20px' }}>
          <p className="type-ui-s" style={{ color: 'var(--ink-600)', marginBottom: '8px' }}>Available suggestions:</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {suggestions.map(sugg => (
              <button
                key={sugg}
                type="button"
                onClick={() => {
                  setUsername(sugg);
                  setSuggestions([]);
                  setErrors({});
                }}
                style={{
                  padding: '4px 12px',
                  borderRadius: '16px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--paper-100)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: 'var(--ink-800)'
                }}
              >
                {sugg}
              </button>
            ))}
          </div>
        </div>
      )}

      <Button type="submit" variant="primary" isLoading={isUsernameChecking}>
        Continue
      </Button>
    </form>
  );

  const renderCredentialsStep = () => (
    <form onSubmit={handleNextStep}>
      <p className="type-ui-s" style={{ color: 'var(--ink-600)', marginBottom: '20px' }}>
        Username: <strong>{username}</strong> <button type="button" onClick={() => setStep('username')} style={{ color: 'var(--link)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Change</button>
      </p>

      <div className="wren-form-group">
        <label htmlFor="email" className="wren-label">Email Address</label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="wren-input"
          autoFocus
        />
        {errors.email && <span className="type-ui-s" style={{ color: 'var(--rust-alert)', marginTop: '4px', display: 'block' }}>{errors.email}</span>}
      </div>

      <div className="wren-form-group">
        <label htmlFor="password" className="wren-label">Password</label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="wren-input"
        />
        {errors.password && <span className="type-ui-s" style={{ color: 'var(--rust-alert)', marginTop: '4px', display: 'block' }}>{errors.password}</span>}
      </div>

      <div className="wren-form-group">
        <label htmlFor="confirmPassword" className="wren-label">Confirm Password</label>
        <input
          type="password"
          id="confirmPassword"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="wren-input"
        />
        {errors.confirmPassword && <span className="type-ui-s" style={{ color: 'var(--rust-alert)', marginTop: '4px', display: 'block' }}>{errors.confirmPassword}</span>}
      </div>

      <Button type="submit" variant="primary" isLoading={isLoading}>
        Create Account
      </Button>
    </form>
  );

  const renderVerifyStep = () => (
    <form onSubmit={handleNextStep}>
      <p className="type-ui-m" style={{ marginBottom: '20px', color: 'var(--ink-700)' }}>
        We sent a 6-digit code to <strong>{email}</strong>.
      </p>
      
      <div className="wren-form-group">
        <label htmlFor="otp" className="wren-label">Verification Code</label>
        <input
          type="text"
          id="otp"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="wren-input"
          style={{ letterSpacing: '0.25em', fontSize: '20px', textAlign: 'center' }}
          placeholder="000000"
          autoFocus
        />
        {errors.otp && <span className="type-ui-s" style={{ color: 'var(--rust-alert)', marginTop: '4px', display: 'block' }}>{errors.otp}</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '32px' }}>
        <Button type="submit" variant="primary" isLoading={isLoading}>
          Verify Email
        </Button>
        <Button 
          type="button" 
          variant="secondary" 
          onClick={() => {
            setErrors({});
            setStep('credentials');
          }}
          disabled={isLoading}
        >
          Change Email Address
        </Button>
      </div>
    </form>
  );

  const renderAgeStep = () => (
    <form onSubmit={handleNextStep}>
      <p className="type-ui-m" style={{ marginBottom: '24px', color: 'var(--ink-700)' }}>
        Please enter your date of birth. This helps us personalize your experience and ensure compliance.
      </p>

      <div className="wren-form-group">
        <label htmlFor="dateOfBirth" className="wren-label">Date of Birth</label>
        <input
          type="date"
          id="dateOfBirth"
          value={dateOfBirth}
          onChange={handleDobChange}
          className="wren-input"
          max={new Date().toISOString().split("T")[0]}
        />
        {errors.dateOfBirth && <span className="type-ui-s" style={{ color: 'var(--rust-alert)', marginTop: '4px', display: 'block' }}>{errors.dateOfBirth}</span>}
      </div>

      {show18PlusOption && (
        <div style={{
          padding: '16px',
          backgroundColor: 'var(--paper-200)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          marginTop: '20px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--ink-700)' }}><Icon name="shield" size={16} /></span>
                <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink-900)' }}>Enable 18+ (NSFW) Content</span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--ink-600)', lineHeight: 1.4 }}>
                Since you are over 18, you can opt-in to view and post explicit material. You can change this later in settings.
              </p>
            </div>
            <label className="wren-switch" style={{ marginTop: '2px', flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={is18Plus}
                onChange={(e) => setIs18Plus(e.target.checked)}
              />
              <span className="wren-switch-slider"></span>
            </label>
          </div>
        </div>
      )}

      <Button type="submit" variant="primary" isLoading={isLoading} style={{ marginTop: '24px' }}>
        Save & Continue
      </Button>
    </form>
  );

  const renderProfileStep = () => (
    <form onSubmit={handleNextStep}>
      <p className="type-ui-m" style={{ marginBottom: '24px', color: 'var(--ink-700)' }}>
        Almost there! Setup your public profile.
      </p>

      <div className="wren-form-group" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
        <div 
          style={{ 
            width: '100px', height: '100px', borderRadius: '50%', backgroundColor: 'var(--paper-200)', 
            overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px dashed var(--ink-400)', marginBottom: '12px'
          }}
        >
          {profilePicturePreview ? (
            <img src={profilePicturePreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Icon name="image" size={32} color="var(--ink-400)" />
          )}
        </div>
        <label className="wren-button wren-button--secondary" style={{ fontSize: '13px', padding: '6px 12px', cursor: 'pointer' }}>
          Upload Avatar
          <input type="file" accept="image/*" onChange={handleProfilePictureChange} style={{ display: 'none' }} />
        </label>
      </div>

      <div className="wren-form-group">
        <label htmlFor="bio" className="wren-label">Bio</label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="wren-input"
          style={{ minHeight: '80px', resize: 'vertical' }}
          placeholder="Tell us a little about yourself..."
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '32px' }}>
        <Button type="submit" variant="primary" isLoading={isLoading} style={{ width: '100%' }}>
          Complete Setup
        </Button>
        <Button 
          type="button" 
          variant="secondary" 
          onClick={() => navigate('/feed')}
          disabled={isLoading}
          style={{ width: '100%' }}
        >
          Skip for now
        </Button>
      </div>
    </form>
  );

  if (!features.publicRegistration) {
    return (
      <div style={{ maxWidth: '440px', margin: '60px auto 0', padding: '0 16px' }}>
        <div className="wren-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: '42px', marginBottom: '16px' }}>🔏</div>
          <h1 className="type-display-m" style={{ marginBottom: '12px' }}>
            Registration Paused
          </h1>
          <p className="type-ui-m" style={{ color: 'var(--ink-600)', lineHeight: 1.6, marginBottom: '24px' }}>
            Public author registrations are temporarily paused on {settings.siteName || 'UdtaBirdie'} by platform administration.
            Existing authors may sign in below.
          </p>
          <Link to="/login" className="wren-btn wren-btn-primary" style={{ width: '100%', display: 'inline-block' }}>
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '440px', margin: '40px auto 0' }}>
      <div className="wren-card">
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <img src="/logo2.png" alt={settings.siteName || 'UdtaBirdie'} style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '4px' }} />
            <span className="type-ui-s" style={{ letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-600)', fontWeight: 600 }}>{settings.siteName || 'UdtaBirdie'}</span>
          </div>
          <h1 className="type-display-m" style={{ marginBottom: '6px' }}>
            {step === 'username' && 'Create an Account'}
            {step === 'credentials' && 'Secure your Account'}
            {step === 'verify' && 'Verify Email'}
            {step === 'age' && 'Date of Birth'}
            {step === 'profile' && 'Profile Setup'}
          </h1>
          
          <div style={{ display: 'flex', gap: '4px', marginTop: '16px' }}>
            {['username', 'credentials', 'verify', 'age', 'profile'].map((s, idx) => {
              const steps = ['username', 'credentials', 'verify', 'age', 'profile'];
              const currentIdx = steps.indexOf(step);
              return (
                <div 
                  key={s} 
                  style={{ 
                    height: '4px', flex: 1, borderRadius: '2px',
                    backgroundColor: idx <= currentIdx ? 'var(--wine-600)' : 'var(--paper-200)',
                    transition: 'background-color 0.3s ease'
                  }}
                />
              )
            })}
          </div>
        </div>

        {errors.general && (
          <div className="wren-error" role="alert" style={{ marginBottom: '20px' }}>
            {errors.general}
          </div>
        )}

        {step === 'username' && renderUsernameStep()}
        {step === 'credentials' && renderCredentialsStep()}
        {step === 'verify' && renderVerifyStep()}
        {step === 'age' && renderAgeStep()}
        {step === 'profile' && renderProfileStep()}
        
      </div>
      
      {step === 'username' && (
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <p className="type-ui-m" style={{ color: 'var(--ink-600)' }}>
            Already have an account?{' '}
            <Link to="/login" className="wren-link">
              Sign In
            </Link>
          </p>
        </div>
      )}
    </div>
  );
};

export default Register;