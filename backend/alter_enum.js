require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';`);
    console.log("Successfully ran ALTER TYPE user_role ADD VALUE 'SUPER_ADMIN';");
  } catch (error) {
    console.error("Failed to alter type:", error);
  } finally {
    await prisma.$disconnect();
  }
}
main();
