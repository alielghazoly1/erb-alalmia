const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('admin123', 10);

  const user = await prisma.user.create({
    data: {
      name: 'Admin',
      username: 'hassan',
      password: hash,
      role: 'admin',
      warehouse: 'ramses',
      permissions: {
        allowNegativeSale: false,
        canEditInvoice: false
      }
    }
  });

  console.log('تم إنشاء المستخدم:', user.username);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());