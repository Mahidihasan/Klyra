import { pool } from '../../services/database.service';
import { KlyraUser } from './auth.service';
import { ensureReposSchema } from './repos.db';

export type RepoRole = 'owner' | 'maintainer' | 'developer' | 'reviewer';

export async function logActivity(repoId: string, actorId: number | null, type: string, payload: Record<string, unknown> = {}) {
  await pool.query(
    `INSERT INTO kr_activity (repo_id, actor_id, type, payload) VALUES ($1, $2, $3, $4)`,
    [repoId, actorId, type, JSON.stringify(payload)]
  );
}

export interface RepoRow {
  id: string;
  name: string;
  owner_id: number;
  description: string;
  website: string;
  topics: string;
  visibility: string;
  license: string;
  language: string;
  framework: string;
  default_branch: string;
  deploy_status: string;
  detect_json: any;
  created_at: string;
  updated_at: string;
}

export async function getRepo(repoId: string): Promise<RepoRow | null> {
  await ensureReposSchema();
  const res = await pool.query('SELECT * FROM kr_repositories WHERE id = $1', [repoId]);
  return res.rows[0] || null;
}

export async function getRepoByName(name: string): Promise<RepoRow | null> {
  await ensureReposSchema();
  const res = await pool.query('SELECT * FROM kr_repositories WHERE name = $1', [name]);
  return res.rows[0] || null;
}

export async function getRole(repoId: string, userId: number | undefined): Promise<RepoRole | null> {
  if (!userId) return null;
  const res = await pool.query('SELECT role FROM kr_collaborators WHERE repo_id=$1 AND user_id=$2', [repoId, userId]);
  return (res.rows[0]?.role as RepoRole) || null;
}

export function canRead(role: RepoRole | null, repo: RepoRow): boolean {
  return repo.visibility === 'public' || role !== null;
}

export function canWrite(role: RepoRole | null): boolean {
  return role === 'owner' || role === 'maintainer' || role === 'developer';
}

/** Only owner + maintainer can merge PRs into protected branches. */
export function canMerge(role: RepoRole | null): boolean {
  return role === 'owner' || role === 'maintainer';
}

/** Owner-only actions: publish to marketplace, delete repo, transfer, publish release. */
export function isOwner(role: RepoRole | null): boolean {
  return role === 'owner';
}

export function isProtectedBranch(repo: RepoRow, branch: string): boolean {
  return branch === repo.default_branch;
}

export async function userPublic(userId: number | null) {
  if (!userId) return null;
  const res = await pool.query('SELECT id, username, display_name, avatar_color FROM kr_users WHERE id=$1', [userId]);
  return res.rows[0] || null;
}

export async function listCollaborators(repoId: string) {
  const res = await pool.query(
    `SELECT c.user_id, c.role, c.created_at, u.username, u.display_name, u.avatar_color
     FROM kr_collaborators c JOIN kr_users u ON u.id = c.user_id
     WHERE c.repo_id=$1 ORDER BY CASE c.role WHEN 'owner' THEN 0 WHEN 'maintainer' THEN 1 WHEN 'developer' THEN 2 ELSE 3 END`,
    [repoId]
  );
  return res.rows;
}

export function actorName(user: KlyraUser): { name: string; email: string } {
  return { name: user.display_name || user.username, email: `${user.username}@users.klyra.local` };
}
