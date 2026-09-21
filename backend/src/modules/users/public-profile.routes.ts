import { Request, Response, Router } from 'express';
import { PublicProfileService } from './public-profile.service';
import { authOptional } from '../auth/auth.middleware';

const router = Router();

router.get('/search', authOptional, async (req: Request, res: Response) => {
  try {
    const query = typeof req.query.query === 'string' ? req.query.query : '';
    return res.json(await PublicProfileService.searchUsernames(query, req.user?.sub));
  } catch (error) {
    console.error('Failed to search public usernames:', error);
    return res.status(500).json({ error: 'Unable to search public usernames.' });
  }
});

router.get('/:username/profile', authOptional, async (req: Request, res: Response) => {
  try {
    const profile = await PublicProfileService.getByUsername(req.params.username, req.user?.sub);
    if (!profile) return res.status(404).json({ error: 'User not found.' });
    return res.json(profile);
  } catch (error) {
    console.error('Failed to fetch public profile:', error);
    return res.status(500).json({ error: 'Unable to fetch public profile.' });
  }
});

export default router;
