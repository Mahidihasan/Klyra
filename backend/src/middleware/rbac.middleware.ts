import { Request, Response, NextFunction } from 'express';
import { PrismaClient, Permission } from '@prisma/client';

const prisma = new PrismaClient();

export const requirePermission = (requiredPermission: Permission) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized: No user session found.' });
      }

      const role = (user.role || 'USER').toUpperCase();

      // Super admin overrides everything
      if (role === 'SUPER_ADMIN') {
        return next();
      }

      // Fetch role permissions
      const dbRole = await prisma.rolePermission.findUnique({
        where: { role: role as any }
      });

      if (!dbRole || !dbRole.permissions.includes(requiredPermission)) {
        return res.status(403).json({ error: `Forbidden: Missing required permission ${requiredPermission}.` });
      }

      next();
    } catch (error) {
      console.error('RBAC Middleware Error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
};
