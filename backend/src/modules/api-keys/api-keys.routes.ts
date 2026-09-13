import { Request, Response, Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyServiceError } from './api-keys.types';

const router = Router();

function sendError(res: Response, error: unknown, fallback: string): void {
  if (error instanceof ApiKeyServiceError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  res.status(500).json({ error: fallback });
}

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    res.json({ apiKeys: await ApiKeysService.list(req.user!.sub) });
  } catch (error) {
    sendError(res, error, 'Unable to load API keys.');
  }
});

router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await ApiKeysService.create(req.user!.sub, req.body || {});
    res.status(201).json({ ...result, message: 'API key created successfully.' });
  } catch (error) {
    sendError(res, error, 'Unable to create API key.');
  }
});

router.post('/:keyId/revoke', requireAuth, async (req: Request, res: Response) => {
  try {
    const apiKey = await ApiKeysService.revoke(req.user!.sub, req.params.keyId);
    res.json({ apiKey, message: 'API key revoked successfully.' });
  } catch (error) {
    sendError(res, error, 'Unable to revoke API key.');
  }
});

export default router;
