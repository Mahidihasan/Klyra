import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { pool } from '../../services/database.service';
import { ensureReposSchema } from './repos.db';

export interface KlyraUser {
  id: number;
  username: string;
  email: string | null;
  display_name: string | null;
  avatar_color: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      klyraUser?: KlyraUser;
    }
  }
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function registerUser(username: string, password: string, email?: string, displayName?: string) {
  await ensureReposSchema();
  const exists = await pool.query('SELECT id FROM kr_users WHERE username = $1', [username]);
  if (exists.rows.length > 0) throw new Error('Username already taken');
  const colors = ['#8b5cf6', '#22c55e', '#f59e0b', '#22d3ee', '#ef4444', '#d946ef'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const result = await pool.query(
    `INSERT INTO kr_users (username, password_hash, email, display_name, avatar_color)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, display_name, avatar_color`,
    [username, hashPassword(password), email || null, displayName || username, color]
  );
  const user = result.rows[0] as KlyraUser;
  const token = await issueToken(user.id);
  return { user, token };
}

export async function loginUser(username: string, password: string) {
  await ensureReposSchema();
  const result = await pool.query('SELECT * FROM kr_users WHERE username = $1', [username]);
  const row = result.rows[0];
  if (!row || !verifyPassword(password, row.password_hash)) throw new Error('Invalid username or password');
  const user: KlyraUser = {
    id: row.id, username: row.username, email: row.email,
    display_name: row.display_name, avatar_color: row.avatar_color,
  };
  const token = await issueToken(user.id);
  return { user, token };
}

async function issueToken(userId: number): Promise<string> {
  const token = `kly_${randomBytes(24).toString('hex')}`;
  await pool.query('INSERT INTO kr_tokens (token, user_id) VALUES ($1, $2)', [token, userId]);
  return token;
}

async function userFromToken(token: string): Promise<KlyraUser | null> {
  const result = await pool.query(
    `SELECT u.id, u.username, u.email, u.display_name, u.avatar_color
     FROM kr_tokens t JOIN kr_users u ON u.id = t.user_id WHERE t.token = $1`,
    [token]
  );
  return (result.rows[0] as KlyraUser) || null;
}

/**
 * Local development uses one shared owner so repository work does not require
 * creating test accounts. This is deliberately unavailable in production.
 */
async function developmentUser(): Promise<KlyraUser> {
  await ensureReposSchema();
  const result = await pool.query(
    `INSERT INTO kr_users (username, password_hash, display_name, avatar_color)
     VALUES ('development', 'development-access-disabled-in-production', 'Development Access', '#8b5cf6')
     ON CONFLICT (username) DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING id, username, email, display_name, avatar_color`,
  );
  return result.rows[0] as KlyraUser;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  if (header?.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(header.slice(6), 'base64').toString();
      // Git clients use "username:token" — token is the password part
      const [, pass] = decoded.split(':');
      if (pass?.startsWith('kly_')) return pass;
      if (decoded.startsWith('kly_')) return decoded;
    } catch { /* ignore */ }
  }
  const qp = req.query['access_token'];
  if (typeof qp === 'string' && qp.startsWith('kly_')) return qp;
  return null;
}

export async function authOptional(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (token) req.klyraUser = (await userFromToken(token)) ?? undefined;
  if (!req.klyraUser && process.env.NODE_ENV !== 'production') {
    req.klyraUser = await developmentUser();
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.klyraUser) return res.status(401).json({ error: 'Authentication required' });
  next();
}

export async function resolveGitIdentity(req: Request): Promise<KlyraUser | null> {
  const token = extractToken(req);
  if (!token) return null;
  return userFromToken(token);
}
