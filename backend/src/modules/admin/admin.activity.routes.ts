import { Router } from 'express';
import { adminActivityService } from './admin.activity.service';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

router.get(
  '/logs',
  asyncHandler(async (req, res) => {
    const { severity, entity, search, limit, offset } = req.query;
    
    const logs = await adminActivityService.getActivityLogs({
      severity: severity as string,
      entity: entity as string,
      search: search as string,
      limit: limit ? Math.min(100, Math.max(1, parseInt(limit as string, 10) || 100)) : 100,
      offset: offset ? Math.max(0, parseInt(offset as string, 10) || 0) : 0,
    });
    
    res.json({ success: true, data: logs });
  })
);

export const adminActivityRouter = router;
