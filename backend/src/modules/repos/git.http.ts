import { Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { repoGitDir } from './git.service';
import { resolveGitIdentity } from './auth.service';
import { pool } from '../../services/database.service';
import { logActivity } from './repos.service';

/**
 * Git Smart HTTP v2 endpoint backed by the real `git http-backend` CGI.
 * Supports clone / fetch / push over HTTP with token auth
 * (Basic auth: any username + Klyra token as password, or ?access_token=).
 */
export async function gitHttpHandler(req: Request, res: Response) {
  const repoId = (req.params as { repoId: string }).repoId;
  const repoRow = await pool.query('SELECT id, owner_id, visibility FROM kr_repositories WHERE id = $1', [repoId]);
  const repo = repoRow.rows[0];
  if (!repo) return res.status(404).send('Repository not found');

  const user = await resolveGitIdentity(req);
  const isService = String(req.query.service || '');
  const isPush = isService === 'git-receive-pack' || req.url.includes('git-receive-pack');

  // Private repos require auth for read; push always requires auth
  if ((repo.visibility === 'private' || isPush) && !user) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Klyra Git"');
    return res.status(401).send('Authentication required');
  }

  // Write permission check (owner / maintainer / developer)
  if (isPush && user) {
    const perm = await pool.query(
      `SELECT role FROM kr_collaborators WHERE repo_id=$1 AND user_id=$2`, [repo.id, user.id]
    );
    const role = perm.rows[0]?.role;
    const allowed = role === 'owner' || role === 'maintainer' || role === 'developer';
    if (!allowed) return res.status(403).send('You do not have push access to this repository');
  }

  const gitDir = repoGitDir(repo.id);
  const urlPath = String(req.path || '');
  const backendPath = urlPath.replace(/^.*?\.git/, '') || '/';
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    GIT_PROJECT_ROOT: path.dirname(gitDir),
    GIT_HTTP_EXPORT_ALL: '1',
    GIT_HTTP_MAX_REQUEST_BUFFER: '500m',
    PATH_INFO: `/${path.basename(gitDir)}${backendPath}`,
    REQUEST_METHOD: req.method,
    QUERY_STRING: new URL(req.url, 'http://x').search.replace(/^\?/, ''),
    REMOTE_USER: user?.username || 'anonymous',
    REMOTE_ADDR: req.socket.remoteAddress || '',
    CONTENT_TYPE: String(req.headers['content-type'] || ''),
    GIT_PROTOCOL: String(req.headers['git-protocol'] || ''),
    CONTENT_LENGTH: String(req.headers['content-length'] || ''),
  };

  // Protected-branch context for the pre-receive hook
  if (user && isPush) {
    const ownerCheck = await pool.query('SELECT owner_id FROM kr_repositories WHERE id=$1', [repo.id]);
    const isOwner = ownerCheck.rows[0]?.owner_id === user.id;
    const prot = await pool.query('SELECT name FROM kr_branches WHERE repo_id=$1 AND protected=TRUE', [repo.id]);
    env.KL_IS_OWNER = isOwner ? '1' : '0';
    env.KL_ROLE = user.id === repo.owner_id ? 'owner' : 'member';
    env.KL_PROTECTED = prot.rows.map((r: { name: string }) => `refs/heads/${r.name}`).join(',') || 'refs/heads/main';
  }

  const child = spawn('git', ['http-backend'], { env, windowsHide: true });
  const rawBody: Buffer | undefined = Buffer.isBuffer((req as any).body) ? (req as any).body : undefined;
  if (rawBody && !env.CONTENT_LENGTH) env.CONTENT_LENGTH = String(rawBody.length);

  let headersSent = false;
  let status = 200;
  let headerBuf = '';
  child.stdout.on('data', (chunk: Buffer) => {
    if (!headersSent) {
      headerBuf += chunk.toString('binary');
      const idx = headerBuf.indexOf('\r\n\r\n');
      if (idx === -1) return;
      const rawHeaders = headerBuf.slice(0, idx);
      const bodyRest = Buffer.from(headerBuf.slice(idx + 4), 'binary');
      for (const line of rawHeaders.split('\r\n')) {
        const [k, v] = line.split(/:\s*/);
        if (/^status$/i.test(k)) status = parseInt(v, 10) || 200;
        else res.setHeader(k, v);
      }
      res.status(status);
      headersSent = true;
      if (bodyRest.length) res.write(bodyRest);
    } else {
      res.write(chunk);
    }
  });
  child.stdout.on('end', () => { if (!headersSent) { res.status(500); res.send('git http-backend produced no response'); } res.end(); });
  child.stderr.on('data', (d: Buffer) => console.error('[git-http]', d.toString()));

  if (rawBody) {
    child.stdin.end(rawBody);
  } else {
    req.pipe(child.stdin);
  }
  child.stdin.on('error', () => undefined);
  child.on('error', err => { console.error('[git-http] spawn failed', err); if (!res.headersSent) res.status(500).send('git http-backend failed'); });
  child.on('close', async code => {
    if (user && isPush && code === 0) {
      await logActivity(repo.id, user.id, 'git_push', { via: 'git-http' }).catch(() => undefined);
    }
  });
}
