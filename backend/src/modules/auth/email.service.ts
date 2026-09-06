import { DemoEmail } from './auth.types';
import { generateRandomToken } from './jwt.util';

// In-memory store of demo emails for mock inbox
let demoEmails: DemoEmail[] = [];

// Base frontend URL (configured or fallback to window origin / localhost:3000)
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

export class EmailService {
  /**
   * Send Account Email Verification email to demo inbox.
   */
  static async sendVerificationEmail(to: string, name: string, token: string): Promise<DemoEmail> {
    const actionUrl = `${CLIENT_URL}/?auth=verify-email&token=${token}`;
    const subject = 'Verify your Klyra Account';

    const htmlContent = `
      <div style="font-family: 'Inter', system-ui, sans-serif; max-width: 600px; margin: 0 auto; background-color: #141524; color: #f8fafc; border-radius: 12px; border: 1px solid #202237; overflow: hidden; padding: 32px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 24px;">
          <div style="width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; color: #fff;">K</div>
          <span style="font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: #ffffff;">KLYRA</span>
        </div>
        <h2 style="font-size: 20px; font-weight: 600; color: #f8fafc; margin-bottom: 12px;">Confirm your email address</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px;">
          Hi <strong style="color: #f8fafc;">${name}</strong>, welcome to Klyra! Please verify your email to activate your account and start exploring the API marketplace platform.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${actionUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);">
            Verify Email Address
          </a>
        </div>
        <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin-bottom: 8px;">
          Or copy and paste this URL into your browser:
        </p>
        <p style="font-size: 12px; color: #a78bfa; word-break: break-all; background: #0b0c12; padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06);">
          ${actionUrl}
        </p>
        <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 11px; color: #64748b;">
          This verification link is single-use and will expire in 24 hours. If you did not sign up for Klyra, you can safely disregard this message.
        </div>
      </div>
    `;

    const email: DemoEmail = {
      id: generateRandomToken(8),
      to,
      from: 'security@klyra.io',
      subject,
      category: 'VERIFY_EMAIL',
      previewText: `Hi ${name}, confirm your email address to activate your Klyra account.`,
      htmlContent,
      actionUrl,
      createdAt: new Date().toISOString(),
      read: false,
    };

    demoEmails.unshift(email);
    if (demoEmails.length > 50) demoEmails.pop();
    return email;
  }

  /**
   * Send New-Device 2FA verification code to demo inbox.
   */
  static async send2FAEmail(to: string, name: string, code: string, ip: string, userAgent: string): Promise<DemoEmail> {
    const subject = `Klyra New Device Verification: ${code}`;

    const htmlContent = `
      <div style="font-family: 'Inter', system-ui, sans-serif; max-width: 600px; margin: 0 auto; background-color: #141524; color: #f8fafc; border-radius: 12px; border: 1px solid #202237; overflow: hidden; padding: 32px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 24px;">
          <div style="width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; color: #fff;">K</div>
          <span style="font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: #ffffff;">KLYRA SECURITY</span>
        </div>
        <div style="display: inline-block; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); color: #fbbf24; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; margin-bottom: 16px;">
          NEW DEVICE DETECTED
        </div>
        <h2 style="font-size: 20px; font-weight: 600; color: #f8fafc; margin-bottom: 12px;">Your Two-Factor Authentication Code</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px;">
          Hi <strong style="color: #f8fafc;">${name}</strong>, a login was attempted from a new device or browser. To verify it's you, enter this 6-digit security code:
        </p>
        
        <div style="background: #0b0c12; border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 10px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #a78bfa;">
            ${code}
          </span>
          <p style="font-size: 12px; color: #64748b; margin-top: 8px;">Code valid for 10 minutes • Single-use only</p>
        </div>

        <div style="background: rgba(255,255,255,0.02); border-radius: 8px; padding: 14px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 24px;">
          <div style="font-size: 12px; color: #94a3b8; margin-bottom: 4px;"><strong>IP Address:</strong> ${ip}</div>
          <div style="font-size: 12px; color: #94a3b8;"><strong>Device/Browser:</strong> ${userAgent}</div>
        </div>

        <div style="padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 11px; color: #64748b;">
          If you did not initiate this login, your credentials may be compromised. Please reset your password immediately.
        </div>
      </div>
    `;

    const email: DemoEmail = {
      id: generateRandomToken(8),
      to,
      from: 'security@klyra.io',
      subject,
      category: 'TWO_FACTOR_CODE',
      previewText: `Your 6-digit security verification code is ${code}.`,
      htmlContent,
      code,
      createdAt: new Date().toISOString(),
      read: false,
    };

    demoEmails.unshift(email);
    if (demoEmails.length > 50) demoEmails.pop();
    return email;
  }

  /**
   * Send Password Reset link email to demo inbox.
   */
  static async sendPasswordResetEmail(to: string, name: string, token: string): Promise<DemoEmail> {
    const actionUrl = `${CLIENT_URL}/?auth=reset-password&token=${token}`;
    const subject = 'Reset your Klyra password';

    const htmlContent = `
      <div style="font-family: 'Inter', system-ui, sans-serif; max-width: 600px; margin: 0 auto; background-color: #141524; color: #f8fafc; border-radius: 12px; border: 1px solid #202237; overflow: hidden; padding: 32px;">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 24px;">
          <div style="width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; color: #fff;">K</div>
          <span style="font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: #ffffff;">KLYRA SECURITY</span>
        </div>
        <h2 style="font-size: 20px; font-weight: 600; color: #f8fafc; margin-bottom: 12px;">Password Reset Request</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px;">
          Hi <strong style="color: #f8fafc;">${name}</strong>, we received a request to reset your password. Click the button below to choose a new password:
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${actionUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);">
            Reset Password
          </a>
        </div>
        <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin-bottom: 8px;">
          Or copy and paste this URL into your browser:
        </p>
        <p style="font-size: 12px; color: #a78bfa; word-break: break-all; background: #0b0c12; padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06);">
          ${actionUrl}
        </p>
        <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 11px; color: #64748b;">
          This link is single-use and expires in 1 hour. If you did not request a password reset, you can safely ignore this email; your account remains secure.
        </div>
      </div>
    `;

    const email: DemoEmail = {
      id: generateRandomToken(8),
      to,
      from: 'security@klyra.io',
      subject,
      category: 'RESET_PASSWORD',
      previewText: `Reset your Klyra account password with this single-use link.`,
      htmlContent,
      actionUrl,
      createdAt: new Date().toISOString(),
      read: false,
    };

    demoEmails.unshift(email);
    if (demoEmails.length > 50) demoEmails.pop();
    return email;
  }

  /**
   * Retrieve all demo emails.
   */
  static getDemoEmails(): DemoEmail[] {
    return demoEmails;
  }

  /**
   * Retrieve single demo email by id and mark read.
   */
  static getDemoEmailById(id: string): DemoEmail | null {
    const email = demoEmails.find(e => e.id === id);
    if (email) email.read = true;
    return email || null;
  }

  /**
   * Clear demo emails.
   */
  static clearDemoEmails(): void {
    demoEmails = [];
  }
}
