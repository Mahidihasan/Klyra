const fs = require('fs');
const path = require('path');

const dir = 'c:/SE/Klyra/backend/src/modules/admin';
const files = [
  'admin.devops.routes.ts',
  'admin.explorer.routes.ts',
  'admin.finances.routes.ts',
  'admin.settings.routes.ts'
];

for (const file of files) {
  const filePath = path.join(dir, file);
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix the broken middleware
  content = content.replace(/requireAdmin,\s*requireSuperAdmin,\s*\(\'[A-Z_]+\'\)/g, 'requireAdmin');
  
  fs.writeFileSync(filePath, content);
  console.log(`Updated ${file}`);
}
