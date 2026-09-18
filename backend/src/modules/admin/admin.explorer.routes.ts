import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { checkPermission } from '../auth/auth.middleware';

function handleError(res: Response, route: string, err: unknown) {
  console.error(`Error in ${route}:`, err);
  return res.status(500).json({ success: false, error: { message: 'Internal Server Error' } });
}

const prisma = new PrismaClient();
const router = Router();

// GET /api/v1/admin/explorer/tables
router.get('/tables', checkPermission('VIEW_ANALYTICS'), async (req: Request, res: Response) => {
  try {
    const allModels = Object.values(Prisma.ModelName);
    return res.status(200).json({ success: true, tables: allModels });
  } catch (error: any) {
    console.error("🔥 Error fetching tables:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/v1/admin/explorer
router.get('/', checkPermission('VIEW_ANALYTICS'), async (req: Request, res: Response) => {
  try {
    const { table } = req.query; // e.g., 'User', 'CoreSettings', 'AuditLog'
    
    if (!table) {
      return res.status(400).json({ success: false, message: "Table name is required" });
    }

    // Dynamically find the correct prisma delegate client
    // (Prisma delegates are lowerCamelCase: user, coreSettings, auditLog)
    const delegateKey = (table as string).charAt(0).toLowerCase() + (table as string).slice(1);
    
    if (!(prisma as any)[delegateKey]) {
      return res.status(400).json({ success: false, message: `Invalid table model: ${table}` });
    }

    let data: any = [];
    if (delegateKey === 'coreSettings') {
      const setting = await (prisma as any)[delegateKey].findFirst();
      if (setting) data = [setting];
    } else {
      data = await (prisma as any)[delegateKey].findMany({ take: 50 });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error("🔥 EXPLORER API ERROR:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export const adminExplorerRouter = router;
