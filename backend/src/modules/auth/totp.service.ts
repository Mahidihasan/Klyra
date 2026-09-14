import crypto from 'crypto';
import QRCode from 'qrcode';
import { generateSecret, generateURI, verify } from 'otplib';

/** A distinct, 32-byte base64url key; never share the JWT signing key. */
function encryptionKey(): Buffer {
  const configured = process.env.TOTP_ENCRYPTION_KEY;
  if (!configured) throw new Error('Authenticator setup is unavailable because server encryption is not configured.');
  const key = Buffer.from(configured, 'base64url');
  if (key.length !== 32) throw new Error('Authenticator setup is unavailable because server encryption is invalid.');
  return key;
}

export function encryptTotpSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ciphertext.toString('base64url')}`;
}

export function decryptTotpSecret(value: string): string {
  const [version, iv, tag, ciphertext] = value.split(':');
  if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('Stored authenticator configuration is invalid.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}

export async function createTotpSetup(email: string): Promise<{ secret: string; qrCodeDataUrl: string }> {
  const secret = generateSecret({ length: 20 });
  const uri = generateURI({ issuer: 'Klyra', label: email, secret });
  return { secret, qrCodeDataUrl: await QRCode.toDataURL(uri, { errorCorrectionLevel: 'M', margin: 1, width: 220 }) };
}

export async function verifyTotp(secret: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code.trim())) return false;
  return (await verify({ secret, token: code.trim() })).valid;
}
