import { Request, Response, Router } from 'express';
import { CertificatesService } from './certificates.service';

const router = Router();

router.get('/verify/:verificationToken', async (req: Request, res: Response) => {
  const token = req.params.verificationToken;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    return res.status(404).json({ valid: false });
  }
  try {
    const verification = await CertificatesService.verifyCertificate(token);
    res.status(verification.valid ? 200 : 404).json(verification);
  } catch {
    res.status(500).json({ error: 'Unable to verify certificate.' });
  }
});

export default router;
