import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get('email') || '';

  const [email, setEmail] = useState(emailParam);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);

  const { verifyEmail, resendVerificationOtp } = useAuth();
  const navigate = useNavigate();

  // References to input elements for auto-advancing
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Update email if query param changes
  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [emailParam]);

  // Focus the first input on initial render
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // Cooldown countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleDigitChange = (index: number, value: string) => {
    // Only allow single numeric character
    const cleaned = value.replace(/\D/g, '');

    if (!cleaned) {
      // User cleared the input
      const updated = [...otpDigits];
      updated[index] = '';
      setOtpDigits(updated);
      return;
    }

    // Grab the last typed character
    const char = cleaned.slice(-1);
    const updated = [...otpDigits];
    updated[index] = char;
    setOtpDigits(updated);
    setErrorMessage('');

    // Auto-advance to the next input box
    if (index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        // Current box is empty, move back to previous box
        const updated = [...otpDigits];
        updated[index - 1] = '';
        setOtpDigits(updated);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    const digitsOnly = pastedData.replace(/\D/g, '').slice(0, 6);

    if (digitsOnly.length === 0) return;

    const updated = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      updated[i] = digitsOnly[i] || '';
    }
    setOtpDigits(updated);
    setErrorMessage('');

    // Focus on next empty box or last box
    const nextEmptyIndex = updated.findIndex((d) => !d);
    if (nextEmptyIndex !== -1 && inputRefs.current[nextEmptyIndex]) {
      inputRefs.current[nextEmptyIndex]?.focus();
    } else if (inputRefs.current[5]) {
      inputRefs.current[5]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join('');

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (code.length !== 6) {
      setErrorMessage('Please enter all 6 digits of your verification code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      await verifyEmail({ email: email.trim().toLowerCase(), otp: code });
      setIsSuccess(true);
      setTimeout(() => {
        navigate('/feed', { replace: true });
      }, 1200);
    } catch (err: unknown) {
      const respData = (err as { response?: { data?: { message?: string } } })?.response?.data;
      setErrorMessage(respData?.message || 'Verification failed. Please check the code and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || isResending) return;

    if (!email.trim()) {
      setErrorMessage('Please provide your email address to receive a code.');
      return;
    }

    setIsResending(true);
    setErrorMessage('');
    setInfoMessage('');

    try {
      const msg = await resendVerificationOtp(email.trim().toLowerCase());
      setInfoMessage(msg || 'A fresh verification code has been dispatched to your email.');
      setResendCooldown(60);
      setOtpDigits(['', '', '', '', '', '']);
      if (inputRefs.current[0]) inputRefs.current[0]?.focus();
    } catch (err: unknown) {
      const respData = (err as { response?: { data?: { message?: string } } })?.response?.data;
      setErrorMessage(respData?.message || 'Failed to resend code. Please try again in a few moments.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div style={{ maxWidth: '480px', margin: '40px auto 0', padding: '0 16px' }}>
      <div className="wren-card" style={{ padding: '36px 32px' }}>
        {/* Header with Logo */}
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <img
              src="/logo2.png"
              alt="UdtaBirdie"
              style={{ width: '38px', height: '38px', objectFit: 'contain', borderRadius: '6px' }}
            />
            <span
              className="type-ui-s"
              style={{ letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-600)', fontWeight: 700 }}
            >
              UdtaBirdie
            </span>
          </div>

          <h1 className="type-display-m" style={{ marginBottom: '8px', fontSize: '26px' }}>
            Verify Your Account
          </h1>
          <p className="type-ui-m" style={{ color: 'var(--ink-600)', lineHeight: 1.5, margin: 0 }}>
            {email ? (
              <>
                We sent a 6-digit verification code to{' '}
                <strong style={{ color: 'var(--ink-900)', wordBreak: 'break-all' }}>{email}</strong>
              </>
            ) : (
              'Enter the email address you registered with and your 6-digit code.'
            )}
          </p>
        </div>

        {/* Success Alert */}
        {isSuccess && (
          <div
            style={{
              backgroundColor: 'rgba(75, 107, 78, 0.12)',
              border: '1px solid var(--moss-600)',
              color: 'var(--moss-600)',
              padding: '14px 18px',
              borderRadius: '8px',
              marginBottom: '20px',
              textAlign: 'center',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <span>✓</span> Email verified successfully! Redirecting to your feed...
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="wren-error" role="alert" style={{ marginBottom: '20px' }}>
            {errorMessage}
          </div>
        )}

        {/* Info Alert */}
        {infoMessage && (
          <div
            style={{
              backgroundColor: 'rgba(169, 117, 46, 0.12)',
              border: '1px solid var(--ochre-600)',
              color: 'var(--ochre-600)',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '14px',
              lineHeight: 1.5,
            }}
          >
            {infoMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Email input field (editable if user needs to correct typos) */}
          <div className="wren-form-group" style={{ marginBottom: '20px' }}>
            <label htmlFor="verify-email" className="wren-label">
              Email Address
            </label>
            <input
              type="email"
              id="verify-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading || isSuccess}
              className="wren-input"
              placeholder="your-email@example.com"
            />
          </div>

          {/* 6 Digit Inputs */}
          <div className="wren-form-group" style={{ marginBottom: '28px' }}>
            <label className="wren-label" style={{ marginBottom: '10px', display: 'block' }}>
              6-Digit Verification Code
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: '8px',
                justifyContent: 'center',
              }}
            >
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  onPaste={idx === 0 ? handlePaste : undefined}
                  disabled={isLoading || isSuccess}
                  style={{
                    height: '56px',
                    width: '100%',
                    textAlign: 'center',
                    fontSize: '24px',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    borderRadius: '8px',
                    border: digit
                      ? '2px solid var(--wine-700)'
                      : '1px solid var(--border)',
                    backgroundColor: 'var(--paper-200)',
                    color: 'var(--ink-900)',
                    outline: 'none',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--wine-700)';
                    e.target.style.boxShadow = '0 0 0 2px rgba(107, 50, 66, 0.2)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = digit ? 'var(--wine-700)' : 'var(--border)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              ))}
            </div>
            <p className="type-ui-s" style={{ color: 'var(--ink-600)', marginTop: '8px', textAlign: 'center' }}>
              Tip: You can paste the full 6-digit code into the first box.
            </p>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            disabled={isLoading || isSuccess || otpDigits.join('').length !== 6}
            style={{ width: '100%', marginBottom: '16px', padding: '12px' }}
          >
            Confirm Verification
          </Button>
        </form>

        {/* Resend Code Section */}
        <div
          style={{
            borderTop: '1px solid var(--border)',
            paddingTop: '18px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span className="type-ui-s" style={{ color: 'var(--ink-600)' }}>
              Didn't receive the email?
            </span>
            {resendCooldown > 0 ? (
              <span
                className="type-ui-s"
                style={{
                  color: 'var(--ink-600)',
                  fontWeight: 600,
                  backgroundColor: 'var(--paper-200)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                }}
              >
                Resend in {resendCooldown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isResending || isLoading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--wine-700)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '14px',
                  textDecoration: 'underline',
                }}
              >
                {isResending ? 'Sending...' : 'Resend Code'}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
            <Link
              to="/register"
              className="type-ui-s"
              style={{ color: 'var(--ink-600)', textDecoration: 'none' }}
            >
              ← Use a different email
            </Link>
            <Link
              to="/login"
              className="type-ui-s"
              style={{ color: 'var(--wine-700)', textDecoration: 'none', fontWeight: 600 }}
            >
              Sign In Instead →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
