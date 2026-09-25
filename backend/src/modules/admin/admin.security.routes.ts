import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const router = Router();

// GET /api/v1/admin/security/threats - Fetch AI threat detection logs
router.get('/threats', async (req, res) => {
  try {
    const threats = await (prisma as any).moderationReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    const formattedThreats = threats.map((threat: any) => ({
      id: threat.id,
      time: threat.createdAt.toISOString().split('T')[1].replace('Z', ''),
      level: threat.severity === 'critical' ? 'critical' : threat.severity === 'high' || threat.severity === 'medium' ? 'warning' : 'info',
      msg: threat.title,
      ip: 'N/A'
    }));

    res.json(formattedThreats);
  } catch (error) {
    console.error('Error fetching threats:', error);
    res.status(500).json({ error: 'Failed to fetch threats' });
  }
});

// GET /api/v1/admin/security/threat-stats - Aggregate threat stats
router.get('/threat-stats', async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const threats = await (prisma as any).moderationReport.findMany({
      where: {
        createdAt: { gte: twentyFourHoursAgo }
      }
    });

    let critical = 0;
    let warnings = 0;
    let mitigated = 0;

    threats.forEach((t: any) => {
      if (t.severity === 'critical') critical++;
      else if (t.severity === 'high' || t.severity === 'medium') warnings++;
      
      if (!t.unread) mitigated++;
    });

    res.json({
      critical,
      warnings,
      mitigated,
      systemStatus: critical === 0
    });
  } catch (error) {
    console.error('Error fetching threat stats:', error);
    res.status(500).json({ error: 'Failed to fetch threat stats' });
  }
});

// GET /api/v1/admin/security/config - Fetch global security policies
router.get('/config', async (req, res) => {
  try {
    let setting = await (prisma as any).securitySettings.findUnique({
      where: { id: 'singleton' }
    });

    if (!setting) {
      setting = await (prisma as any).securitySettings.create({
        data: { id: 'singleton' }
      });
    }

    res.json(setting);
  } catch (error) {
    console.error('Error fetching security config:', error);
    res.status(500).json({ error: 'Failed to fetch security config' });
  }
});

// PUT /api/v1/admin/security/config - Update global security policies
router.put('/config', async (req, res) => {
  try {
    const { require_2fa, session_timeout, block_vpn, max_failed_logins } = req.body;

    const setting = await (prisma as any).securitySettings.upsert({
      where: { id: 'singleton' },
      update: {
        ...(require_2fa !== undefined && { require_2fa }),
        ...(block_vpn !== undefined && { block_vpn }),
        ...(session_timeout !== undefined && { session_timeout }),
        ...(max_failed_logins !== undefined && { max_failed_logins }),
      },
      create: {
        id: 'singleton',
        require_2fa: require_2fa ?? false,
        block_vpn: block_vpn ?? false,
        session_timeout: session_timeout ?? 60,
        max_failed_logins: max_failed_logins ?? 5
      }
    });

    // Log the change
    await (prisma as any).auditLog.create({
      data: {
        action: 'UPDATE',
        entity_type: 'security_config',
        new_values: setting,
        user_agent: req.headers['user-agent'] || 'System',
        ip_address: req.ip
      }
    });

    res.json(setting);
  } catch (error) {
    console.error('Error updating security config:', error);
    res.status(500).json({ error: 'Failed to update security config' });
  }
});

// POST /api/v1/admin/security/emergency-lockdown - Toggle DEFCON Lockdown
router.post('/emergency-lockdown', async (req, res) => {
  try {
    const { active } = req.body;
    
    await (prisma as any).system_settings.upsert({
      where: { key: 'defcon_lockdown' },
      update: { value: active, updated_at: new Date() },
      create: { key: 'defcon_lockdown', value: active, description: 'DEFCON Emergency Lockdown', is_public: true }
    });

    // Log the change
    await (prisma as any).auditLog.create({
      data: {
        action: 'UPDATE',
        entity_type: 'defcon_lockdown',
        new_values: { active },
        user_agent: req.headers['user-agent'] || 'System',
        ip_address: req.ip
      }
    });

    res.json({ success: true, active });
  } catch (error) {
    console.error('Error toggling DEFCON lockdown:', error);
    res.status(500).json({ error: 'Failed to toggle DEFCON lockdown' });
  }
});

// GET /api/v1/admin/security/metrics
router.get('/metrics', async (req, res) => {
  try {
    // 1. Calculate Score based on blocked IPs and MFA Adoption (Dummy algorithm for now)
    const totalUsers = await (prisma as any).user.count({ where: { deleted_at: null } });
    const mfaUsers = await (prisma as any).user.count({ where: { two_factor_enabled: true, deleted_at: null } });
    const mfaAdoption = totalUsers > 0 ? Math.round((mfaUsers / totalUsers) * 100) : 0;
    
    // Count IPs blocked in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const blockedIPs = await (prisma as any).auditLog.count({
      where: {
        action: 'BLOCK_IP',
        created_at: { gte: thirtyDaysAgo }
      }
    });

    let score = 85 + (mfaAdoption * 0.1) + (blockedIPs > 100 ? 5 : 0);
    if (score > 100) score = 100;

    res.json({
      score: Math.round(score),
      ipsBlocked: blockedIPs,
      mfaAdoption
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// GET /api/v1/admin/security/keys
router.get('/keys', async (req, res) => {
  try {
    const keys = await (prisma as any).platformKey.findMany({
      orderBy: { created_at: 'desc' }
    });
    res.json(keys.map((k: any) => ({
      id: k.id,
      name: k.name,
      maskedKey: k.masked_key,
      environment: k.environment,
      lastUsedAt: k.last_used_at,
      createdAt: k.created_at
    })));
  } catch (error) {
    console.error('Error fetching keys:', error);
    res.status(500).json({ error: 'Failed to fetch keys' });
  }
});

// POST /api/v1/admin/security/keys
router.post('/keys', async (req, res) => {
  try {
    const { name, environment } = req.body;
    
    // Generate raw key
    const rawKey = `sk_${environment === 'PRODUCTION' ? 'live' : 'test'}_${crypto.randomBytes(24).toString('hex')}`;
    
    // Create masked key
    const maskedKey = `${rawKey.substring(0, 12)}••••••••${rawKey.substring(rawKey.length - 4)}`;
    
    // Hash raw key for storage
    const rawKeyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const keyRecord = await (prisma as any).platformKey.create({
      data: {
        name: name || 'Unnamed Key',
        masked_key: maskedKey,
        raw_key_hash: rawKeyHash,
        environment: environment || 'TEST'
      }
    });

    res.json({
      key: {
        id: keyRecord.id,
        name: keyRecord.name,
        maskedKey: keyRecord.masked_key,
        environment: keyRecord.environment,
        lastUsedAt: keyRecord.last_used_at,
        createdAt: keyRecord.created_at
      },
      rawKey // Send back exactly once!
    });
  } catch (error) {
    console.error('Error creating key:', error);
    res.status(500).json({ error: 'Failed to create key' });
  }
});

// DELETE /api/v1/admin/security/keys/:id
router.delete('/keys/:id', async (req, res) => {
  try {
    await (prisma as any).platformKey.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error revoking key:', error);
    res.status(500).json({ error: 'Failed to revoke key' });
  }
});

// GET /api/v1/admin/security/sessions - Fetch active admin sessions
router.get('/sessions', async (req, res) => {
  try {
    const userId = (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const currentSessionId = (req as any).user?.adminSessionId;

    const sessions = await (prisma as any).session.findMany({
      where: { userId, isRevoked: false },
      orderBy: { lastActive: 'desc' }
    });

    res.json(sessions.map((s: any) => ({
      id: s.id,
      name: s.device,
      device: s.device.toLowerCase().includes('mac') ? 'desktop' : s.device.toLowerCase().includes('iphone') ? 'mobile' : 'desktop',
      ip: s.ipAddress,
      location: s.location || 'Unknown Location',
      ua: s.browser,
      time: s.lastActive.toISOString(),
      current: s.id === currentSessionId
    })));
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// DELETE /api/v1/admin/security/sessions/:id - Revoke specific session
router.delete('/sessions/:id', async (req, res) => {
  try {
    const userId = (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const sessionId = req.params.id;
    const currentSessionId = (req as any).user?.adminSessionId;
    
    if (sessionId === currentSessionId) {
      return res.status(400).json({ error: 'Cannot revoke your current session here. Use logout.' });
    }

    await (prisma as any).session.updateMany({
      where: { id: sessionId, userId },
      data: { isRevoked: true }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error revoking session:', error);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

// DELETE /api/v1/admin/security/sessions - Revoke ALL other sessions
router.delete('/sessions', async (req, res) => {
  try {
    const userId = (req as any).user?.sub;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const currentSessionId = (req as any).user?.adminSessionId;

    await (prisma as any).session.updateMany({
      where: { 
        userId, 
        id: { not: currentSessionId || '' },
        isRevoked: false
      },
      data: { isRevoked: true }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error revoking other sessions:', error);
    res.status(500).json({ error: 'Failed to revoke other sessions' });
  }
});

export const AdminSecurityRoutes = router;
