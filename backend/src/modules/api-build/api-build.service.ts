import { pool } from '../../services/database.service';

export type ApiBuildProject = Record<string, unknown> & { id: string };

export async function listProjects(): Promise<ApiBuildProject[]> {
  const result = await pool.query('SELECT project FROM api_build_projects ORDER BY updated_at DESC');
  return result.rows.map((row) => row.project as ApiBuildProject);
}
export async function getProject(id: string): Promise<ApiBuildProject | null> {
  const result = await pool.query('SELECT project FROM api_build_projects WHERE id = $1', [id]);
  return (result.rows[0]?.project as ApiBuildProject | undefined) ?? null;
}
export async function saveProject(project: ApiBuildProject): Promise<ApiBuildProject> {
  await pool.query(`INSERT INTO api_build_projects (id, project) VALUES ($1, $2::jsonb)
    ON CONFLICT (id) DO UPDATE SET project = EXCLUDED.project, updated_at = NOW()`, [project.id, JSON.stringify(project)]);
  return project;
}
export async function removeProject(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM api_build_projects WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
export async function enqueueDeploy(projectId: string) {
  const result = await pool.query(`INSERT INTO api_build_jobs (project_id, type, payload)
    VALUES ($1, 'deploy', jsonb_build_object('requestedAt', NOW())) RETURNING id, status, created_at`, [projectId]);
  return result.rows[0];
}
export async function claimNextDeploy() {
  const result = await pool.query(`WITH next_job AS (
    SELECT id FROM api_build_jobs WHERE status = 'queued' AND type = 'deploy' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
  ) UPDATE api_build_jobs j SET status = 'running', started_at = NOW() FROM next_job WHERE j.id = next_job.id RETURNING j.*`);
  return result.rows[0] ?? null;
}
export async function completeDeploy(id: string) {
  await pool.query("UPDATE api_build_jobs SET status = 'completed', completed_at = NOW() WHERE id = $1", [id]);
}
export async function getJob(id: string) {
  const result = await pool.query('SELECT id, project_id, type, status, error, created_at, started_at, completed_at FROM api_build_jobs WHERE id = $1', [id]);
  return result.rows[0] ?? null;
}
export async function setProjectDeployment(projectId: string, deployment: Record<string, unknown>) {
  const current = await getProject(projectId);
  if (!current) return null;
  return saveProject({ ...current, status: 'healthy', deployment, updatedAt: new Date().toISOString() });
}
