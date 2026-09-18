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
    const apiKeys = await ApiKeysService.list(req.user!.sub);
    res.json({ apiKeys, stats: ApiKeysService.computeStats(apiKeys) });
  } catch (error) {
    sendError(res, error, 'Unable to load API keys.');
  }
});

// APIs and API Build projects the user may bind keys to (owned + subscribed).
router.get('/targets', requireAuth, async (req: Request, res: Response) => {
  try {
    res.json({ targets: await ApiKeysService.listTargets(req.user!.sub) });
  } catch (error) {
    sendError(res, error, 'Unable to load available APIs.');
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

router.patch('/:keyId', requireAuth, async (req: Request, res: Response) => {
  try {
    const apiKey = await ApiKeysService.update(req.user!.sub, req.params.keyId, req.body || {});
    res.json({ apiKey, message: 'API key updated successfully.' });
  } catch (error) {
    sendError(res, error, 'Unable to update API key.');
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

router.post('/:keyId/suspend', requireAuth, async (req: Request, res: Response) => {
  try {
    const apiKey = await ApiKeysService.suspend(req.user!.sub, req.params.keyId);
    res.json({ apiKey, message: 'API key suspended successfully.' });
  } catch (error) {
    sendError(res, error, 'Unable to suspend API key.');
  }
});

router.post('/:keyId/activate', requireAuth, async (req: Request, res: Response) => {
  try {
    const apiKey = await ApiKeysService.activate(req.user!.sub, req.params.keyId);
    res.json({ apiKey, message: 'API key reactivated successfully.' });
  } catch (error) {
    sendError(res, error, 'Unable to reactivate API key.');
  }
});

router.delete('/:keyId', requireAuth, async (req: Request, res: Response) => {
  try {
    const deleted = await ApiKeysService.delete(req.user!.sub, req.params.keyId);
    res.json({ deleted, message: 'API key deleted permanently.' });
  } catch (error) {
    sendError(res, error, 'Unable to delete API key.');
  }
});

export default router;
