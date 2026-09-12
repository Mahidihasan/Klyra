const B = 'http://localhost:4000/api';
const u = 'rt' + Date.now();
const j = (t) => ({ 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) });
(async () => {
  let r = await fetch(B + '/auth/register', { method: 'POST', headers: j(), body: JSON.stringify({ username: u, password: 'Passw0rd!123' }) });
  const { token } = await r.json();
  r = await fetch(B + '/repos', { method: 'POST', headers: j(token), body: JSON.stringify({ name: 'cmt' + u }) });
  const { id } = await r.json();
  r = await fetch(`${B}/repos/${id}/issues`, { method: 'POST', headers: j(token), body: JSON.stringify({ title: 'T' }) });
  const { number } = await r.json();
  r = await fetch(`${B}/repos/${id}/issues/${number}/comments`, { method: 'POST', headers: j(token), body: JSON.stringify({ body: 'hello' }) });
  console.log('comment status', r.status, await r.text());
  await fetch(B + '/repos/' + id, { method: 'DELETE', headers: j(token) });
})().catch(e => { console.error(e); process.exit(1); });
