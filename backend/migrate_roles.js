require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const res = await prisma.$executeRawUnsafe(`
      UPDATE users
      SET role = 'USER'::user_role
      WHERE role NOT IN ('ADMIN'::user_role);
    `);
    console.log('Updated users: ' + res);
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
