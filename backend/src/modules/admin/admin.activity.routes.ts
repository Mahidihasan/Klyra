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
      limit: limit ? parseInt(limit as string, 10) : 100,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });
    
    res.json({ success: true, data: logs });
  })
);

export const adminActivityRouter = router;
