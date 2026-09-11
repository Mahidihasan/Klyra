/* eslint-disable no-console */
// Verify the stale-default-branch fix: a repo whose git HEAD is "master" but
// whose clients request ref=main must still serve tree/file/overview (200).
// Usage (from backend/): node scripts/verify-ref-fallback.mjs
import crypto from 'crypto';
const BASE = 'http://localhost:4000/api';
const suffix = Date.now().toString(36);
// Mint a dev JWT like tmp-repos-api-test.mjs (matches .env.development secret);
// the repos auth service bridges main-auth JWTs to kr_users automatically.
const JWT_SECRET = 'dev-jwt-secret-key';
const email = `reftest-${suffix}@klyra-test.dev`;
function mintJwt() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const payload = b64({ sub: crypto.randomUUID(), email, iat: now, exp: now + 3600 });
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}
const token = mintJwt();

async function req(pathname, opts = {}) {
  const r = await fetch(BASE + pathname, {
    ...opts,
    headers: { 'content-type': 'application/json', connection: 'close', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch { /* empty */ }
  return { status: r.status, data };
}

let r = await req('/auth/me', { token });
console.log(r.status === 200 ? 'auth ok' : `auth status=${r.status} ${JSON.stringify(r.data)}`);
if (!token) process.exit(1);

r = await req('/repos', { method: 'POST', token, body: { name: `ref-fallback-${suffix}`, visibility: 'private', default_branch: 'main' } });
const repoId = r.data?.id;
console.log('create repo:', r.status, repoId);
if (!repoId) process.exit(1);

// Push a commit to refs/heads/master only (default_branch in DB stays "main").
const fs = await import('fs');
const os = await import('os');
const path = await import('path');
const { execFileSync } = await import('child_process');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reftest-'));
const g = (args) => execFileSync('git', args, { cwd: tmp, stdio: 'pipe' });
g(['init', '-b', 'master', '.']);
g(['config', 'user.email', 't@t.co']); g(['config', 'user.name', 't']);
fs.writeFileSync(path.join(tmp, 'README.md'), '# ref fallback test\n');
g(['add', '.']); g(['commit', '-m', 'init']);
g(['remote', 'add', 'origin', `http://localhost:4000/api/git/${repoId}.git`]);
g(['-c', 'http.extraHeader=Authorization: Bearer ' + token, 'push', 'origin', 'master']);

const results = {};
for (const [name, p] of [
  ['tree', `/repos/${repoId}/tree?ref=main&path=`],
  ['tree-recursive', `/repos/${repoId}/tree?ref=main&path=&recursive=1`],
  ['file', `/repos/${repoId}/file?ref=main&path=README.md`],
  ['overview', `/repos/${repoId}/overview`],
  ['commits', `/repos/${repoId}/commits?ref=main`],
]) {
  const res = await req(p, { token });
  results[name] = res.status;
  console.log(`${name}: ${res.status}`, res.status !== 200 ? JSON.stringify(res.data).slice(0, 120) : '');
}
fs.rmSync(tmp, { recursive: true, force: true });
const ok = Object.values(results).every(s => s === 200);
console.log(ok ? 'ALL OK' : 'FAILURES PRESENT');
process.exit(ok ? 0 : 1);
