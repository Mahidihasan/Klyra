import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

// Define default permissions to match frontend keys exactly
const DEFAULT_PERMISSIONS = {
  SUPER_ADMIN: ['*'],
  ADMIN: ['view_dashboard', 'view_revenue', 'manage_users', 'manage_roles', 'impersonate', 'approve_apis', 'delete_apis', 'curate_market', 'manage_gateway', 'revoke_keys', 'view_logs', 'manage_billing', 'manage_plans'],
  USER: []
};

// GET /api/v1/admin/rbac/roles
router.get('/roles', async (req: Request, res: Response) => {
  try {
    const roles = await (prisma as any).rolePermission.findMany();
    
    // Fallback logic to ensure all roles are present even if DB is empty
    const roleKeys = Object.keys(DEFAULT_PERMISSIONS);
    const result = roleKeys.map(role => {
      const dbRole = roles.find((r: any) => r.role === role);
      return {
        role,
        permissions: dbRole ? dbRole.permissions : (DEFAULT_PERMISSIONS as any)[role]
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch roles' });
  }
});

// PUT /api/v1/admin/rbac/roles
router.put('/roles', async (req: Request, res: Response) => {
  try {
    const { updates } = req.body;
    // updates should be an array: { role: string, permissions: string[] }[]

    if (!Array.isArray(updates)) {
      return res.status(400).json({ success: false, error: 'Invalid payload. Expected { updates: [...] }' });
    }

    // Upsert each role
    for (const update of updates) {
      if (update.role && Array.isArray(update.permissions)) {
        await (prisma as any).rolePermission.upsert({
          where: { role: update.role },
          update: { permissions: update.permissions },
          create: { role: update.role, permissions: update.permissions }
        });
      }
    }

    res.json({ success: true, message: 'Permissions updated successfully' });
  } catch (error) {
    console.error('Error updating roles:', error);
    res.status(500).json({ success: false, error: 'Failed to update roles' });
  }
});

export const AdminRbacRoutes = router;
