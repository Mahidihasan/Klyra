import { Request, Response } from 'express';
import { pool } from '../../../services/database.service';

interface ActiveTask {
  id: string;
  name: string;
  progress: number;
  step: string;
  eta: string;
}

/**
 * Compute a human-readable ETA string based on elapsed time and progress.
 * Formula: if `progress`% took `elapsed` seconds, the remaining % will take
 * (elapsed / progress) * (100 - progress) seconds.
 */
function computeEta(startedAt: Date | null, progress: number): string {
  if (!startedAt || progress <= 0) return 'Calculating…';
  const elapsedSec = (Date.now() - new Date(startedAt).getTime()) / 1000;
  const remainingSec = Math.round((elapsedSec / progress) * (100 - progress));
  if (remainingSec < 60) return `${remainingSec}s`;
  const m = Math.floor(remainingSec / 60);
  const s = remainingSec % 60;
  return `${m}m ${s}s`;
}

/**
 * Derive a human-readable step label from status and job type.
 */
function deriveStep(status: string, type: string, progress: number): string {
  if (status === 'running') {
    if (progress < 25)  return `Step 1/4: Initialising ${type}…`;
    if (progress < 50)  return `Step 2/4: Processing ${type}…`;
    if (progress < 75)  return `Step 3/4: Validating ${type}…`;
    return `Step 4/4: Finalising ${type}…`;
  }
  if (status === 'queued' || status === 'validating') return `Queued — awaiting worker`;
  return status;
}

export const QueueController = {
  /**
   * GET /api/v1/admin/queue/active-tasks
   * Returns all running + queued jobs from the PostgreSQL-backed job queue,
   * enriched with progress and ETA so the Admin dashboard can display them.
   */
  getActiveTasks: async (_req: Request, res: Response) => {
    try {
      const result = await pool.query<{
        id: string;
        project_id: string;
        type: string;
        status: string;
        created_at: Date;
        started_at: Date | null;
      }>(
        `SELECT id, project_id, type, status, created_at, started_at
         FROM api_build_jobs
         WHERE status IN ('queued', 'running', 'validating')
         ORDER BY created_at DESC
         LIMIT 20`
      );

      const tasks: ActiveTask[] = result.rows.map((row) => {
        // Bull doesn't expose a native progress field in this Postgres schema, so
        // we derive a synthetic progress value from elapsed time (capped at 95%
        // so we never show 100% for a still-running job).
        let progress = 0;
        if (row.status === 'running' && row.started_at) {
          const elapsedSec = (Date.now() - new Date(row.started_at).getTime()) / 1000;
          // Assume average job takes ~60s; saturate at 95% while still running
          progress = Math.min(95, Math.round((elapsedSec / 60) * 100));
        } else if (row.status === 'queued') {
          progress = 0;
        } else if (row.status === 'validating') {
          progress = 10;
        }

        return {
          id: row.id,
          name: `${row.type.charAt(0).toUpperCase() + row.type.slice(1)} — Project ${row.project_id.slice(0, 8)}`,
          progress,
          step: deriveStep(row.status, row.type, progress),
          eta: computeEta(row.started_at, progress),
        };
      });

      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ success: true, tasks });
    } catch (err) {
      console.error('[QueueController] getActiveTasks error:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch active tasks' });
    }
  },
};
