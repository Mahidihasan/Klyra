const fs = require('fs');
const files = [
  'admin.activity.service.ts',
  'admin.marketplace.service.ts',
  'admin.revenue.service.ts',
  'admin.subscriptions.service.ts',
  'admin.usage.service.ts'
];

files.forEach(f => {
  const path = 'c:/SE/Klyra/backend/src/modules/admin/' + f;
  if (fs.existsSync(path)) {
    let content = fs.readFileSync(path, 'utf8');
    // replace backslash followed by backtick with just backtick
    content = content.replace(/\\`/g, '`');
    // Also replace \${ with ${ since that was escaped too!
    content = content.replace(/\\\${/g, '${');
    fs.writeFileSync(path, content);
    console.log('Fixed', f);
  }
});
