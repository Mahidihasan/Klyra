import { Router, Request, Response } from 'express';
import { loadPool, toIso } from '../admin/admin.db';
import { DatabaseUnavailableError } from '../admin/admin.users.service';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const pool = loadPool();
    if (!pool) throw new DatabaseUnavailableError();

    const { name, version, categoryId, baseUrl, pricingModel } = req.body;

    if (!name || !version || !categoryId || !baseUrl) {
      return res.status(400).json({ success: false, error: { message: 'Missing required fields' } });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Math.random().toString(36).substring(2, 7);
    
    // Mock user for now since we don't have full provider auth middleware in this simple test
    const ownerId = req.user?.sub || '00000000-0000-0000-0000-000000000000'; // fallback mock user if no auth

    let newApiId: string = '';

    await pool.query('BEGIN');
    try {
      const { rows: apiRows } = await pool.query(
        `INSERT INTO apis (name, slug, description, current_version, base_url, category_id, owner_id, pricing_model, status, is_public)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT', false)
         RETURNING id, name, slug`,
        [name, slug, 'A newly published API', version, baseUrl, categoryId, ownerId, pricingModel || 'FREE']
      );
      
      newApiId = String(apiRows[0].id);

      await pool.query(
        `INSERT INTO api_versions (api_id, version, is_current)
         VALUES ($1, $2, true)`,
        [newApiId, version]
      );

      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }

    return res.status(201).json({ success: true, data: { id: newApiId, slug } });
  } catch (err) {
    console.error('[POST /apis]', err);
    return res.status(500).json({ success: false, error: { message: 'Failed to create API' } });
  }
});

export default router;
