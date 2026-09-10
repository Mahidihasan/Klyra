const fs = require('fs');

const routeFiles = [
  'admin.activity.routes.ts',
  'admin.marketplace.routes.ts',
  'admin.revenue.routes.ts',
  'admin.subscriptions.routes.ts',
  'admin.usage.routes.ts'
];

routeFiles.forEach(f => {
  const path = 'c:/SE/Klyra/backend/src/modules/admin/' + f;
  if (!fs.existsSync(path)) return;
  let content = fs.readFileSync(path, 'utf8');

  // Remove imports for requireAdmin and asyncHandler
  content = content.replace(/import \{ requireAdmin \}.*;\n/g, '');
  content = content.replace(/import \{ asyncHandler \}.*;\n/g, '');

  // Replace asyncHandler wrapping with standard try/catch or simple async
  // The simplest is to replace `asyncHandler(async (req, res) => {` with `async (req, res, next) => { try {`
  // and `})` with `} catch(err) { next(err); } }`
  content = content.replace(/requireAdmin,\n?\s*asyncHandler\(/g, '(');
  content = content.replace(/asyncHandler\(/g, '');
  content = content.replace(/res\.json\(\{ success: true, data: (.*?) \}\);\n\s*\}\)/g, 'res.json({ success: true, data: $1 });\n  } catch (err) {\n    console.error(err);\n    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });\n  }\n');
  content = content.replace(/\(req, res\) => \{/g, 'async (req, res) => {\n  try {');

  // One file might have `requireAdmin` as the first argument, remove it since it's applied globally in admin.routes.ts
  content = content.replace(/,\s*requireAdmin/g, '');
  content = content.replace(/requireAdmin,\s*/g, '');

  fs.writeFileSync(path, content);
  console.log('Fixed routes:', f);
});

const serviceFiles = [
  'admin.activity.service.ts',
  'admin.marketplace.service.ts',
  'admin.revenue.service.ts',
  'admin.subscriptions.service.ts',
  'admin.usage.service.ts'
];

serviceFiles.forEach(f => {
  const path = 'c:/SE/Klyra/backend/src/modules/admin/' + f;
  if (!fs.existsSync(path)) return;
  let content = fs.readFileSync(path, 'utf8');

  // Fix database import
  content = content.replace(/import \{ db \} from '..\/..\/..\/database';\n/g, "import { getAdminDbPool } from './admin.db';\n");

  // Fix logger import
  content = content.replace(/import \{ logger \}.*;\n/g, '');

  // Fix ViewerIdentity
  content = content.replace(/import \{ ViewerIdentity \} from '.\/admin.users.types';\n/g, '');
  content = content.replace(/ViewerIdentity/g, '{ id: string }');

  // Replace db.query with pool.query
  // Need to ensure functions call await getAdminDbPool()
  // Since this is a bit too complex for simple regex, I'll just dynamically replace `db.query`
  // with `(await getAdminDbPool()).query` but wait, what if it returns null?
  // Let's replace `db.query` with `(await (async () => { const p = await getAdminDbPool(); if (!p) throw new Error("No DB"); return p; })()).query`
  // Better: replace `db.query` with `(await getAdminDbPool())!.query`
  // Actually the ! operator asserts it's not null, which will crash with a TypeError if it is. That's fine for our mock scenario.
  // Wait, I can just replace `db.query` with `(await getAdminDbPool())!.query`
  content = content.replace(/await db\.query/g, "await (await getAdminDbPool())!.query");
  content = content.replace(/db\.query/g, "(await getAdminDbPool())!.query");

  fs.writeFileSync(path, content);
  console.log('Fixed services:', f);
});
