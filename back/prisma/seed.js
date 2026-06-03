// ═══════════════════════════════════════════════════════════════════════════════
// prisma/seed.js — إعداد أولي لقاعدة البيانات
// شغّله بعد الـ migration:
// node prisma/seed.js
// ═══════════════════════════════════════════════════════════════════════════════

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.log('\x1b[33m🌱  Seeding database...\x1b[0m');

  // ────────────────────────────────────────────────────────────────────────────
  // 1) ADMIN USER
  // ────────────────────────────────────────────────────────────────────────────

  const adminExists = await prisma.user.findFirst({
    where: {
      username: 'admin',
    },
  });

  if (!adminExists) {
    const hashed = await bcrypt.hash('admin123', 10);

    await prisma.user.create({
      data: {
        name: 'المدير العام',
        username: 'admin',
        password: hashed,

        role: 'admin',
        scope: 'both',

        isActive: true,

        permissions: {
          create: [
            {
              permission: 'sale_allow_negative',
              granted: true,
            },
            {
              permission: 'sale_edit',
              granted: true,
            },
            {
              permission: 'sale_create',
              granted: true,
            },
            {
              permission: 'sale_approve',
              granted: true,
            },
            {
              permission: 'purchase_create',
              granted: true,
            },
            {
              permission: 'purchase_approve',
              granted: true,
            },
            {
              permission: 'settings_users',
              granted: true,
            },
            {
              permission: 'settings_items',
              granted: true,
            },
            {
              permission: 'settings_customers',
              granted: true,
            },
            {
              permission: 'settings_suppliers',
              granted: true,
            },
            {
              permission: 'report_sales',
              granted: true,
            },
            {
              permission: 'report_stock',
              granted: true,
            },
            {
              permission: 'treasury_manage',
              granted: true,
            },
          ],
        },
      },
    });

    console.log(
      '\x1b[32m✅  Admin created → username: admin | password: admin123\x1b[0m'
    );

    console.log(
      '\x1b[31m⚠️   غيّر كلمة المرور فوراً بعد أول تسجيل دخول!\x1b[0m'
    );
  } else {
    console.log(
      '\x1b[33m⏭️   Admin already exists — skipped\x1b[0m'
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 2) DEFAULT ACTIVE SEASON
  // ────────────────────────────────────────────────────────────────────────────

  const seasonExists = await prisma.season.findFirst({
    where: {
      isActive: true,
    },
  });

  if (!seasonExists) {
    const year = new Date().getFullYear();

    const season = await prisma.season.create({
      data: {
        name: `موسم ${year}`,
        code: `${year}`,

        startDate: new Date(`${year}-01-01T00:00:00.000Z`),
        endDate: new Date(`${year}-12-31T23:59:59.999Z`),

        isActive: true,
        isClosed: false,
        isManufacturing: false,
      },
    });

    console.log(
      `\x1b[32m✅  Season created → ${season.name}\x1b[0m`
    );
  } else {
    console.log(
      '\x1b[33m⏭️   Active season already exists — skipped\x1b[0m'
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 3) GLOBAL COUNTERS
  // ────────────────────────────────────────────────────────────────────────────

  const counterNames = [
    'SAL',
    'PUR',
    'RET',
    'TRF_R2O',
    'TRF_O2R',
    'MFG',
    'PAY',
    'ADJ',
  ];

  for (const name of counterNames) {
    await prisma.globalCounter.upsert({
      where: {
        name,
      },

      update: {},

      create: {
        name,
        value: 0,
      },
    });
  }

  console.log('\x1b[32m✅  Global counters initialized\x1b[0m');

  // ────────────────────────────────────────────────────────────────────────────
  // DONE
  // ────────────────────────────────────────────────────────────────────────────

  console.log('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.log('\x1b[32m🎉  Seed complete successfully!\x1b[0m');
}

main()
  .catch((err) => {
    console.error('\x1b[31m❌  Seed failed:\x1b[0m');
    console.error(err);

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });