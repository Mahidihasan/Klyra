/* eslint-disable no-console */
// Verify git clone (user clones a hosted repo back) and git import
// (POST /repos/import mirrors an external Git repo into Klyra).
// Run against the running dev server (localhost:4000).
import crypto from 'crypto';
import { execFile } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const BASE = 'http://localhost:4000/api';
const JWT_SECRET = 'dev-jwt-secret-key';
let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`); }
}
function gitRun(args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { windowsHide: true, timeout: 90000, ...opts }, (e) =>
      e ? reject(new Error(`git ${args[0]||''} failed: ${e.message}`)) : resolve());
  });
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
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data; try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

const suffix = Date.now().toString(36);
const email = `clone-${suffix}@klyra-test.dev`;
const jwt = mintJwt(email);

console.log('=== git clone (user pulls a hosted repo back) ===');
let r = await req('/repos', { method: 'POST', token: jwt, body: { name: `clone-${suffix}`, visibility: 'private', default_branch: 'main' } });
const repoId = r.data?.id;
check('create repo → 2xx', r.status >= 200 && r.status < 300 && !!repoId, `status=${r.status}`);
const work = mkdtempSync(path.join(tmpdir(), 'klyra-clone-'));
try {
  await gitRun(['init', work]);
  await gitRun(['-C', work, 'config', 'user.email', 'clone@klyra.test']);
  await gitRun(['-C', work, 'config', 'user.name', 'Clone Test']);
  writeFileSync(path.join(work, 'README.md'), '# cloned repo\n\nhello from lazypush\n');
  writeFileSync(path.join(work, 'app.ts'), 'export const x = 1;\n');
  await gitRun(['-C', work, 'add', '.']);
  await gitRun(['-C', work, 'commit', '-m', 'feat: initial push']);
  await gitRun(['-C', work, 'branch', '-M', 'main']);
  const url = `${BASE.replace('/api','')}/api/git/${repoId}.git`;
  await gitRun(['-C', work, '-c', `http.extraHeader=Authorization: Bearer ${jwt}`, 'push', url, 'main']);
} finally { rmSync(work, { recursive: true, force: true }); }
const cloneDir = mkdtempSync(path.join(tmpdir(), 'klyra-pull-'));
try {
  const cloneUrl = `${BASE.replace('/api','')}/api/git/${repoId}.git`;
  await gitRun(['clone', '-c', `http.extraHeader=Authorization: Bearer ${jwt}`, cloneUrl, cloneDir]);
  check('git clone over HTTP → 200', true);
  const readme = readFileSync(path.join(cloneDir, 'README.md'), 'utf8');
  check('cloned content matches', readme.includes('hello from lazypush'), '');
} catch (e) { check('git clone over HTTP', false, String(e.message).split('\n')[0]); }
finally { rmSync(cloneDir, { recursive: true, force: true }); }

console.log('=== git import (POST /repos/import mirrors an external repo) ===');
// The import route only accepts http(s)://, git:// or ssh:// clone URLs (an
// SSRF guard), so we import from a PUBLIC repo Klyra itself hosts over Smart
// HTTP — public repos can be mirror-cloned anonymously in dev.
r = await req('/repos', { method: 'POST', token: jwt, body: { name: `import-src-${suffix}`, visibility: 'public', default_branch: 'main' } });
const srcId = r.data?.id;
check('create public source repo → 2xx', r.status >= 200 && r.status < 300 && !!srcId, `status=${r.status}`);
const srcDir = mkdtempSync(path.join(tmpdir(), 'klyra-import-src-'));
try {
  await gitRun(['init', srcDir]);
  await gitRun(['-C', srcDir, 'config', 'user.email', 'import@src.dev']);
  await gitRun(['-C', srcDir, 'config', 'user.name', 'Import Src']);
  writeFileSync(path.join(srcDir, 'index.js'), 'module.exports = { imported: true };\n');
  await gitRun(['-C', srcDir, 'add', '.']);
  await gitRun(['-C', srcDir, 'commit', '-m', 'first']);
  await gitRun(['-C', srcDir, 'branch', '-M', 'main']);
  await gitRun(['-C', srcDir, 'tag', 'v1.0.0']);
  const pushUrl = `${BASE.replace('/api','')}/api/git/${srcId}.git`;
  await gitRun(['-C', srcDir, '-c', `http.extraHeader=Authorization: Bearer ${jwt}`, 'push', pushUrl, 'main']);
  await gitRun(['-C', srcDir, '-c', `http.extraHeader=Authorization: Bearer ${jwt}`, 'push', pushUrl, 'v1.0.0']);
} finally { rmSync(srcDir, { recursive: true, force: true }); }

const cloneUrl = `${BASE.replace('/api','')}/api/git/${srcId}.git`;
r = await req('/repos/import', { method: 'POST', token: jwt, body: { name: `imported-${suffix}`, clone_url: cloneUrl, default_branch: 'main', description: 'imported by test' } });
const importedId = r.data?.id;
check('POST /repos/import → 2xx', r.status >= 200 && r.status < 300 && !!importedId, `status=${r.status} ${JSON.stringify(r.data).slice(0,80)}`);
if (importedId) {
  r = await req(`/repos/${importedId}/branches`, { token: jwt });
  check('imported repo has main branch', r.status === 200 && Array.isArray(r.data) && r.data.some(b => b.name === 'main'), `status=${r.status}`);
  r = await req(`/repos/${importedId}/tree?ref=main`, { token: jwt });
  check('imported repo has index.js in tree', r.status === 200 && Array.isArray(r.data?.entries) && r.data.entries.some(e => e.path === 'index.js'), `status=${r.status}`);
  r = await req(`/repos/${importedId}/tags`, { token: jwt });
  check('imported repo has tag v1.0.0', r.status === 200 && Array.isArray(r.data) && r.data.some(t => t.name === 'v1.0.0'), `status=${r.status}`);
  r = await req(`/repos/${importedId}`, { method: 'DELETE', token: jwt });
  check('cleanup imported repo', r.status >= 200 && r.status < 300, `status=${r.status}`);
}
r = await req(`/repos/${srcId}`, { method: 'DELETE', token: jwt });
check('cleanup source repo', r.status >= 200 && r.status < 300, `status=${r.status}`);
r = await req(`/repos/${repoId}`, { method: 'DELETE', token: jwt });
check('cleanup clone repo', r.status >= 200 && r.status < 300, `status=${r.status}`);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);