import { Router, Request, Response } from 'express';
import { PrismaClient, Permission, user_role } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

// Define default permissions to match frontend keys exactly
const DEFAULT_PERMISSIONS = {
  SUPER_ADMIN: Object.values(Permission),
  ADMIN: [
    Permission.VIEW_ANALYTICS_DASHBOARD, Permission.VIEW_TRANSACTIONS, Permission.VIEW_STAFF, Permission.MANAGE_STAFF,
    Permission.VIEW_USERS, Permission.EDIT_USER, Permission.SUSPEND_BAN_USERS, Permission.IMPERSONATE_USERS, Permission.VIEW_KYC_REQUESTS, Permission.APPROVE_REJECT_KYC,
    Permission.VIEW_APIS, Permission.APPROVE_REJECT_APIS, Permission.DEPRECATE_DELETE_APIS, Permission.CURATE_MARKETPLACE_FEATURED, Permission.MANAGE_API_KEYS, Permission.CONFIGURE_GATEWAY_LIMITS,
    Permission.VIEW_SECURITY_LOGS, Permission.EXPORT_SECURITY_LOGS, Permission.VIEW_SYSTEM_SETTINGS, Permission.MANAGE_SYSTEM_SETTINGS, Permission.VIEW_WEBHOOKS, Permission.MANAGE_WEBHOOKS, Permission.MANAGE_ROLES_PERMISSIONS,
    Permission.VIEW_BILLING_INVOICES, Permission.DOWNLOAD_INVOICES, Permission.PROCESS_REFUNDS, Permission.VIEW_SUBSCRIPTIONS, Permission.MANAGE_SUBSCRIPTION_PLANS, Permission.MANAGE_PROMOTIONS,
    Permission.VIEW_TACTICAL_BOARD, Permission.EXECUTE_EMERGENCY_FREEZE, Permission.VIEW_INVOICE_FORENSICS, Permission.INVOICE_FORENSICS_WAIVE, Permission.VIEW_DISPUTES, Permission.DISPUTE_MANAGER_VERIFICATION,
    Permission.VIEW_SUPPORT_TICKETS, Permission.MANAGE_SUPPORT_TICKETS, Permission.EDIT_EMAIL_TEMPLATES
  ],
  USER: []
};

// GET /api/v1/admin/rbac/roles
router.get('/roles', async (req: Request, res: Response) => {
  try {
    const roles = await prisma.rolePermission.findMany();
    
    // Fallback logic to ensure all roles are present even if DB is empty
    const roleKeys = Object.keys(DEFAULT_PERMISSIONS);
    const result = roleKeys.map(role => {
      const dbRole = roles.find(r => r.role === role);
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
    
    // 1. LOG INCOMING PAYLOAD
    console.log("--- RBAC UPDATE PAYLOAD ---");
    console.log("Updates Array:", JSON.stringify(updates, null, 2));

    if (!Array.isArray(updates)) {
      return res.status(400).json({ success: false, error: 'Invalid payload. Expected { updates: [...] }' });
    }

    const updatedRoles = [];

    // 2. PRISMA UPDATE
    for (const update of updates) {
      const { role, permissions } = update;
      
      if (!role) {
        console.warn("Skipping update due to missing role:", update);
        continue;
      }
      
      const permsArray = Array.isArray(permissions) ? permissions : [];
      
      const typedPermissions = permsArray
        .filter((p: any) => Object.values(Permission).includes(p))
        .map((p: any) => p as Permission);

      const finalPermissions = permsArray.includes('*') ? Object.values(Permission) : typedPermissions;

      const updated = await prisma.rolePermission.upsert({
        where: { role: role as user_role },
        update: { permissions: { set: finalPermissions } },
        create: { role: role as user_role, permissions: finalPermissions }
      });
      
      updatedRoles.push(updated);
    }

    return res.status(200).json({ success: true, data: updatedRoles });

  } catch (error: any) {
    // 3. LOG THE EXACT PRISMA ERROR TO THE TERMINAL
    console.error("--- PRISMA UPDATE FAILED ---");
    console.error(error);
    return res.status(500).json({ 
      error: "Failed to update roles", 
      details: error.message || String(error)
    });
  }
});

export const AdminRbacRoutes = router;
