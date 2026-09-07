import React, { useState, useEffect, useRef } from 'react';
import {
  Mail,
  Lock,
  User,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  KeyRound,
  Check,
  Eye,
  EyeOff,
  Sparkles,
  X,
} from 'lucide-react';
import { authApi, LoginResponse } from '../../services/api/auth';
import { useAuth } from '../../context/AuthContext';
import klyraLogo from '../../assets/images/klyra_logo.png';

export type AuthMode =
  | 'login'
  | 'register'
  | 'verify-pending'
  | 'verify-email'
  | '2fa'
  | 'forgot-password'
  | 'forgot-otp'
  | 'reset-password';

interface AuthPageProps {
  initialMode?: AuthMode;
  initialToken?: string;
  onLoginSuccess?: () => void;
  onResetComplete?: () => void;
  onEmailVerified?: (message: string) => void;
  isModal?: boolean;
  onClose?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  initialToken,
  onLoginSuccess,
  onResetComplete,
  onEmailVerified,
  isModal = false,
  onClose,
}) => {
  const { login, verify2FA } = useAuth();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [token, setToken] = useState<string>(initialToken || '');

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // 2FA state
  const [twoFactorTempToken, setTwoFactorTempToken] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Email OTP verification state (registration + forgot password)
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');

  // Feedback states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isResetSuccess, setIsResetSuccess] = useState(false);
  const [isEmailVerifySuccess, setIsEmailVerifySuccess] = useState(false);
  const [resetRedirectSeconds, setResetRedirectSeconds] = useState<number | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  // Lockout countdown timer state (seconds)
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);

  // Resend cooldown timer
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  const syncResetCompletion = (message: string) => {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('klyra_auth_channel');
        channel.postMessage({ type: 'RESET_PASSWORD_COMPLETE', message });
        channel.close();
      }
    } catch { }

    try {
      localStorage.setItem(
        'klyra_auth_sync',
        JSON.stringify({
          type: 'RESET_PASSWORD_COMPLETE',
          message,
          timestamp: Date.now(),
        }),
      );
    } catch { }
  };

  // Sync mode if initialMode prop changes (e.g. switching between login and register modals)
  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
      setError(null);
      setSuccessMessage(null);
    }
  }, [initialMode]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isModal || !onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Do not close during active multi-step flows
        if (['verify-pending', '2fa', 'forgot-password', 'reset-password'].includes(mode)) {
          return;
        }
        handleModalClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModal, onClose, mode, lockoutSeconds]);

  // Lock both body and html scroll when modal is active
  useEffect(() => {
    if (!isModal) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [isModal]);

  // Guarantee password fields are never prefilled or retained across mode transitions
  useEffect(() => {
    setPassword('');
    setConfirmPassword('');
  }, [mode]);

  // Listen for real-time auth events from Demo Inbox tab (BroadcastChannel, storage event, window message)
  useEffect(() => {
    const handleAuthSync = (data: { type: string; token?: string; message?: string }) => {
      if (data.type === 'EMAIL_VERIFIED') {
        setIsLoading(false);
        setError(null);
        setSuccessMessage(data.message || 'Email verified successfully! You can now log in.');
        setIsEmailVerifySuccess(true);
        setResetRedirectSeconds(5);
        setPassword('');
        setConfirmPassword('');
        setMode('verify-email');
        setTimeout(() => {
          setMode('login');
          setIsEmailVerifySuccess(false);
          setResetRedirectSeconds(null);
          setSuccessMessage('Email verified successfully. Please log in.');
        }, 5000);
      } else if (data.type === 'START_RESET_PASSWORD' && data.token) {
        setToken(data.token);
        setPassword('');
        setConfirmPassword('');
        setError(null);
        setSuccessMessage(null);
        setIsResetSuccess(false);
        setMode('reset-password');
      } else if (data.type === 'RESET_PASSWORD_COMPLETE') {
        onResetComplete?.();
        setIsLoading(false);
        setError(null);
        setPassword('');
        setConfirmPassword('');
        setMode('reset-password');
        setIsResetSuccess(true);
        setSuccessMessage('Password reset successfully. Please log in.');
        setResetRedirectSeconds(5);
        setTimeout(() => {
          setMode('login');
          setIsResetSuccess(false);
          setResetRedirectSeconds(null);
          setSuccessMessage('Password reset successfully. Please log in with your new password.');
        }, 5000);
      }
    };

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('klyra_auth_channel');
      channel.onmessage = (event) => {
        if (event.data) handleAuthSync(event.data);
      };
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'klyra_auth_sync' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          handleAuthSync(parsed);
        } catch { }
      }
    };
    window.addEventListener('storage', handleStorage);

    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'KLYRA_AUTH_SYNC') {
        handleAuthSync({ type: e.data.action, token: e.data.token, message: e.data.message });
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Parse URL search params on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const authParam = urlParams.get('auth');
      const tokenParam = urlParams.get('token');

      if (tokenParam) {
        setToken(tokenParam);
      }

      if (authParam === 'verify-email') {
        setMode('verify-email');
      } else if (authParam === 'reset-password') {
        setMode('reset-password');
      } else if (authParam === 'register') {
        setMode('register');
      } else if (authParam === 'forgot-password') {
        setMode('forgot-password');
      } else if (authParam === 'login') {
        setMode('login');
      }
    }
  }, []);

  // Countdown timer for account lockout
  useEffect(() => {
    if (lockoutSeconds === null || lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev === null || prev <= 1) {
          setError(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  // Resend cooldown ticker
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (resetRedirectSeconds === null || resetRedirectSeconds <= 0) return;
    const timer = setInterval(() => {
      setResetRedirectSeconds((prev) => (prev === null ? null : Math.max(0, prev - 1)));
    }, 1000);
    return () => clearInterval(timer);
  }, [resetRedirectSeconds]);

  // Auto-focus OTP entry when entering an OTP mode
  useEffect(() => {
    if (mode === 'verify-email' || mode === 'forgot-otp') {
      setOtpDigits(['', '', '', '', '', '']);
      const t = setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [mode]);

  const openDemoInbox = () => {
    authApi.openDemoInbox();
  };

  // Password strength calculator
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, text: '', color: '#64748b' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    switch (score) {
      case 1:
        return { score: 1, text: 'Weak', color: '#ef4444' };
      case 2:
        return { score: 2, text: 'Fair', color: '#f59e0b' };
      case 3:
        return { score: 3, text: 'Good', color: '#3b82f6' };
      case 4:
        return { score: 4, text: 'Strong', color: '#22c55e' };
      default:
        return { score: 0, text: '', color: '#64748b' };
    }
  };

  const passwordStrength = getPasswordStrength(password);

  // ================= ACTION HANDLERS =================

  const handleResetLockedState = () => {
    setLockoutSeconds(null);
    setRemainingAttempts(null);
    setError(null);
    setEmail('');
    setPassword('');
    setMode('login');
  };

  const handleModalClose = () => {
    if (lockoutSeconds !== null) {
      handleResetLockedState();
    }
    if (onClose) onClose();
  };

  // 1. Handle Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      await authApi.register(name, email, password);
      setPassword('');
      setConfirmPassword('');
      setPendingVerificationEmail(email.trim().toLowerCase());
      setMode('verify-email');
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res: LoginResponse = await login(email, password, rememberMe);
      setPassword('');

      if (res.requires2FA && res.tempToken) {
        setTwoFactorTempToken(res.tempToken);
        setMaskedEmail(res.maskedEmail || email);
        setMode('2fa');
        setResendCooldown(60);
        setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
      } else {
        // Direct login succeeded
        if (onLoginSuccess) onLoginSuccess();
      }
    } catch (err: any) {
      setPassword('');
      setError(err.message || 'Login failed.');

      // Check if account locked
      if (err.message?.includes('locked')) {
        const match = err.message.match(/(\d+)\s*minute/);
        const mins = match ? parseInt(match[1], 10) : 20;
        setLockoutSeconds(mins * 60);
      } else if (err.message?.includes('attempt')) {
        const match = err.message.match(/(\d+)\s*attempt/);
        if (match) setRemainingAttempts(parseInt(match[1], 10));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Handle 2FA Verification
  const handleVerify2FA = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = otpDigits.join('');
    if (code.length !== 6) {
      setError('Please enter the full 6-digit code.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await verify2FA(twoFactorTempToken, code);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setIsLoading(false);
    }
  };

  // OTP inputs auto-advance
  const handleOtpChange = (index: number, val: string) => {
    // Handle pasted 6-digit code
    if (val.length > 1) {
      const cleanVal = val.replace(/\D/g, '').slice(0, 6);
      if (cleanVal.length > 0) {
        const nextDigits = [...otpDigits];
        for (let i = 0; i < cleanVal.length; i++) {
          nextDigits[i] = cleanVal[i];
        }
        setOtpDigits(nextDigits);
        const nextFocus = Math.min(cleanVal.length, 5);
        otpInputRefs.current[nextFocus]?.focus();
        if (cleanVal.length === 6) {
          setTimeout(() => {
            // Auto-submit if 6 digits provided
            authApi
              .verify2FA(twoFactorTempToken, cleanVal)
              .then(() => {
                if (onLoginSuccess) onLoginSuccess();
              })
              .catch((e) => setError(e.message));
          }, 200);
        }
      }
      return;
    }

    const cleanChar = val.replace(/\D/g, '');
    const nextDigits = [...otpDigits];
    nextDigits[index] = cleanChar;
    setOtpDigits(nextDigits);

    if (cleanChar && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // 4. Handle Resend 2FA
  const handleResend2FA = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    setError(null);
    try {
      await authApi.resend2FA(twoFactorTempToken);
      setSuccessMessage('New security code sent to your email.');
      setResendCooldown(60);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Handle Resend Verification Code
  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    const targetEmail = pendingVerificationEmail || email;
    setIsLoading(true);
    setError(null);
    try {
      await authApi.resendVerification(targetEmail);
      setSuccessMessage('A new verification code has been sent to your email.');
      setResendCooldown(60);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  // 6. Handle Email Verification via 6-digit OTP
  const completeEmailVerification = (message: string) => {
    setSuccessMessage(message);
    onEmailVerified?.(message);
    setIsEmailVerifySuccess(true);
    setResetRedirectSeconds(5);
    setTimeout(() => {
      setMode('login');
      setIsEmailVerifySuccess(false);
      setResetRedirectSeconds(null);
      setSuccessMessage('Email verified successfully. Please log in.');
    }, 5000);
  };

  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await authApi.verifyEmail(pendingVerificationEmail || email, otpDigits.join(''));
      completeEmailVerification(res.message || 'Email verified successfully! You can now log in.');
    } catch (err: any) {
      if (err.message?.includes('already verified')) {
        completeEmailVerification('Email verified successfully! You can now log in.');
      } else {
        setError(err.message || 'Email verification failed.');
        setOtpDigits(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 7. Handle Forgot Password (sends reset OTP)
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await authApi.forgotPassword(email);
      setSuccessMessage(res.message);
      setResendCooldown(60);
      setMode('forgot-otp');
    } catch (err: any) {
      setError(err.message || 'Failed to request password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  // 7b. Handle Reset OTP verification -> short-lived single-use reset token
  const handleVerifyResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await authApi.verifyResetOtp(email, otpDigits.join(''));
      setToken(res.resetToken);
      setSuccessMessage(res.message);
      setMode('reset-password');
    } catch (err: any) {
      setError(err.message || 'Verification failed.');
      setOtpDigits(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  // 7c. Handle Resend password-reset OTP
  const handleResendResetOtp = async () => {
    if (resendCooldown > 0) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await authApi.forgotPassword(email);
      setSuccessMessage(res.message);
      setResendCooldown(60);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to resend verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  // 8. Handle Password Reset Submission
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await authApi.resetPassword(token, password);
      setSuccessMessage('Password reset successfully. Please log in.');
      onResetComplete?.();
      syncResetCompletion(res.message);
      setIsResetSuccess(true);
      setResetRedirectSeconds(5);
      setTimeout(() => {
        setMode('login');
        setIsResetSuccess(false);
        setResetRedirectSeconds(null);
        setSuccessMessage('Password reset successfully. Please log in with your new password.');
      }, 5000);
    } catch (err: any) {
      setError(err.message || 'Password reset failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`auth-page-container ${isModal ? 'auth-modal-overlay' : ''}`}
      onClick={(e) => {
        if (isModal && onClose && e.target === e.currentTarget) {
          handleModalClose();
        }
      }}
    >
      {/* Background ambient lighting */}
      <div className="auth-ambient-glow" />

      {/* Floating demo mailbox shortcut (rendered when not in modal) */}
      {!isModal && (
        <button
          className="floating-mailbox-btn"
          onClick={openDemoInbox}
          title="Open Live Demo Mailbox in new tab"
        >
          <Mail size={16} />
          <span>Demo Mailbox</span>
          <ExternalLink size={12} />
        </button>
      )}

      {/* Main Authentication Card */}
      <div
        className={`auth-card ${mode === 'register' ? 'register-auth-card' : ''} animate-fade-in`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top-Right Card Actions: Contextual Demo Email Inbox button & Modal Close button */}

        {/* Header Branding */}
        <div className="auth-header">
          <div className="auth-logo-badge">
            <div className='auth_logo'>
              <img src={klyraLogo} alt="Klyra Logo" className="auth-logo-img" />
            </div>
            <h1 className="auth-brand-name">KLYRA</h1>
          </div>

          <p className="auth-tagline">API Marketplace & Developer Platform</p>
        </div>

        {/* Global Feedback Banner */}
        {error && (
          <div className="feedback-banner error animate-fade-in">
            <AlertTriangle size={16} className="banner-icon" />
            <div className="banner-text">
              <span>{error}</span>
              {lockoutSeconds !== null && lockoutSeconds > 0 && (
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}
                >
                  <div className="lockout-timer-pill">
                    ⏱ Unlocks in {Math.floor(lockoutSeconds / 60)}m {lockoutSeconds % 60}s
                  </div>
                  <button
                    type="button"
                    onClick={handleResetLockedState}
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      color: '#f8fafc',
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    Try another account
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {successMessage && (
          <div className="feedback-banner success animate-fade-in">
            <CheckCircle2 size={16} className="banner-icon" />
            <span>
              {successMessage}
              {resetRedirectSeconds !== null && (
                <>
                  <br />
                  Redirecting to Login... {resetRedirectSeconds}s
                </>
              )}
            </span>
          </div>
        )}

        {/* ================= VIEW: LOGIN ================= */}
        {mode === 'login' && (
          <form className="auth-form" onSubmit={handleLogin}>
            <div className="form-title-group">
              <h2 className="form-title">Welcome back</h2>
              <p className="form-subtitle">Sign in to your Klyra account to continue</p>
            </div>

            <div className="input-group">
              <label className="input-label">Email Address</label>
              <div className="input-field-wrapper">
                <Mail size={16} className="field-icon" />
                <input
                  type="email"
                  className="auth-input"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading || (lockoutSeconds !== null && lockoutSeconds > 0)}
                />
              </div>
            </div>

            <div className="input-group">
              <div className="label-row">
                <label className="input-label">Password</label>
                <button
                  type="button"
                  className="forgot-password-link"
                  onClick={() => {
                    setError(null);
                    setSuccessMessage(null);
                    setMode('forgot-password');
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <div className="input-field-wrapper">
                <Lock size={16} className="field-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading || (lockoutSeconds !== null && lockoutSeconds > 0)}
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="form-options-row">
              <label className="checkbox-container">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="checkbox-label">Remember me for 30 days</span>
              </label>
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={isLoading || (lockoutSeconds !== null && lockoutSeconds > 0)}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={16} className="spin-icon" />
                  <span>Signing In...</span>
                </>
              ) : lockoutSeconds !== null && lockoutSeconds > 0 ? (
                <span>
                  Account Locked ({Math.floor(lockoutSeconds / 60)}m {lockoutSeconds % 60}s)
                </span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className="auth-footer-prompt">
              Don't have an account?{' '}
              <button
                type="button"
                className="mode-toggle-link"
                onClick={() => {
                  setError(null);
                  setSuccessMessage(null);
                  setMode('register');
                }}
              >
                Create an account
              </button>
            </div>
          </form>
        )}

        {/* ================= VIEW: REGISTER ================= */}
        {mode === 'register' && (
          <form className="auth-form register-form" onSubmit={handleRegister}>
            <div className="form-title-group">
              <h2 className="form-title">Create your account</h2>
              <p className="form-subtitle">Get started with Klyra developer APIs in seconds</p>
            </div>

            <div className="input-group">
              <label className="input-label">Full Name</label>
              <div className="input-field-wrapper">
                <User size={16} className="field-icon" />
                <input
                  type="text"
                  className="auth-input"
                  placeholder="Alex Developer"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Work Email</label>
              <div className="input-field-wrapper">
                <Mail size={16} className="field-icon" />
                <input
                  type="email"
                  className="auth-input"
                  placeholder="alex@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Password</label>
              <div className="input-field-wrapper">
                <Lock size={16} className="field-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {password && (
                <div className="password-strength-bar">
                  <div
                    className="strength-progress"
                    style={{
                      width: `${(passwordStrength.score / 4) * 100}%`,
                      backgroundColor: passwordStrength.color,
                    }}
                  />
                  <span className="strength-text" style={{ color: passwordStrength.color }}>
                    {passwordStrength.text}
                  </span>
                </div>
              )}
            </div>

            <div className="input-group">
              <label className="input-label">Confirm Password</label>
              <div className="input-field-wrapper">
                <Lock size={16} className="field-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={isLoading}>
              {isLoading ? (
                <>
                  <RefreshCw size={16} className="spin-icon" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className="auth-footer-prompt">
              Already have an account?{' '}
              <button
                type="button"
                className="mode-toggle-link"
                onClick={() => {
                  setError(null);
                  setSuccessMessage(null);
                  setMode('login');
                }}
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* ================= VIEW: VERIFY PENDING ================= */}
        {mode === 'verify-pending' && (
          <div className="auth-view-card animate-fade-in">
            <div className="status-hero-icon">
              <Mail size={36} color="#8b5cf6" />
            </div>
            <h2 className="status-hero-title">Verify your email address</h2>
            <p className="status-hero-desc">
              We've sent a verification email to{' '}
              <strong style={{ color: '#f8fafc' }}>{email}</strong>. Please check your email to
              activate your account.
            </p>

            <div className="action-buttons-stack">
              <button
                className="secondary-action-btn"
                onClick={handleResendVerification}
                disabled={isLoading || resendCooldown > 0}
              >
                {resendCooldown > 0 ? (
                  <span>Resend in {resendCooldown}s</span>
                ) : (
                  <span>Resend Verification Email</span>
                )}
              </button>

              <button
                className="text-action-link"
                onClick={() => {
                  setError(null);
                  setSuccessMessage(null);
                  setPassword('');
                  setConfirmPassword('');
                  setMode('login');
                }}
              >
                Back to Sign In
              </button>
            </div>
          </div>
        )}

        {/* ================= VIEW: 2FA STEP ================= */}
        {mode === '2fa' && (
          <form className="auth-form animate-fade-in" onSubmit={handleVerify2FA}>
            <div className="security-badge-row">
              <span className="badge-new-device">NEW DEVICE DETECTED</span>
            </div>

            <div className="form-title-group">
              <h2 className="form-title">Two-Factor Authentication</h2>
              <p className="form-subtitle">
                A 6-digit security code has been sent to{' '}
                <strong style={{ color: '#f8fafc' }}>{maskedEmail}</strong>. Enter the code below to
                complete sign in.
              </p>
            </div>

            {/* 6-box OTP digits */}
            <div className="otp-boxes-row">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (otpInputRefs.current[idx] = el)}
                  type="text"
                  maxLength={1}
                  className="otp-digit-input"
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  autoFocus={idx === 0}
                />
              ))}
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={isLoading || otpDigits.join('').length !== 6}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={16} className="spin-icon" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <KeyRound size={16} />
                  <span>Verify Security Code</span>
                </>
              )}
            </button>

            <div className="two-factor-actions">
              <button
                type="button"
                className="secondary-btn-inline"
                onClick={handleResend2FA}
                disabled={isLoading || resendCooldown > 0}
              >
                {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Security Code'}
              </button>
              <button
                type="button"
                className="secondary-btn-inline"
                onClick={() => {
                  setError(null);
                  setSuccessMessage(null);
                  setMode('login');
                }}
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* ================= VIEW: VERIFY EMAIL (OTP ENTRY) ================= */}
        {mode === 'verify-email' && !isEmailVerifySuccess && (
          <form className="auth-form animate-fade-in" onSubmit={handleVerifyEmailOtp}>
            <div className="form-title-group">
              <h2 className="form-title">Verify your email</h2>
              <p className="form-subtitle">
                A 6-digit verification code was sent to{' '}
                <strong style={{ color: '#f8fafc' }}>{pendingVerificationEmail || email}</strong>. Enter it below to
                activate your account.
              </p>
            </div>

            <div className="otp-boxes-row">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (otpInputRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  className="otp-digit-input"
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  autoFocus={idx === 0}
                />
              ))}
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={isLoading || otpDigits.join('').length !== 6}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={16} className="spin-icon" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <KeyRound size={16} />
                  <span>Verify Email</span>
                </>
              )}
            </button>

            <div className="two-factor-actions">
              <button
                type="button"
                className="secondary-btn-inline"
                onClick={handleResendVerification}
                disabled={isLoading || resendCooldown > 0}
              >
                {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
              </button>
              <button
                type="button"
                className="secondary-btn-inline"
                onClick={() => {
                  setError(null);
                  setSuccessMessage(null);
                  setMode('login');
                }}
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* ================= VIEW: FORGOT PASSWORD OTP ENTRY ================= */}
        {mode === 'forgot-otp' && (
          <form className="auth-form animate-fade-in" onSubmit={handleVerifyResetOtp}>
            <div className="form-title-group">
              <h2 className="form-title">Enter verification code</h2>
              <p className="form-subtitle">
                A 6-digit reset code was sent to{' '}
                <strong style={{ color: '#f8fafc' }}>{email}</strong>. Enter it below to continue.
              </p>
            </div>

            <div className="otp-boxes-row">
              {otpDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (otpInputRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  className="otp-digit-input"
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  autoFocus={idx === 0}
                />
              ))}
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={isLoading || otpDigits.join('').length !== 6}
            >
              {isLoading ? (
                <>
                  <RefreshCw size={16} className="spin-icon" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <KeyRound size={16} />
                  <span>Verify Code</span>
                </>
              )}
            </button>

            <div className="two-factor-actions">
              <button
                type="button"
                className="secondary-btn-inline"
                onClick={handleResendResetOtp}
                disabled={isLoading || resendCooldown > 0}
              >
                {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
              </button>
              <button
                type="button"
                className="secondary-btn-inline"
                onClick={() => {
                  setError(null);
                  setSuccessMessage(null);
                  setMode('forgot-password');
                }}
              >
                Back
              </button>
            </div>
          </form>
        )}

        {/* ================= VIEW: FORGOT PASSWORD ================= */}
        {mode === 'forgot-password' && (
          <form className="auth-form animate-fade-in" onSubmit={handleForgotPassword}>
            <div className="form-title-group">
              <h2 className="form-title">Reset your password</h2>
              <p className="form-subtitle">
                Enter your account email and we'll send you a single-use password reset link.
              </p>
            </div>

            <div className="input-group">
              <label className="input-label">Account Email</label>
              <div className="input-field-wrapper">
                <Mail size={16} className="field-icon" />
                <input
                  type="email"
                  className="auth-input"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={isLoading}>
              {isLoading ? (
                <>
                  <RefreshCw size={16} className="spin-icon" />
                  <span>Sending Code...</span>
                </>
              ) : (
                <>
                  <span>Send Verification Code</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <button
              type="button"
              className="text-action-link"
              onClick={() => {
                setError(null);
                setSuccessMessage(null);
                setMode('login');
              }}
            >
              Back to Sign In
            </button>
          </form>
        )}

        {/* ================= VIEW: RESET PASSWORD ================= */}
        {mode === 'reset-password' && !isResetSuccess && (
          <form className="auth-form animate-fade-in" onSubmit={handleResetPassword}>
            <div className="form-title-group">
              <h2 className="form-title">Choose a new password</h2>
              <p className="form-subtitle">Enter your new secure password below</p>
            </div>

            <div className="input-group">
              <label className="input-label">New Password</label>
              <div className="input-field-wrapper">
                <Lock size={16} className="field-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {password && (
                <div className="password-strength-bar">
                  <div
                    className="strength-progress"
                    style={{
                      width: `${(passwordStrength.score / 4) * 100}%`,
                      backgroundColor: passwordStrength.color,
                    }}
                  />
                  <span className="strength-text" style={{ color: passwordStrength.color }}>
                    {passwordStrength.text}
                  </span>
                </div>
              )}
            </div>

            <div className="input-group">
              <label className="input-label">Confirm New Password</label>
              <div className="input-field-wrapper">
                <Lock size={16} className="field-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Repeat your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={isLoading}>
              {isLoading ? (
                <>
                  <RefreshCw size={16} className="spin-icon" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <KeyRound size={16} />
                  <span>Update Password</span>
                </>
              )}
            </button>

            <button
              type="button"
              className="text-action-link"
              onClick={() => {
                setError(null);
                setSuccessMessage(null);
                setMode('login');
              }}
            >
              Back to Sign In
            </button>
          </form>
        )}
      </div>

      <style>{`
        .auth-page-container {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0b0c12;
          position: relative;
          padding: 24px 16px;
          box-sizing: border-box;
          overflow: hidden;
        }

        .auth-ambient-glow {
          position: absolute;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(217, 70, 239, 0.05) 50%, transparent 70%);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          z-index: 0;
        }

        .floating-mailbox-btn {
          position: absolute;
          top: 24px;
          right: 24px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #f8fafc;
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          z-index: 10;
          backdrop-filter: blur(8px);
          transition: all 0.2s ease;
        }

        .floating-mailbox-btn:hover {
          background: rgba(139, 92, 246, 0.18);
          border-color: rgba(139, 92, 246, 0.4);
          color: #a78bfa;
          transform: translateY(-1px);
        }

        /* Modal Overlay Support */
        .auth-modal-overlay {
          position: fixed !important;
          inset: 0 !important;
          z-index: 9999 !important;
          background: rgba(5, 6, 12, 0.78) !important;
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          overflow-y: auto !important;
          padding: 24px 16px !important;
          overscroll-behavior: contain !important;
          animation: authOverlayFadeIn 0.2s ease-out;
        }

        @keyframes authOverlayFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .card-top-actions {
          position: absolute;
          top: 18px;
          right: 18px;
          display: flex;
          align-items: center;
          gap: 8px;
          z-index: 15;
        }

        .card-demo-inbox-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(139, 92, 246, 0.12);
          border: 1px solid rgba(139, 92, 246, 0.35);
          color: #c4b5fd;
          padding: 6px 12px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          backdrop-filter: blur(6px);
        }

        .card-demo-inbox-btn:hover {
          background: rgba(139, 92, 246, 0.25);
          border-color: rgba(139, 92, 246, 0.6);
          color: #ffffff;
          transform: translateY(-1px);
          box-shadow: 0 2px 10px rgba(139, 92, 246, 0.3);
        }

        .auth-modal-close-btn {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 50%;
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .auth-modal-close-btn:hover {
          background: rgba(239, 68, 68, 0.18);
          border-color: rgba(239, 68, 68, 0.45);
          color: #fca5a5;
          transform: scale(1.05);
        }

        .auth-card {
          width: 440px;
          max-width: 100%;
          background: #121322;
          border: 1px solid #202237;
          border-radius: 20px;
          padding: 34px 30px;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.06);
          position: relative;
          z-index: 1;
          margin: auto;
        }

        .auth-header {
          text-align: center;
          margin-bottom: 28px;
        }

     .auth-logo-badge {
       display: flex;
       align-items: center;
       justify-content: center;
       width: fit-content;
       height: auto;
       margin: 0 auto 12px;
       gap: 5px;
      }

        .auth_logo {
          width: 52px;
          height: 52px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .auth-logo-img {
          width: 52px;
          height: 52px;
          object-fit: contain;
          border-radius: 12px;
        }

        .auth-brand-name {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.03em;
          color: #ffffff;
          white-space: nowrap;
          line-height: 1;
        }

        .auth-tagline {
          font-size: 13px;
          color: #94a3b8;
          margin-top: 4px;
        }

        .feedback-banner {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 12px;
          line-height: 1.5;
          margin-bottom: 20px;
        }

        .feedback-banner.error {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.28);
          color: #fca5a5;
        }

        .feedback-banner.success {
          background: rgba(34, 197, 94, 0.12);
          border: 1px solid rgba(34, 197, 94, 0.28);
          color: #86efac;
        }

        .banner-icon {
          flex-shrink: 0;
          margin-top: 2px;
        }

        .lockout-timer-pill {
          margin-top: 6px;
          font-weight: 700;
          color: #f87171;
          font-family: 'JetBrains Mono', monospace;
        }

        .form-title-group {
          margin-bottom: 22px;
        }

        .form-title {
          font-size: 18px;
          font-weight: 700;
          color: #f8fafc;
          letter-spacing: -0.02em;
        }

        .form-subtitle {
          font-size: 12px;
          color: #94a3b8;
          margin-top: 4px;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .register-auth-card {
          padding-top: 24px;
          padding-bottom: 24px;
        }

        .register-auth-card .auth-header {
          margin-bottom: 18px;
        }

        .register-form {
          gap: 10px;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .input-label {
          font-size: 12px;
          font-weight: 600;
          color: #cbd5e1;
        }

        .forgot-password-link {
          font-size: 11px;
          color: #a78bfa;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
        }

        .forgot-password-link:hover {
          text-decoration: underline;
        }

        .input-field-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .field-icon {
          position: absolute;
          left: 14px;
          color: #64748b;
          pointer-events: none;
        }

        .auth-input {
          width: 100%;
          height: 42px;
          background: #0b0c12;
          border: 1px solid #202237;
          border-radius: 10px;
          padding: 0 40px 0 40px;
          color: #f8fafc;
          font-size: 13px;
          outline: none;
          transition: all 0.18s ease;
        }

        .auth-input:focus {
          border-color: #8b5cf6;
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
        }

        .toggle-password-btn {
          position: absolute;
          right: 12px;
          color: #64748b;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
        }

        .toggle-password-btn:hover {
          color: #f8fafc;
        }

        .password-strength-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
        }

        .strength-progress {
          height: 4px;
          border-radius: 2px;
          transition: all 0.3s ease;
        }

        .strength-text {
          font-size: 10px;
          font-weight: 600;
        }

        .form-options-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
        }

        .checkbox-container {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          user-select: none;
        }

        .checkbox-label {
          color: #94a3b8;
        }

        .auth-submit-btn {
          height: 44px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%);
          border: none;
          border-radius: 10px;
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          box-shadow: 0 4px 18px rgba(124, 58, 237, 0.35);
          transition: all 0.2s ease;
          margin-top: 6px;
        }

        .auth-submit-btn:hover:not(:disabled) {
          opacity: 0.94;
          transform: translateY(-1px);
          box-shadow: 0 6px 22px rgba(124, 58, 237, 0.45);
        }

        .auth-submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .auth-footer-prompt {
          text-align: center;
          font-size: 12px;
          color: #94a3b8;
          margin-top: 8px;
        }

        .mode-toggle-link {
          color: #a78bfa;
          background: none;
          border: none;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
        }

        .mode-toggle-link:hover {
          text-decoration: underline;
        }

        /* 2FA Boxes */
        .security-badge-row {
          display: flex;
          justify-content: center;
          margin-bottom: 8px;
        }

        .badge-new-device {
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.35);
          color: #fbbf24;
          font-size: 10px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 999px;
          letter-spacing: 0.05em;
        }

        .otp-boxes-row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin: 12px 0;
        }

        .otp-digit-input {
          width: 48px;
          height: 54px;
          background: #0b0c12;
          border: 1px solid #202237;
          border-radius: 10px;
          color: #a78bfa;
          font-family: 'JetBrains Mono', monospace;
          font-size: 24px;
          font-weight: 700;
          text-align: center;
          outline: none;
          transition: all 0.18s ease;
        }

        .otp-digit-input:focus {
          border-color: #8b5cf6;
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.18);
        }

        .demo-inbox-helper-callout {
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 8px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          color: #fcd34d;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .demo-inbox-helper-callout:hover {
          background: rgba(245, 158, 11, 0.14);
        }

        .two-factor-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 8px;
        }

        .secondary-btn-inline {
          font-size: 11px;
          color: #94a3b8;
          background: none;
          border: none;
          cursor: pointer;
        }

        .secondary-btn-inline:hover:not(:disabled) {
          color: #f8fafc;
        }

        .secondary-btn-inline:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* Status Hero View (Pending, Verification, Success) */
        .auth-view-card {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          padding: 10px 0;
        }

        .status-hero-icon {
          width: 68px;
          height: 68px;
          border-radius: 50%;
          background: rgba(139, 92, 246, 0.12);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .status-hero-title {
          font-size: 20px;
          font-weight: 700;
          color: #f8fafc;
        }

        .status-hero-desc {
          font-size: 13px;
          line-height: 1.6;
          color: #94a3b8;
        }

        .action-buttons-stack {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 14px;
        }

        .demo-inbox-highlight-btn {
          height: 44px;
          background: rgba(139, 92, 246, 0.18);
          border: 1px solid rgba(139, 92, 246, 0.35);
          color: #c4b5fd;
          font-size: 13px;
          font-weight: 600;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .demo-inbox-highlight-btn:hover {
          background: rgba(139, 92, 246, 0.26);
          color: #ffffff;
        }

        .secondary-action-btn {
          height: 40px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          font-size: 12px;
          border-radius: 8px;
          cursor: pointer;
        }

        .secondary-action-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
        }

        .text-action-link {
          font-size: 12px;
          color: #a78bfa;
          background: none;
          border: none;
          cursor: pointer;
          margin-top: 6px;
        }

        .text-action-link:hover {
          text-decoration: underline;
        }

        .token-loading-state,
        .token-error-state,
        .token-success-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          width: 100%;
          gap: 14px;
          padding: 8px 0;
        }

        .token-loading-state h2,
        .token-error-state h2,
        .token-success-state h2 {
          font-size: 18px;
          font-weight: 700;
        }

        .token-loading-state p,
        .token-error-state p,
        .token-success-state p {
          font-size: 13px;
          color: #94a3b8;
          line-height: 1.5;
        }

        .token-success-state .auth-submit-btn,
        .token-error-state .auth-submit-btn {
          width: 100%;
          height: 44px;
          margin-top: 8px;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
      `}</style>
    </div>
  );
};
