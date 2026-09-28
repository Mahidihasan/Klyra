import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class FinancialController {
  /**
   * GET /api/v1/admin/financials/disputes
   * Fetch all active financial disputes
   */
  static async getDisputes(req: Request, res: Response) {
    try {
      const disputes = await prisma.dispute.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return res.status(200).json({ data: disputes });
    } catch (error) {
      console.error('[FinancialController] getDisputes error:', error);
      return res.status(500).json({ error: 'Internal Server Error fetching disputes' });
    }
  }

  /**
   * POST /api/v1/admin/financials/resolve-dispute
   * Resolve a specific financial dispute
   */
  static async resolveDispute(req: Request, res: Response) {
    try {
      const { disputeId, resolutionStatus } = req.body;
      
      if (!disputeId || !resolutionStatus) {
        return res.status(400).json({ error: 'Missing disputeId or resolutionStatus in request body' });
      }

      const updatedDispute = await prisma.dispute.update({
        where: { id: disputeId },
        data: { status: resolutionStatus },
      });

      // Maintain a strict audit log of the admin's action
      const adminId = (req as any).user?.userId || null;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      await prisma.auditLog.create({
        data: {
          user_id: adminId,
          action: 'UPDATE',
          entity_type: 'DISPUTE',
          entity_id: disputeId,
          ip_address: ipAddress,
          new_values: { action: 'RESOLVE_DISPUTE', resolutionStatus }
        }
      });

      return res.status(200).json({ 
        message: 'Dispute successfully resolved and logged',
        data: updatedDispute 
      });
    } catch (error) {
      console.error('[FinancialController] resolveDispute error:', error);
      return res.status(500).json({ error: 'Internal Server Error resolving dispute' });
    }
  }
}
