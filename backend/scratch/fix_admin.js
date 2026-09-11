const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, '../src/modules/admin');
const files = fs.readdirSync(adminDir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
  const filePath = path.join(adminDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove fake auth imports
  content = content.replace(/import \{ authenticate, requireRole \} from '\.\.\/\.\.\/middleware\/auth';\n?/g, "");
  content = content.replace(/import \{ requireAdmin \} from '\.\.\/\.\.\/middleware\/auth';\n?/g, "");
  
  // Also remove authenticate and requireRole usage
  content = content.replace(/authenticate, requireRole\([^)]+\),\s*/g, "");
  content = content.replace(/requireAdmin,\s*/g, "");

  // Fix database imports
  content = content.replace(/import \{ db \} from '\.\.\/\.\.\/\.\.\/database';/g, "import { pool as db } from '../../services/database.service';");
  
  fs.writeFileSync(filePath, content, 'utf8');
});
console.log('Fixes applied.');
