import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Free Tier limit configuration
const FREE_TIER_LIMIT = 1000; // 1000 requests per 6-hour window
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/**
 * Express Middleware: Automatic 6-hour rolling reset window for users on the Free subscription tier.
 */
export const freeTierRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  if (process.env.KLYRA_DISABLE_QUOTAS === 'true') {
    return next();
  }

  // Retrieve the authenticated user ID (assumes JWT payload sets req.user.sub or req.user.id)
  const userId = (req as any).user?.sub || (req as any).user?.id;
  
  if (!userId) {
    // If no user is authenticated, skip the user-specific quota or handle anonymous limits separately
    return next();
  }

  try {
    // 1. Fetch the user and their active subscription plan to check if they are FREE
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        user_subscriptions: {
          where: { status: 'ACTIVE' },
          include: { subscription_plans: true },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const activeSub = user.user_subscriptions[0];
    // If no active subscription is found, or the plan slug is 'free', treat them as Free tier.
    const isFreeTier = !activeSub || activeSub.subscription_plans?.slug.toLowerCase() === 'free';

    if (isFreeTier) {
      const now = new Date();
      // @ts-ignore - Prisma client needs to be regenerated for these fields
      const lastResetAt = user.lastResetAt || new Date(0); // Default to epoch if never reset
      const msSinceReset = now.getTime() - lastResetAt.getTime();

      // @ts-ignore
      let currentRequestCount = user.requestCount;

      // 2 & 3. Calculate time difference. IF >= 6 hours, reset counter and update timestamp
      if (msSinceReset >= SIX_HOURS_MS) {
        currentRequestCount = 0;
        
        // Execute Prisma query to reset quota and timestamp
        await prisma.user.update({
          where: { id: userId },
          data: {
            requestCount: 0,
            lastResetAt: now,
          } as any,
        });
      }

      // 4. THEN proceed with the normal rate limit check
      if (currentRequestCount >= FREE_TIER_LIMIT) {
        // @ts-ignore
        const resetTime = new Date((user.lastResetAt?.getTime() || now.getTime()) + SIX_HOURS_MS);
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Free tier rate limit exceeded (${FREE_TIER_LIMIT} requests / 6 hours).`,
          resetAt: resetTime.toISOString(),
        });
      }

      // Increment the usage counter for this request
      await prisma.user.update({
        where: { id: userId },
        data: {
          requestCount: { increment: 1 },
        } as any,
      });
    }

    // Proceed to the next middleware/controller
    next();
  } catch (error) {
    console.error('Rate limiting error:', error);
    next(error);
  }
};
