require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`DROP MATERIALIZED VIEW IF EXISTS mv_user_activity_summary CASCADE;`);
    console.log('Dropped mv_user_activity_summary');
  } catch(e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
