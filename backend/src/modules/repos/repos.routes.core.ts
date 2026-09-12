import { Router, Request, Response } from 'express';
import { ensureReposSchema } from './repos.db';
import { registerUser, loginUser, requireAuth, KlyraUser } from './auth.service';
import * as git from './git.service';
import { DetectionResult } from './detect.service';
import {
  logActivity, getRepo, getRole, canRead, canWrite, canMerge, isOwner,
  listCollaborators, actorName, RepoRow,
} from './repos.service';
import { pool } from '../../services/database.service';

export type Need = 'read' | 'write' | 'merge' | 'owner';

export function handleError(res: Response, err: any, fallback = 'Request failed') {
  const msg = err?.message || fallback;
  console.error('[repos]', msg);
  res.status(msg.includes('not found') ? 404 : msg.includes('denied') || msg.includes('required') ? 403 : 400).json({ error: msg });
}

export async function loadRepoFor(
  req: Request, res: Response, need: Need
): Promise<{ repo: RepoRow; user: KlyraUser; role: string | null } | null> {
  const repo = await getRepo(req.params.id);
  if (!repo) { res.status(404).json({ error: 'Repository not found' }); return null; }
  const user = req.klyraUser!;
  const role = await getRole(repo.id, user.id);
  const ok =
    need === 'read' ? canRead(role, repo) :
    need === 'write' ? canWrite(role) :
    need === 'merge' ? canMerge(role) : isOwner(role);
  if (!ok) { res.status(403).json({ error: `You do not have ${need} access to this repository` }); return null; }
  return { repo, user, role };
}

export { logActivity, getRepo, getRole, canRead, canWrite, canMerge, isOwner, listCollaborators, actorName, ensureReposSchema, pool, requireAuth, git, DetectionResult };

const router = Router();

// ============================ AUTH ============================
router.post('/auth/register', async (req, res) => {
  try {
    const { username, password, email, display_name } = req.body || {};
    if (!username || !password || password.length < 6) {
      return res.status(400).json({ error: 'Username and a password of at least 6 characters are required' });
    }
    const { user, token } = await registerUser(username, password, email, display_name);
    res.status(201).json({ user, token });
  } catch (err: any) { handleError(res, err, 'Registration failed'); }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
    const { user, token } = await loginUser(username, password);
    res.json({ user, token });
  } catch (err: any) { handleError(res, err, 'Login failed'); }
});

router.get('/auth/me', requireAuth, (req, res) => res.json({ user: req.klyraUser }));

// ============================ REPOSITORIES ============================
router.get('/repos', requireAuth, async (req, res) => {
  try {
    await ensureReposSchema();
    const result = await pool.query(
      `SELECT r.*, u.username AS owner_username,
              (SELECT COUNT(*) FROM kr_collaborators c WHERE c.repo_id = r.id) AS member_count
       FROM kr_repositories r JOIN kr_users u ON u.id = r.owner_id
       WHERE r.owner_id = $1 OR r.visibility = 'public'
          OR EXISTS (SELECT 1 FROM kr_collaborators c WHERE c.repo_id = r.id AND c.user_id = $1)
       ORDER BY r.updated_at DESC`,
      [req.klyraUser!.id]
    );
    res.json(result.rows);
  } catch (err) { handleError(res, err, 'Failed to list repositories'); }
});

router.post('/repos', requireAuth, async (req, res) => {
  try {
    const { name, description, visibility, license, language, framework, default_branch } = req.body || {};
    if (!name || !/^[a-zA-Z0-9._-]+$/.test(name)) {
      return res.status(400).json({ error: 'Repository name is required (letters, numbers, dot, dash, underscore only)' });
    }
    await ensureReposSchema();
    const dup = await pool.query('SELECT id FROM kr_repositories WHERE name=$1', [name]);
    if (dup.rows.length) return res.status(409).json({ error: 'A repository with that name already exists' });

    const branch = default_branch || 'main';
    const id = (
      await pool.query(
        `INSERT INTO kr_repositories (name, owner_id, description, visibility, license, language, framework, default_branch)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [name, req.klyraUser!.id, description || '', visibility === 'public' ? 'public' : 'private',
         license || 'MIT', language || 'TypeScript', framework || '', branch]
      )
    ).rows[0].id;

    await pool.query(`INSERT INTO kr_collaborators (repo_id, user_id, role) VALUES ($1,$2,'owner')`, [id, req.klyraUser!.id]);
    await pool.query(`INSERT INTO kr_branches (repo_id, name, protected, created_by) VALUES ($1,$2,TRUE,$3)`, [id, branch, req.klyraUser!.id]);
    await git.initBareRepo(id, branch);
    await logActivity(id, req.klyraUser!.id, 'repo_created', { name });
    res.status(201).json({ id, name, default_branch: branch });
  } catch (err) { handleError(res, err, 'Failed to create repository'); }
});

router.get('/repos/:id', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    const collaborators = await listCollaborators(ctx.repo.id);
    const branches = await git.listBranches(ctx.repo.id);
    res.json({ ...ctx.repo, role: ctx.role, collaborators, branches });
  } catch (err) { handleError(res, err, 'Failed to load repository'); }
});

// Settings update (write access; owner for visibility)
router.patch('/repos/:id', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'write');
    if (!ctx) return;
    const fields: string[] = [];
    const values: any[] = [];
    const b = req.body || {};
    for (const [key, col] of [['description', 'description'], ['license', 'license'], ['language', 'language'], ['framework', 'framework'], ['website', 'website'], ['topics', 'topics']] as const) {
      if (typeof b[key] === 'string') { fields.push(`${col} = $${values.length + 1}`); values.push(b[key]); }
    }
    if (b.visibility && isOwner(ctx.role as any)) {
      fields.push(`visibility = $${values.length + 1}`);
      values.push(b.visibility === 'public' ? 'public' : 'private');
    }
    if (fields.length) {
      values.push(ctx.repo.id);
      await pool.query(`UPDATE kr_repositories SET ${fields.join(', ')}, updated_at=NOW() WHERE id=$${values.length}`, values);
    }
    res.json(await getRepo(ctx.repo.id));
  } catch (err) { handleError(res, err, 'Failed to update repository'); }
});

router.delete('/repos/:id', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'owner');
    if (!ctx) return;
    await pool.query('DELETE FROM kr_repositories WHERE id=$1', [ctx.repo.id]);
    res.status(204).send();
  } catch (err) { handleError(res, err, 'Failed to delete repository'); }
});

// Import an existing Git repository by mirror-cloning its URL into Klyra.
// The source is cloned before metadata is created so a failed import cannot
// leave an empty repository visible in the application.
router.post('/repos/import', requireAuth, async (req, res) => {
  let id: string | undefined;
  let gitDir: string | undefined;
  try {
    const { name, clone_url, description, visibility, license, language, framework, default_branch, github_token } = req.body || {};
    const sourceUrl = typeof clone_url === 'string' ? clone_url.trim() : '';
    if (!name || !sourceUrl || !/^[a-zA-Z0-9._-]+$/.test(name)) {
      return res.status(400).json({ error: 'A valid repository name and clone_url are required' });
    }
    let parsedUrl: URL;
    try { parsedUrl = new URL(sourceUrl); } catch { return res.status(400).json({ error: 'clone_url must be a valid Git URL' }); }
    if (!['http:', 'https:', 'git:', 'ssh:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: 'clone_url must be an http(s)://, git:// or ssh:// URL' });
    }
    if (github_token && (!parsedUrl.hostname.endsWith('github.com') || !['http:', 'https:'].includes(parsedUrl.protocol))) {
      return res.status(400).json({ error: 'github_token can only be used with an HTTPS GitHub URL' });
    }
    await ensureReposSchema();
    const dup = await pool.query('SELECT id FROM kr_repositories WHERE name=$1', [name]);
    if (dup.rows.length) return res.status(409).json({ error: 'A repository with that name already exists' });

    const path = await import('path');
    const os = await import('os');
    const fs = await import('fs');
    const { execFile } = await import('child_process');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'klyra-import-'));
    const run = (args: string[]) => new Promise<void>((resolve, reject) => {
      execFile('git', args, { timeout: 120000, windowsHide: true, maxBuffer: 50 * 1024 * 1024 },
        (e: Error | null, _stdout: string, stderr: string) => e
          ? reject(new Error(`Import failed: ${(stderr || e.message).trim()}`))
          : resolve());
    });
    try {
      const authArgs = github_token ? ['-c', `http.extraheader=Authorization: Bearer ${github_token}`] : [];
      await run([...authArgs, 'clone', '--mirror', sourceUrl, tmpDir]);
      const requestedBranch = typeof default_branch === 'string' ? default_branch.trim() : '';
      const head = (await new Promise<string>((resolve, reject) => {
        execFile('git', ['-C', tmpDir, 'symbolic-ref', '--short', 'HEAD'], { windowsHide: true },
          (e, stdout) => e ? reject(e) : resolve(stdout.trim()));
      }).catch(() => '')).replace(/^refs\/heads\//, '');
      const hasBranch = (name: string) => new Promise<boolean>((resolve) => {
        execFile('git', ['-C', tmpDir, 'show-ref', '--verify', '--quiet', `refs/heads/${name}`], { windowsHide: true },
          e => resolve(!e));
      });
      // Honour the requested default branch only if it exists in the source;
      // otherwise trust the source's real HEAD so an imported repo whose
      // default is "master" doesn't get advertised as "main" (which made every
      // tree/file/overview request 400 in the UI).
      const branch =
        (requestedBranch && (await hasBranch(requestedBranch)) && requestedBranch) ||
        (head && (await hasBranch(head)) && head) ||
        'main';

      const repoId = (
        await pool.query(
          `INSERT INTO kr_repositories (name, owner_id, description, visibility, license, language, framework, default_branch)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [name, req.klyraUser!.id, description || '', visibility === 'public' ? 'public' : 'private',
           license || 'MIT', language || '', framework || '', branch]
        )
      ).rows[0].id;
      id = repoId;
      await pool.query(`INSERT INTO kr_collaborators (repo_id, user_id, role) VALUES ($1,$2,'owner')`, [repoId, req.klyraUser!.id]);
      await pool.query(`INSERT INTO kr_branches (repo_id, name, protected, created_by) VALUES ($1,$2,TRUE,$3)`, [repoId, branch, req.klyraUser!.id]);
      gitDir = await git.initBareRepo(repoId, branch);
      await run(['-C', tmpDir, 'push', '--mirror', gitDir]);
      // Reflect the imported repo's real branch set in kr_branches so the UI's
      // branch picker and protection defaults match what was actually cloned.
      const pushedRefs = await new Promise<string>((resolve, reject) => {
        execFile('git', ['-C', gitDir as string, 'for-each-ref', '--format=%(refname:short)', 'refs/heads'],
          { windowsHide: true }, (e: Error | null, stdout: string) => e ? reject(e) : resolve(stdout));
      });
      for (const name of pushedRefs.split('\n').map(s => s.trim()).filter(Boolean)) {
        await pool.query(
          `INSERT INTO kr_branches (repo_id, name, protected, created_by) VALUES ($1,$2,$3,$4)
           ON CONFLICT DO NOTHING`,
          [repoId, name, name === branch, req.klyraUser!.id]);
      }
      await logActivity(repoId, req.klyraUser!.id, 'repo_imported', { name, from: sourceUrl });
      res.status(201).json({ id: repoId, name, default_branch: branch, imported_from: sourceUrl });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  } catch (err) {
    if (id) {
      await pool.query('DELETE FROM kr_repositories WHERE id=$1', [id]).catch(() => undefined);
      if (gitDir) {
        const fs = await import('fs');
        fs.rmSync(gitDir, { recursive: true, force: true });
      }
    }
    handleError(res, err, 'Failed to import repository');
  }
});

// ============================ OVERVIEW ============================
router.get('/repos/:id/overview', requireAuth, async (req, res) => {
  try {
    const ctx = await loadRepoFor(req, res, 'read');
    if (!ctx) return;
    const { repo } = ctx;
    const defaultRef = await git.resolveRef(repo.id, repo.default_branch);
    let readme: string | null = null;
    for (const candidate of ['README.md', 'readme.md', 'Readme.md', 'README']) {
      try { readme = await git.readFileAt(repo.id, defaultRef, candidate); break; } catch { /* try next */ }
    }
    const [branches, tags, contributors, latest, prOpen, issuesOpen, releases] = await Promise.all([
      git.listBranches(repo.id),
      git.listTagRefs(repo.id),
      pool.query(
        `SELECT u.id, u.username, u.display_name, u.avatar_color, COUNT(*)::int AS commits
         FROM kr_activity a JOIN kr_users u ON u.id = a.actor_id
         WHERE a.repo_id=$1 AND a.actor_id IS NOT NULL AND a.type IN ('git_push','pr_merged','pr_created')
         GROUP BY u.id ORDER BY commits DESC LIMIT 8`, [repo.id]),
      git.latestCommit(repo.id, defaultRef),
      pool.query(`SELECT COUNT(*)::int AS n FROM kr_pull_requests WHERE repo_id=$1 AND status='open'`, [repo.id]),
      pool.query(`SELECT COUNT(*)::int AS n FROM kr_issues WHERE repo_id=$1 AND status='open'`, [repo.id]),
      pool.query(`SELECT COUNT(*)::int AS n FROM kr_releases WHERE repo_id=$1 AND status='published'`, [repo.id]),
    ]);
    const ciRows = await pool.query(
      `SELECT DISTINCT ON (type) type, status, summary, finished_at FROM kr_ci_runs WHERE repo_id=$1 ORDER BY type, started_at DESC`, [repo.id]);
    const rel = await pool.query(
      `SELECT tag_name, name, status, latest, prerelease, created_at FROM kr_releases WHERE repo_id=$1 AND status='published' ORDER BY created_at DESC LIMIT 1`, [repo.id]);
    const detect = repo.detect_json as DetectionResult | null;
    res.json({
      readme,
      latest_commit: latest,
      commit_count: await git.commitCount(repo.id, defaultRef),
      branch_count: branches.length,
      tag_count: tags.length,
      contributors: contributors.rows,
      open_pull_requests: prOpen.rows[0].n,
      open_issues: issuesOpen.rows[0].n,
      endpoint_count: Array.isArray(detect?.endpoints) ? detect.endpoints.length : 0,
      releases_published: releases.rows[0].n,
      latest_release: rel.rows[0] || null,
      build_status: ciRows.rows.find((r: any) => r.type === 'build')?.status || 'not_run',
      test_status: ciRows.rows.find((r: any) => r.type === 'test')?.status || 'not_run',
      deploy_status: repo.deploy_status,
      detect_updated_at: detect?.detectedAt || null,
    });
  } catch (err) { handleError(res, err, 'Failed to load overview'); }
});

export default router;
