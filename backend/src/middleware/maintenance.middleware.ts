import { Request, Response, NextFunction } from 'express';
import { getMaintenanceStatus } from '../modules/admin/controllers/PlatformController';
import { extractBearerToken } from '../modules/auth/auth.middleware';
import { verifyJwt } from '../modules/auth/jwt.util';

export const checkMaintenanceMode = (req: Request, res: Response, next: NextFunction) => {
  const isMaintenanceOn = getMaintenanceStatus();
  
  if (!isMaintenanceOn) {
    return next();
  }

  // Check if requester has a valid JWT AND their role is ADMIN
  const token = extractBearerToken(req);
  if (token) {
    try {
      const payload = verifyJwt(token);
      if (payload && payload.role && ['ADMIN', 'MODERATOR'].includes(payload.role.toUpperCase())) {
        return next();
      }
    } catch (err) {
      // Token verification failed, fall through to 503
    }
  }

  // If not an Admin, return 503 Service Unavailable
  return res.status(503).json({ 
    error: "Service Unavailable", 
    message: "System is undergoing maintenance. Please try again later." 
  });
};
