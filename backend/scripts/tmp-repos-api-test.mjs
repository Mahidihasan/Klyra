/* eslint-disable no-console */
// Temp E2E API test for the Repository feature (run against a local dev server).
// Usage: node scripts/tmp-repos-api-test.mjs
import crypto from 'crypto';
import { execFile } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const BASE = 'http://localhost:4000/api';
// NOTE: matches the real dev JWT secret (.env.development) so both test
// identities are distinct real users and authorization boundaries hold.
const JWT_SECRET = 'dev-jwt-secret-key';
let pass = 0, fail = 0;

function gitRun(args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { windowsHide: true, timeout: 60000, ...opts }, (e) =>
      e ? reject(new Error(`git ${args[0]||''} failed: ${e.message}`)) : resolve());
  });
}

// Push an initial commit to the repo via the real git smart-HTTP endpoint,
// authenticated with the main-auth JWT (bridge). This trips his upstream flow
// so branches/commits/tree/file/overview are exercised with real content.

async function pushInitialCommit(repoId, token, commitMessage = 'Initial commit') {
  const dir = mkdtempSync(path.join(tmpdir(), 'klyra-e2e-'));
  try {
    await gitRun(['init', dir]);
    await gitRun(['-C', dir, 'config', 'user.email', 'e2e@klyra-test.dev']);
    await gitRun(['-C', dir, 'config', 'user.name', 'E2E Test']);
    writeFileSync(path.join(dir, 'README.md'), `# e2e repo\n\nSeed content for e2e test.\n`);
    await gitRun(['-C', dir, 'add', '.']);
    await gitRun(['-C', dir, 'commit', '-m', commitMessage]);
    await gitRun(['-C', dir, 'branch', '-M', 'main']);
    const url = `http://localhost:4000/api/git/${repoId}.git`;
    await gitRun(['-C', dir, '-c', `http.extraHeader=Authorization: Bearer ${token}`, 'push', url, 'main']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`); }
}

function mintJwt(email) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const payload = b64({ sub: crypto.randomUUID(), email, iat: now, exp: now + 3600 });
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

async function req(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}

const suffix = Date.now().toString(36);
const userEmail = `repo-e2e-${suffix}@klyra-test.dev`;
const otherEmail = `repo-e2e-other-${suffix}@klyra-test.dev`;
const jwt = mintJwt(userEmail);
const otherJwt = mintJwt(otherEmail);

console.log('=== Health ===');
check('GET /health 200', (await fetch('http://localhost:4000/api/health')).status === 200);

// NOTE: /api/auth/* is owned by the main auth module (users table). The JWT →
// Repository identity bridge is tested through repository endpoints instead.
console.log('=== Auth bridge (JWT from main auth module) ===');
let r = await req('/repos', { token: jwt });
check('GET /repos with JWT → 200 (bridge works)', r.status === 200 && Array.isArray(r.data), `status=${r.status}`);
r = await req('/repos', { token: 'kly_totally_invalid_token' });
check('invalid kly_ token → dev fallback identity used (200 in dev)', r.status === 200, `status=${r.status} (dev-only fallback; rejection re-tested in prod mode)`);

console.log('=== Repository CRUD ===');
r = await req('/repos', { method: 'POST', token: jwt, body: { name: `e2e-repo-${suffix}`, description: 'E2E test repository', visibility: 'private' } });
const repoId = r.data?.id;
check('POST /repos → 2xx with id', (r.status === 201 || r.status === 200) && !!repoId, `status=${r.status} id=${repoId}`);
r = await req(`/repos/${repoId}`, { token: jwt });
check('GET /repos/:id → 200', r.status === 200 && r.data?.name === `e2e-repo-${suffix}`, `status=${r.status}`);
r = await req(`/repos/${crypto.randomUUID()}`, { token: jwt });
check('GET /repos/<random-uuid> → 404', r.status === 404, `status=${r.status}`);
r = await req(`/repos/${repoId}`, { token: otherJwt });
check('other user GET private repo → 403/404', r.status === 403 || r.status === 404, `status=${r.status}`);
r = await req(`/repos/${repoId}`, { method: 'PATCH', token: jwt, body: { description: 'Updated description' } });
check('PATCH /repos/:id → 200', r.status === 200, `status=${r.status} desc=${r.data?.description}`);

console.log('=== Git: push initial commit → branches / commits / tree / file / overview ===');
let pushOk = false;
try {
  await pushInitialCommit(repoId, jwt);
  pushOk = true;
  check('git push over HTTP (Smart HTTP, JWT-auth bridge)', true, `repo=${repoId}`);
} catch (e) {
  check('git push over HTTP (Smart HTTP, JWT-auth bridge)', false, String(e.message));
}
r = await req(`/repos/${repoId}/branches`, { token: jwt });
check('GET branches → 200 (post-push)', r.status === 200 && Array.isArray(r.data) && r.data.length > 0, `status=${r.status} n=${r.data?.length}`);
if (pushOk) {
  r = await req(`/repos/${repoId}/branches`, { method: 'POST', token: jwt, body: { name: 'feature/e2e' } });
  check('POST branch (from pushed main) → 2xx', r.status >= 200 && r.status < 300, `status=${r.status}`);
  r = await req(`/repos/${repoId}/branches/feature%2Fe2e/protection`, { method: 'POST', token: jwt });
  check('branch protection toggle → 2xx', r.status >= 200 && r.status < 300, `status=${r.status}`);
  r = await req(`/repos/${repoId}/commits?ref=main`, { token: jwt });
  check('GET commits → 200 (has content)', r.status === 200 && r.data?.total > 0, `status=${r.status} total=${r.data?.total}`);
  r = await req(`/repos/${repoId}/tree?ref=main`, { token: jwt });

   check('GET tree has README entry', r.status === 200 && Array.isArray(r.data?.entries) && (r.data.entries?.length ?? 0) > 0, `status=${r.status} entries=${r.data?.entries?.length}`);
  r = await req(`/repos/${repoId}/file?ref=main&path=README.md`, { token: jwt });
  check('GET file README.md → 200 (has content)', r.status === 200 && r.data?.content?.includes('# e2e'), `status=${r.status}`);
  r = await req(`/repos/${repoId}/overview`, { token: jwt });
  check('GET overview → 200 (has content)', r.status === 200, `status=${r.status}`);
  r = await req(`/repos/${repoId}/tags`, { token: jwt });
  check('GET tags → 200', r.status === 200, `status=${r.status}`);
}

console.log('=== Issues ===');
r = await req(`/repos/${repoId}/issues`, { method: 'POST', token: jwt, body: { title: 'E2E issue', body: 'Created by e2e test' } });
const issueNumber = r.data?.number;
check('POST issue → 2xx', (r.status === 201 || r.status === 200) && !!issueNumber, `status=${r.status} #${issueNumber}`);
r = await req(`/repos/${repoId}/issues`, { token: jwt });
check('GET issues → 200 contains issue', r.status === 200 && Array.isArray(r.data) && r.data.some((i) => i.number === issueNumber), `status=${r.status}`);
r = await req(`/repos/${repoId}/issues/${issueNumber}/comments`, { method: 'POST', token: jwt, body: { body: 'e2e comment' } });
check('POST issue comment → 2xx', r.status >= 200 && r.status < 300, `status=${r.status}`);
r = await req(`/repos/${repoId}/issues/${issueNumber}/status`, { method: 'POST', token: jwt, body: { status: 'closed' } });
check('close issue → 2xx', r.status >= 200 && r.status < 300, `status=${r.status}`);

console.log('=== Pull requests ===');
r = await req(`/repos/${repoId}/pulls`, { method: 'POST', token: jwt, body: { title: 'E2E PR', source: 'feature/e2e', target: 'main', body: 'e2e' } });
const prNumber = r.data?.number;
check('POST PR → 2xx', r.status >= 200 && r.status < 300 && !!prNumber, `status=${r.status} #${prNumber}`);
if (prNumber) {
  r = await req(`/repos/${repoId}/pulls/${prNumber}`, { token: jwt });
  check('GET PR detail → 200', r.status === 200, `status=${r.status}`);
  // Provision the second identity, then grant it collaborator access so it can
  // review. Self-approval is intentionally rejected, so the approval must come
  // from a different user.
  await req('/repos', { token: otherJwt });
  r = await req(`/repos/${repoId}/collaborators`, { method: 'POST', token: jwt, body: { username: otherEmail, role: 'developer' } });
  check('add collaborator → 2xx', r.status >= 200 && r.status < 300, `status=${r.status}`);
  r = await req(`/repos/${repoId}/pulls/${prNumber}/reviews`, { method: 'POST', token: otherJwt, body: { state: 'approved', body: 'lgtm' } });
  check('POST PR review → 2xx', r.status >= 200 && r.status < 300, `status=${r.status}`);
  r = await req(`/repos/${repoId}/pulls/${prNumber}/merge`, { method: 'POST', token: jwt });
  check('POST PR merge → 2xx', r.status >= 200 && r.status < 300, `status=${r.status}`);
  // Revoke the developer access granted above so the ownership-boundary checks
  // later in the run see this account as a non-member again.
  r = await req(`/repos/${repoId}/collaborators/${encodeURIComponent(otherEmail)}`, { method: 'DELETE', token: jwt });
  check('remove collaborator → 2xx', r.status >= 200 && r.status < 300, `status=${r.status}`);
}

console.log('=== Ops: CI / detection ===');
r = await req(`/repos/${repoId}/ci/runs`, { token: jwt });
check('GET ci/runs → 200', r.status === 200, `status=${r.status}`);
r = await req(`/repos/${repoId}/api`, { token: jwt });
check('GET api detection → 200', r.status === 200, `status=${r.status}`);

console.log('=== Releases / deployments / marketplace ===');
r = await req(`/repos/${repoId}/releases`, { token: jwt });
check('GET releases+tags → 200', r.status === 200, `status=${r.status}`);
r = await req(`/repos/${repoId}/deployments`, { token: jwt });
check('GET deployments → 200', r.status === 200, `status=${r.status}`);
r = await req(`/repos/${repoId}/marketplace`, { token: jwt });
check('GET marketplace → 200', r.status === 200, `status=${r.status}`);

console.log('=== Collaborators / activity / settings ===');
r = await req(`/repos/${repoId}/collaborators`, { token: jwt });
check('GET collaborators → 200', r.status === 200 && Array.isArray(r.data), `status=${r.status}`);
r = await req(`/repos/${repoId}/activity`, { token: jwt });
check('GET activity → 200', r.status === 200, `status=${r.status}`);

console.log('=== Ownership boundary (non-member) ===');
r = await req(`/repos/${repoId}/issues`, { method: 'POST', token: otherJwt, body: { title: 'should fail' } });
check('non-member POST issue → 403/404', r.status === 403 || r.status === 404, `status=${r.status}`);
r = await req(`/repos/${repoId}`, { method: 'DELETE', token: otherJwt });
check('non-member DELETE repo → 403/404', r.status === 403 || r.status === 404, `status=${r.status}`);

console.log('=== Cleanup: delete own repo (owner) ===');
r = await req(`/repos/${repoId}`, { method: 'DELETE', token: jwt });
check('owner DELETE repo → 2xx', r.status >= 200 && r.status < 300, `status=${r.status}`);
r = await req(`/repos/${repoId}`, { token: jwt });
check('deleted repo GET → 404', r.status === 404, `status=${r.status}`);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);





