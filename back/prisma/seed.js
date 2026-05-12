// ═══════════════════════════════════════════════════════════════════════════════
//  prisma/seed.js — إعداد أولي لقاعدة البيانات
//  شغّله مرة واحدة بعد أول migration:  npm run db:seed
// ═══════════════════════════════════════════════════════════════════════════════

const { PrismaClient } = require('@prisma/client');
const bcrypt           = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.log('\x1b[33m🌱  Seeding database...\x1b[0m');

  // ── 1. Admin User ─────────────────────────────────────────────────────────
  const adminExists = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (!adminExists) {
    const hashed = await bcrypt.hash('admin123', 10);
    const admin  = await prisma.user.create({
      data: {
        name:     'المدير العام',
        username: 'admin',
        password: hashed,
        role:     'admin',
        warehouse:'both',
        isActive: true,
        permissions: { allowNegativeSale: true, canEditInvoice: true },
      },
    });
    console.log(`\x1b[32m✅  Admin created → username: admin | password: admin123\x1b[0m`);
    console.log('\x1b[31m⚠️   غيّر كلمة المرور فوراً بعد أول تسجيل دخول!\x1b[0m');
  } else {
    console.log('\x1b[33m⏭️   Admin already exists — skipped\x1b[0m');
  }

  // ── 2. Default Active Season ──────────────────────────────────────────────
  const seasonExists = await prisma.season.findFirst({ where: { isActive: true } });
  if (!seasonExists) {
    const year   = new Date().getFullYear();
    const season = await prisma.season.create({
      data: {
        name:      `موسم ${year}`,
        startDate: new Date(`${year}-01-01`),
        endDate:   new Date(`${year}-12-31`),
        isActive:  true,
      },
    });
    console.log(`\x1b[32m✅  Season created → ${season.name}\x1b[0m`);
  } else {
    console.log('\x1b[33m⏭️   Active season already exists — skipped\x1b[0m');
  }

  // ── 3. Counter seeds ──────────────────────────────────────────────────────
  const counterNames = ['SAL', 'PUR', 'RET', 'TRF_R2O', 'TRF_O2R'];
  for (const name of counterNames) {
    await prisma.counter.upsert({
      where:  { name },
      create: { name, value: 0 },
      update: {},
    });
  }
  console.log(`\x1b[32m✅  Counters initialized\x1b[0m`);

  console.log('\x1b[36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.log('\x1b[32m🎉  Seed complete!\x1b[0m');
}

main()
  .catch((err) => {
    console.error('\x1b[31m❌  Seed failed:\x1b[0m', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
