import { Request, Response, NextFunction } from 'express';
import { verifyJwt } from './jwt.util';
import { JwtPayload } from './auth.types';
import { pool } from '../../services/database.service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
}

/** Verify that a JWT still represents an active account and live session. */
export async function isActiveAuthenticatedUser(payload: JwtPayload): Promise<boolean> {
  const result = await pool.query(
    `SELECT u.id, u.status, u.is_active, u.deleted_at, s.id AS session_id, s.revoked_at, s.expires_at
     FROM users u
     LEFT JOIN user_sessions s ON s.id = $2::uuid AND s.user_id = u.id
     WHERE u.id = $1`,
    [payload.sub, payload.sessionId || null],
  );
  const user = result.rows[0];
  if (!user || user.status !== 'ACTIVE' || !user.is_active || user.deleted_at) return false;

  // New Klyra tokens always carry a session id. Preserve legacy JWT support
  // while strictly enforcing revocation where a session is present.
  if (payload.sessionId) {
    if (!user.session_id || user.revoked_at || new Date(user.expires_at) < new Date()) return false;
  }
  return true;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  const payload = verifyJwt(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }

  try {
    if (!await isActiveAuthenticatedUser(payload)) {
      return res.status(401).json({ error: 'Authentication session is inactive or revoked.' });
    }
  } catch {
    return res.status(500).json({ error: 'Unable to validate authentication session.' });
  }

  req.user = payload;
  next();
}

export async function authOptional(req: Request, _res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (token) {
    const payload = verifyJwt(token);
    if (payload) {
      try {
        if (await isActiveAuthenticatedUser(payload)) req.user = payload;
      } catch {
        // Optional authentication should remain anonymous if validation fails.
      }
    }
  }
  next();
}
