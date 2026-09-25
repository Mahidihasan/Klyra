const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  for (const { rx, rep } of replacements) {
    content = content.replace(rx, rep);
  }
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }
}

// BACKEND
replaceInFile('c:/SE/Klyra/backend/src/middleware/maintenance.middleware.ts', [
  { rx: /\['ADMIN', 'MODERATOR'\]/g, rep: "['SUPER_ADMIN', 'ADMIN']" }
]);

replaceInFile('c:/SE/Klyra/backend/src/modules/admin/admin.routes.ts', [
  { rx: /\['ADMIN', 'MODERATOR'\]/g, rep: "['SUPER_ADMIN', 'ADMIN']" }
]);

replaceInFile('c:/SE/Klyra/backend/src/modules/admin/admin.users.service.ts', [
  { rx: /WHERE role = 'ADMIN'/g, rep: "WHERE role IN ('SUPER_ADMIN', 'ADMIN')" }
]);

replaceInFile('c:/SE/Klyra/backend/src/modules/admin/admin.users.types.ts', [
  { rx: /\['USER', 'PROVIDER', 'MODERATOR', 'ADMIN'\]/g, rep: "['SUPER_ADMIN', 'ADMIN', 'USER']" },
  { rx: /\['ADMIN', 'MODERATOR'\]/g, rep: "['SUPER_ADMIN', 'ADMIN']" },
  { rx: /\['ADMIN'\]/g, rep: "['SUPER_ADMIN', 'ADMIN']" }
]);

replaceInFile('c:/SE/Klyra/backend/src/modules/admin/socket.ts', [
  { rx: /decoded\.role !== 'ADMIN'/g, rep: "!['SUPER_ADMIN', 'ADMIN'].includes(decoded.role)" }
]);

replaceInFile('c:/SE/Klyra/backend/src/modules/admin/middleware/adminAuth.middleware.ts', [
  { rx: /decoded\.role !== 'ADMIN'/g, rep: "!['SUPER_ADMIN', 'ADMIN'].includes(decoded.role)" }
]);

replaceInFile('c:/SE/Klyra/backend/src/modules/admin/admin.users.policy.ts', [
  { rx: /actor\.role !== 'ADMIN'/g, rep: "!['SUPER_ADMIN', 'ADMIN'].includes(actor.role)" },
  { rx: /target\.role === 'ADMIN' \|\| target\.role === 'MODERATOR'/g, rep: "['SUPER_ADMIN', 'ADMIN'].includes(target.role)" },
  { rx: /target\.role === 'ADMIN' && nextRole !== 'ADMIN'/g, rep: "['SUPER_ADMIN', 'ADMIN'].includes(target.role) && !['SUPER_ADMIN', 'ADMIN'].includes(nextRole)" },
  { rx: /target\.role === 'ADMIN'/g, rep: "['SUPER_ADMIN', 'ADMIN'].includes(target.role)" }
]);


// FRONTEND
replaceInFile('c:/SE/Klyra/frontend/src/types/adminUsers.ts', [
  { rx: /target\.role === 'ADMIN' \|\| target\.role === 'MODERATOR'/g, rep: "['SUPER_ADMIN', 'ADMIN'].includes(target.role)" }
]);

replaceInFile('c:/SE/Klyra/frontend/src/pages/Profile/index.tsx', [
  { rx: /role === 'ADMIN'/g, rep: "['SUPER_ADMIN', 'ADMIN'].includes(role)" },
  { rx: /profile\.role === 'ADMIN'/g, rep: "['SUPER_ADMIN', 'ADMIN'].includes(profile.role)" }
]);

replaceInFile('c:/SE/Klyra/frontend/src/pages/AdminPanel/components/UserDrawer.tsx', [
  { rx: /\['USER', 'PROVIDER', 'MODERATOR', 'ADMIN'\]/g, rep: "['SUPER_ADMIN', 'ADMIN', 'USER']" }
]);

console.log("Done");
