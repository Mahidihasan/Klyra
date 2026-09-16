import { Router, Request, Response } from 'express';
import { AccountDeactivationError, AuthService, PasswordChangeError } from './auth.service';
import { EmailService } from './email.service';
import { OtpError } from './otp.service';
import { EmailDeliveryError } from './email.service';
import { authLimiter, resendLimiter } from './auth.rate-limiter';
import { requireAuth } from './auth.middleware';
import { avatarUpload } from '../../utils/fileUpload';

const router = Router();

/**
 * Map auth errors to HTTP statuses using the project's existing error shape.
 * Never leaks provider internals; OtpError/EmailDeliveryError messages are safe.
 */
function sendAuthError(res: Response, err: any, fallback: string): void {
  if (err instanceof EmailDeliveryError) {
    res.status(502).json({ error: err.message, code: 'EMAIL_SEND_FAILED' });
    return;
  }
  if (err instanceof OtpError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  res.status(400).json({ error: err.message || fallback });
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function getUserAgent(req: Request): string {
  return req.headers['user-agent'] || 'Unknown Device';
}

// 1. REGISTER
router.post('/register', authLimiter, async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body || {};
    const result = await AuthService.register(name, email, password);
    res.status(201).json(result);
  } catch (err: any) {
    sendAuthError(res, err, 'Registration failed.');
  }
});

// 2. VERIFY EMAIL (6-digit OTP)
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body || {};
    const result = await AuthService.verifyEmail(email, otp);
    res.json(result);
  } catch (err: any) {
    sendAuthError(res, err, 'Email verification failed.');
  }
});

// 3. RESEND VERIFICATION EMAIL
router.post('/resend-verification', resendLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email address is required.' });
    const result = await AuthService.resendVerification(email);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to resend verification email.' });
  }
});

// 4. LOGIN
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, rememberMe } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    const result = await AuthService.login(email, password, !!rememberMe, ip, userAgent);
    res.json(result);
  } catch (err: any) {
    const status = err.code === 'EMAIL_NOT_VERIFIED' || err.code === 'ACCOUNT_INACTIVE' ? 403 : err.message?.includes('locked') ? 423 : 401;
    res.status(status).json({
      error: err.message || 'Login failed.',
      code: err.code || 'LOGIN_ERROR',
    });
  }
});

// 5. VERIFY 2FA
router.post('/verify-2fa', authLimiter, async (req: Request, res: Response) => {
  try {
    const { tempToken, code } = req.body || {};
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    const result = await AuthService.verify2FA(tempToken, code, ip, userAgent);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || '2FA verification failed.' });
  }
});

// 6. RESEND 2FA CODE
router.post('/resend-2fa', resendLimiter, async (req: Request, res: Response) => {
  try {
    const { tempToken } = req.body || {};
    const ip = getClientIp(req);
    const userAgent = getUserAgent(req);

    const result = await AuthService.resend2FA(tempToken, ip, userAgent);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to resend 2FA code.' });
  }
});

// 7. FORGOT PASSWORD
router.post('/forgot-password', resendLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email address is required.' });
    const result = await AuthService.forgotPassword(email);
    res.json(result);
  } catch (err: any) {
    sendAuthError(res, err, 'Failed to process password reset request.');
  }
});

// 7b. VERIFY PASSWORD RESET OTP -> issues short-lived single-use reset token
router.post('/verify-reset-otp', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body || {};
    const result = await AuthService.verifyResetOtp(email, otp);
    res.json(result);
  } catch (err: any) {
    sendAuthError(res, err, 'Verification failed.');
  }
});

// 8. RESET PASSWORD
router.post('/reset-password', authLimiter, async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body || {};
    const result = await AuthService.resetPassword(token, password);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Password reset failed.' });
  }
});

router.post('/verify-totp', authLimiter, async (req: Request, res: Response) => {
  try { res.json(await AuthService.verifyLoginTotp(req.body?.tempToken, req.body?.code, getClientIp(req), getUserAgent(req))); }
  catch (err: any) { res.status(400).json({ error: err.message || 'Authenticator verification failed.' }); }
});

// 8b. CHANGE PASSWORD (authenticated)
router.put('/change-password', requireAuth, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const result = await AuthService.changePassword(
      req.user!.sub,
      currentPassword,
      newPassword,
      req.user!.sessionId,
    );
    res.json(result);
  } catch (err: any) {
    if (err instanceof PasswordChangeError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Unable to change password.' });
  }
});

router.post('/security/totp/setup', requireAuth, authLimiter, async (req, res) => {
  try { res.json(await AuthService.startTotpSetup(req.user!.sub)); } catch (err: any) { res.status(400).json({ error: err.message || 'Unable to start authenticator setup.' }); }
});
router.post('/security/totp/confirm', requireAuth, authLimiter, async (req, res) => {
  try { res.json(await AuthService.confirmTotpSetup(req.user!.sub, req.body?.code)); } catch (err: any) { res.status(400).json({ error: err.message || 'Unable to confirm authenticator setup.' }); }
});
router.post('/security/totp/disable', requireAuth, authLimiter, async (req, res) => {
  try { res.json(await AuthService.disableTotp(req.user!.sub, req.body?.currentPassword, req.body?.code)); } catch (err: any) { res.status(400).json({ error: err.message || 'Unable to disable authenticator app 2FA.' }); }
});
router.get('/security/sessions', requireAuth, async (req, res) => {
  try { res.json({ sessions: await AuthService.listSecuritySessions(req.user!.sub, req.user!.sessionId) }); } catch (err: any) { res.status(500).json({ error: err.message || 'Unable to load sessions.' }); }
});
router.delete('/security/sessions/:sessionId', requireAuth, async (req, res) => {
  try { res.json(await AuthService.revokeSecuritySession(req.user!.sub, req.params.sessionId, req.user!.sessionId)); } catch (err: any) { res.status(404).json({ error: err.message || 'Unable to revoke session.' }); }
});
router.post('/security/sessions/revoke-others', requireAuth, async (req, res) => {
  try { res.json(await AuthService.revokeOtherSecuritySessions(req.user!.sub, req.user!.sessionId)); } catch (err: any) { res.status(500).json({ error: err.message || 'Unable to revoke sessions.' }); }
});

// 8c. DEACTIVATE ACCOUNT (authenticated, password re-authentication required)
router.post('/account/deactivate', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await AuthService.deactivateAccount(req.user!.sub, req.body?.currentPassword);
    res.json(result);
  } catch (err: any) {
    if (err instanceof AccountDeactivationError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Unable to deactivate account.' });
  }
});

// 8d. ACCOUNT REACTIVATION (public, email-OTP ownership proof)
router.post('/account/reactivation/request', resendLimiter, async (req: Request, res: Response) => {
  try {
    const result = await AuthService.requestAccountReactivation(req.body?.email);
    res.json(result);
  } catch {
    // Keep this endpoint enumeration-safe even for unexpected failures.
    res.json({ success: true, message: 'If an eligible inactive account exists for this email address, a verification code has been sent.' });
  }
});

router.post('/account/reactivation/confirm', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body || {};
    const result = await AuthService.confirmAccountReactivation(email, otp);
    res.json(result);
  } catch (err: any) {
    sendAuthError(res, err, 'Unable to reactivate this account.');
  }
});

// 9. REFRESH TOKEN
router.post('/refresh-token', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body || {};
    const result = await AuthService.refreshAccessToken(refreshToken);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Token refresh failed.' });
  }
});

// 10. CURRENT USER PROFILE
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    const user = await AuthService.getProfile(userId!);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch user profile.' });
  }
});

// 10b. PROFILE READ / UPDATE
// Profile lives under the established /api/auth base rather than the stale
// documented /api/v1/users surface.
router.get('/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await AuthService.getProfile(req.user!.sub);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch profile.' });
  }
});

router.put('/profile', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await AuthService.updateProfile(req.user!.sub, req.body || {});
    res.json({ user, message: 'Profile updated successfully.' });
  } catch (err: any) {
    const status = err.message === 'User not found.' ? 404 : 400;
    res.status(status).json({ error: err.message || 'Failed to update profile.' });
  }
});

router.put('/profile/preferences', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await AuthService.updatePreferences(req.user!.sub, req.body || {});
    res.json({ user, message: 'Preferences saved successfully.' });
  } catch (err: any) {
    const status = err.message === 'User not found.' ? 404 : 400;
    res.status(status).json({ error: err.message || 'Failed to save preferences.' });
  }
});

router.post('/profile/avatar', requireAuth, (req: Request, res: Response) => {
  avatarUpload.single('avatar')(req, res, async (err: any) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Avatar must be 3 MB or smaller.'
        : err.message || 'Unable to upload avatar.';
      return res.status(400).json({ error: message });
    }
    if (!req.file) return res.status(400).json({ error: 'Select an avatar image to upload.' });

    try {
      const user = await AuthService.updateAvatar(req.user!.sub, req.file);
      res.json({ user, message: 'Profile picture updated successfully.' });
    } catch (error: any) {
      const status = error.message === 'User not found.' ? 404 : 500;
      res.status(status).json({ error: error.message || 'Unable to upload avatar.' });
    }
  });
});

router.delete('/profile/avatar', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await AuthService.removeAvatar(req.user!.sub);
    res.json({ user, message: 'Profile picture removed successfully.' });
  } catch (error: any) {
    const status = error.message === 'User not found.' ? 404 : 500;
    res.status(status).json({ error: error.message || 'Unable to remove avatar.' });
  }
});

// 11. LOGIN HISTORY
router.get('/login-history', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const history = await AuthService.getLoginHistory(userId);
    res.json({ history });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch login history.' });
  }
});

// 12. LOGOUT
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub;
    const sessionId = req.user?.sessionId;
    await AuthService.logout(userId!, sessionId);
    res.json({ success: true, message: 'Successfully logged out.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Logout failed.' });
  }
});

// ================= DEMO EMAIL SYSTEM ENDPOINTS =================
// 13. GET DEMO EMAILS
router.get('/demo-emails', (_req: Request, res: Response) => {
  res.json({ emails: EmailService.getDemoEmails() });
});

// 14. GET SINGLE DEMO EMAIL
router.get('/demo-emails/:id', (req: Request, res: Response) => {
  const email = EmailService.getDemoEmailById(req.params.id);
  if (!email) return res.status(404).json({ error: 'Email not found.' });
  res.json({ email });
});

// 15. CLEAR DEMO EMAILS
router.delete('/demo-emails', (_req: Request, res: Response) => {
  EmailService.clearDemoEmails();
  res.json({ success: true, message: 'Demo inbox cleared.' });
});

export default router;
