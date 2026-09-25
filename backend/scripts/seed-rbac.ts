import { PrismaClient, Permission } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding RBAC roles...');

  // 1. Fetch all permissions available in the system
  const allPermissions = Object.values(Permission);

  // 2. Assign ALL permissions to the ADMIN role so they have full access by default
  // This allows the SUPER_ADMIN to later toggle these on/off individually via the matrix
  await prisma.rolePermission.upsert({
    where: { role: 'ADMIN' },
    update: { permissions: allPermissions },
    create: { role: 'ADMIN', permissions: allPermissions },
  });

  console.log('ADMIN role seeded with full permissions successfully.');
  
  // 3. For SUPER_ADMIN, we can optionally seed it as well, though the middleware bypasses it anyway.
  await prisma.rolePermission.upsert({
    where: { role: 'SUPER_ADMIN' },
    update: { permissions: allPermissions },
    create: { role: 'SUPER_ADMIN', permissions: allPermissions },
  });

  console.log('SUPER_ADMIN role seeded with full permissions successfully.');
  
  // 4. USER role has no admin permissions
  await prisma.rolePermission.upsert({
    where: { role: 'USER' },
    update: { permissions: [] },
    create: { role: 'USER', permissions: [] },
  });
  
  console.log('USER role seeded with empty permissions successfully.');
}

main()
  .catch((e) => {
    console.error('Error seeding roles:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
