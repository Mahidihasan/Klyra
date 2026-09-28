import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';

const prisma = new PrismaClient();

// Configure Redis Client
// Connects to the existing Redis instance specified in environment
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisClient = createClient({ url: redisUrl });

redisClient.on('error', (err) => console.error('[Redis Client] Error:', err));
redisClient.connect().catch(console.error);

export class EngineController {
  /**
   * GET /api/v1/admin/engine/health
   * Retrieve real-time engine health statistics
   */
  static async getHealth(req: Request, res: Response) {
    try {
      // Check Postgres connectivity
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const dbLatency = Date.now() - dbStart;

      // Check Redis connectivity
      const redisStart = Date.now();
      await redisClient.ping();
      const redisLatency = Date.now() - redisStart;

      return res.status(200).json({
        status: 'healthy',
        components: {
          database: { status: 'up', latencyMs: dbLatency },
          redis: { status: 'up', latencyMs: redisLatency }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[EngineController] getHealth error:', error);
      return res.status(500).json({ error: 'Engine health check failed', details: (error as Error).message });
    }
  }

  /**
   * POST /api/v1/admin/engine/cache/global-purge
   * Triggers a global cache flush on the Redis instance
   */
  static async globalPurge(req: Request, res: Response) {
    try {
      const { targetPrefix, flushAll } = req.body;

      if (flushAll === true) {
        // Execute nuclear FLUSHALL option
        await redisClient.flushAll();
        
      } else if (targetPrefix && typeof targetPrefix === 'string') {
        // Safely flush specific prefix keys (e.g. "api_cache:*")
        // Using scan for safety on large datasets rather than keys *
        let cursor = 0;
        do {
          const result = await redisClient.scan(cursor, {
            MATCH: `${targetPrefix}*`,
            COUNT: 100
          });
          cursor = result.cursor;
          if (result.keys.length > 0) {
            await redisClient.del(result.keys);
          }
        } while (cursor !== 0);
        
      } else {
        return res.status(400).json({ error: 'Must specify flushAll: true or a targetPrefix' });
      }

      // Audit Log the nuclear action
      const adminId = (req as any).user?.userId || 'unknown-admin';
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      await prisma.auditLog.create({
        data: {
          adminId,
          actionType: 'GLOBAL_CACHE_PURGE',
          targetResource: flushAll ? 'ALL' : targetPrefix,
          ipAddress,
          details: { flushAll, targetPrefix }
        }
      });

      return res.status(200).json({ 
        message: 'Cache purge executed successfully' 
      });
    } catch (error) {
      console.error('[EngineController] globalPurge error:', error);
      return res.status(500).json({ error: 'Failed to purge cache', details: (error as Error).message });
    }
  }
}
