require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const updateToSuperAdmin = async () => {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: 'd1093a53-97c3-4a9d-aebc-018f6c2c1344' },
      data: { role: 'SUPER_ADMIN' }
    });
    console.log('Successfully upgraded user to SUPER_ADMIN:', updatedUser.email);
  } catch (error) {
    console.error('Failed to update user role:', error);
  } finally {
    await prisma.$disconnect();
  }
};

updateToSuperAdmin();
