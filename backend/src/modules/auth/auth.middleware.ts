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

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  const payload = verifyJwt(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }

  req.user = payload;
  next();
}

export async function authOptional(req: Request, _res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (token) {
    const payload = verifyJwt(token);
    if (payload) {
      req.user = payload;
    }
  }
  next();
}
