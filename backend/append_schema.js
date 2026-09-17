const fs = require('fs');
fs.appendFileSync('prisma/schema.prisma', '\n\nmodel RolePermission {\n  role        user_role @id\n  permissions Json      @default("[]")\n}\n');
console.log('Appended schema');
