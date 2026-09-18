import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { requireAdmin, requireSuperAdmin, requireAuth } from '../auth/auth.middleware';
import bcrypt from 'bcryptjs';

function handleError(res: Response, route: string, err: unknown) {
  console.error(`Error in ${route}:`, err);
  return res.status(500).json({ success: false, error: { message: 'Internal Server Error' } });
}

const formatPrismaError = (error: any) => {
  // 1. Handle Unique Constraint Violations (e.g., Email already exists)
  if (error.code === 'P2002') {
    const target = error.meta?.target ? (error.meta.target as string[]).join(', ') : 'field';
    return `A record with this ${target} already exists. Please use a unique value.`;
  }
  
  // 2. Handle Postgres Check Constraint Violations
  if (error.message?.includes('violates check constraint')) {
    if (error.message.includes('email_format') || error.message.includes('users_email_format')) {
      return "Invalid email format. Please provide a valid email address (e.g., name@example.com).";
    }
    // Generic check constraint match
    const match = error.message.match(/constraint "([^"]+)"/);
    const constraintName = match ? match[1] : 'unknown';
    return `Data validation failed. Please check your input (Rule: ${constraintName}).`;
  }

  // 3. Handle Data Validation (e.g., string too long, wrong type)
  if (error.code === 'P2000') return "The provided value is too long for the column.";
  if (error.code === 'P2006') return "The provided value is not valid for this field type.";

  // 4. Default: Return the last line of the error message to avoid sending massive stack traces
  const lines = error.message ? error.message.split('\n') : [];
  const lastLine = lines[lines.length - 1];
  return lastLine || "An unexpected database error occurred.";
};

const prisma = new PrismaClient();
const router = Router();

// GET /api/v1/admin/explorer/tables
router.get('/tables', requireAdmin, async (req: Request, res: Response) => {
  try {
    const allModels = Prisma.dmmf.datamodel.models.map((m: any) => m.name);
    return res.status(200).json({ success: true, tables: allModels });
  } catch (error: any) {
    console.error("🔥 Error fetching tables:", error);
    return res.status(500).json({ success: false, message: formatPrismaError(error) });
  }
});

// GET /api/v1/admin/explorer/audit-logs
router.get('/audit-logs', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      take: 200,
      orderBy: { created_at: 'desc' }
    });
    return res.status(200).json({ success: true, data: logs });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: formatPrismaError(error) });
  }
});

// GET /api/v1/admin/explorer/recycle-bin
router.get('/recycle-bin', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const deletedLogs = await prisma.auditLog.findMany({
      where: { action: 'DELETE' },
      orderBy: { created_at: 'desc' },
      take: 100
    });
    
    const formattedBin = deletedLogs.map(log => {
      let name = 'Deleted Record';
      let originalTable = 'UNKNOWN';
      
      if (log.old_values && typeof log.old_values === 'object') {
        const ov = log.old_values as any;
        originalTable = ov._originalTable || log.entity_type || 'UNKNOWN';
        name = ov.email || ov.name || ov.title || ov.username || `ID: ${log.entity_id || log.id}`;
      } else {
        originalTable = log.entity_type || 'UNKNOWN';
        name = `ID: ${log.entity_id || log.id}`;
      }
      return {
        id: log.entity_id || log.id,
        type: originalTable.toUpperCase(),
        name: name,
        deleted_at: log.created_at,
        deleted_by: log.user_id || 'System'
      };
    });
    
    return res.status(200).json({ success: true, data: formattedBin });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: formatPrismaError(error) });
  }
});

// POST /api/v1/admin/explorer/recycle-bin/restore/:table/:id
router.post('/recycle-bin/restore/:table/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { table, id } = req.params;
    const delegateKey = table.charAt(0).toLowerCase() + table.slice(1);
    const parsedId = isNaN(id as any) ? id : parseInt(id as string);
    
    const restoredRecord = await (prisma as any)[delegateKey].update({
      where: { id: parsedId },
      data: { deleted_at: null }
    });
    
    return res.status(200).json({ success: true, data: restoredRecord });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: formatPrismaError(error) });
  }
});

// DELETE /api/v1/admin/explorer/recycle-bin/delete/:table/:id
router.delete('/recycle-bin/delete/:table/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { table, id } = req.params;
    const delegateKey = table.charAt(0).toLowerCase() + table.slice(1);
    const parsedId = isNaN(id as any) ? id : parseInt(id as string);
    
    await (prisma as any)[delegateKey].delete({
      where: { id: parsedId }
    });
    
    return res.status(200).json({ success: true, message: "Record permanently deleted" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: formatPrismaError(error) });
  }
});

// DELETE /api/v1/admin/explorer/recycle-bin/empty
router.delete('/recycle-bin/empty', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { table } = req.query;
    if (!table) return res.status(400).json({ success: false, message: "Table name is required" });
    const delegateKey = (table as string).charAt(0).toLowerCase() + (table as string).slice(1);
    
    await (prisma as any)[delegateKey].deleteMany({
      where: { deleted_at: { not: null } }
    });
    
    return res.status(200).json({ success: true, message: "Recycle bin emptied" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: formatPrismaError(error) });
  }
});

// GET /api/v1/admin/explorer
router.get('/', requireAdmin, async (req: Request, res: Response) => {
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

    // 2. Fetch Schema Metadata using DMMF
    const modelSchema = Prisma.dmmf.datamodel.models.find(m => m.name.toLowerCase() === (table as string).toLowerCase());
    const allEnums = Prisma.dmmf.datamodel.enums;
    
    let fieldsMetadata: any[] = [];
    if (modelSchema) {
      fieldsMetadata = modelSchema.fields.map(field => {
        if (field.kind === 'enum') {
          const enumData = allEnums.find(e => e.name === field.type);
          return { ...field, enumValues: enumData ? enumData.values.map(v => v.name) : [] };
        }
        return field;
      });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, data, schema: fieldsMetadata });
  } catch (error: any) {
    console.error(`🔥 GET DATA ERROR FOR TABLE ${req.query.table}:`, error);
    return res.status(500).json({ success: false, message: formatPrismaError(error) });
  }
});

// POST /api/v1/admin/explorer/request-access
router.post('/request-access', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.sub || req.user?.id || 'Unknown';
    console.log(`⚠️ ALERT: User ${userId} requested Database Explorer access.`);
    
    if ((prisma as any).auditLog) {
      await (prisma as any).auditLog.create({
        data: {
          action: "REQUEST_ACCESS",
          entity_type: "Database Explorer",
          user_id: userId,
          ip_address: req.ip || "",
          new_values: { details: "Requested access to raw database tables." }
        }
      }).catch((e: any) => console.error('Audit Log failed:', e));
    }
    
    return res.status(200).json({ success: true, message: "Request logged for manual approval." });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: formatPrismaError(error) });
  }
});

// PUT /api/v1/admin/explorer
router.put('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { table, id } = req.query;
    const updateData = req.body;
    if (!table || !id) return res.status(400).json({ success: false, message: "Table and ID required" });

    const delegateName = (table as string).charAt(0).toLowerCase() + (table as string).slice(1);
    
    // Handle ID type appropriately (UUID string vs Int ID)
    const parsedId = isNaN(id as any) ? id : parseInt(id as string);

    // Prevent updating immutable fields
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.created_at;
    delete updateData.updated_at;

    const updatedRecord = await (prisma as any)[delegateName].update({
      where: { id: parsedId },
      data: updateData
    });

    return res.status(200).json({ success: true, data: updatedRecord });
  } catch (error: any) {
    console.error("🔥 UPDATE ERROR:", error);
    return res.status(500).json({ success: false, message: formatPrismaError(error) });
  }
});

// POST /api/v1/admin/explorer
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { table } = req.query;
    const insertData = req.body;
    if (!table) return res.status(400).json({ success: false, message: "Table required" });

    const delegateName = (table as string).charAt(0).toLowerCase() + (table as string).slice(1);
    
    // Safety: Prisma creates IDs and timestamps automatically. Remove them if passed.
    delete insertData.id;
    delete insertData.createdAt;
    delete insertData.updatedAt;
    delete insertData.created_at;
    delete insertData.updated_at;

    // --- 🚨 DEFAULT PASSWORD INTERCEPTOR 🚨 ---
    if (delegateName === 'user') {
      const defaultPassword = '123456';
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(defaultPassword, salt);
      insertData.passwordHash = hashedPassword; 
    }

    const newRecord = await (prisma as any)[delegateName].create({
      data: insertData
    });

    return res.status(201).json({ success: true, data: newRecord });
  } catch (error: any) {
    console.error("🔥 CREATE ERROR:", error);
    return res.status(500).json({ success: false, message: formatPrismaError(error) });
  }
});

// DELETE /api/v1/admin/explorer/:table/:id
router.delete('/:table/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { table, id } = req.params;
    if (!table || !id) return res.status(400).json({ success: false, message: "Table and ID required" });

    const delegateName = table.charAt(0).toLowerCase() + table.slice(1);
    const cleanId = String(id).trim();
    const parsedId = /^\d+$/.test(cleanId) ? parseInt(cleanId, 10) : cleanId;

    // 1. Fetch the full record BEFORE deleting
    const recordToTrash = await (prisma as any)[delegateName].findUnique({
      where: { id: parsedId }
    });

    if (!recordToTrash) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }

    const archivePayload = {
      _originalTable: delegateName,
      ...(recordToTrash as object)
    };

    // 2. CREATE AUDIT LOG FIRST (Safeguard)
    await prisma.auditLog.create({
      data: {
        action: 'DELETE', // Strictly matches the Prisma Enum
        entity_type: table.toUpperCase(),
        entity_id: String(parsedId),
        user_id: (req as any).user?.id || null, 
        old_values: archivePayload as any, 
        ip_address: req.ip || null,
        user_agent: req.headers['user-agent'] || null
      }
    });

    // 3. Perform the actual hard delete ONLY AFTER the log is successfully created
    await (prisma as any)[delegateName].delete({
      where: { id: parsedId }
    });

    return res.status(200).json({ success: true, message: "Moved to Recycle Bin" });
  } catch (error: any) {
    console.error("🔥 DELETE ERROR:", error);
    return res.status(500).json({ success: false, message: formatPrismaError(error) });
  }
});

export const adminExplorerRouter = router;
