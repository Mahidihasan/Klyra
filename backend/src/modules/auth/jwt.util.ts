import crypto from 'crypto';
import { JwtPayload } from './auth.types';

const JWT_SECRET = process.env.JWT_SECRET || 'klyra-default-jwt-secret-key-32bytes-long-min';

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return Buffer.from(str, 'base64').toString('utf8');
}

/**
 * Sign a payload into an HMAC-SHA256 JWT string.
 */
export function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>, expiresInSeconds: number): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));

  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(dataToSign)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${dataToSign}.${signature}`;
}

/**
 * Verify an HMAC-SHA256 JWT string. Returns payload if valid, or null if invalid/expired.
 */
export function verifyJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(dataToSign)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payload: JwtPayload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Hash raw token/secret with SHA-256 for secure database storage.
 */
export function sha256(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Generate cryptographically secure random hex token.
 */
export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate cryptographically secure 6-digit numeric 2FA code.
 */
export function generate2FACode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Device fingerprint hashing based on User-Agent and IP address.
 */
export function generateDeviceFingerprint(userAgent: string, ip: string): string {
  return sha256(`${userAgent}:::${ip}`).slice(0, 16);
}
