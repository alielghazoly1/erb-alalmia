// ─── scripts/migrate-float-to-decimal.js ────────────────────────────────────
// Migration script: Converts Float data to Decimal safely
// Run: node scripts/migrate-float-to-decimal.js
// BACKUP YOUR DATABASE BEFORE RUNNING!
// ─────────────────────────────────────────────────────────────────────────────

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
  console.log('🚀 Starting Float → Decimal migration...');

  try {
    // ── 1. Migrate Item.minStockQty ────────────────────────────────────────
    console.log('\n📦 Migrating Item.minStockQty...');
    const items = await prisma.$queryRaw`
      SELECT id, "minStockQty" FROM "items" WHERE "minStockQty" IS NOT NULL
    `;

    let itemCount = 0;
    for (const item of items) {
      const safeValue = Number(item.minStockQty) || 0;
      await prisma.$executeRaw`
        UPDATE "items" SET "minStockQty" = ${safeValue}::DECIMAL(12,3) WHERE id = ${item.id}
      `;
      itemCount++;
    }
    console.log(`   ✅ ${itemCount} items migrated`);

    // ── 2. Migrate StockAdjustmentLine qty fields ──────────────────────────
    console.log('\n📦 Migrating StockAdjustmentLine qty fields...');
    const lines = await prisma.$queryRaw`
      SELECT id, "systemQty", "actualQty", "diffQty" 
      FROM "stock_adjustment_lines" 
      WHERE "systemQty" IS NOT NULL OR "actualQty" IS NOT NULL OR "diffQty" IS NOT NULL
    `;

    let lineCount = 0;
    for (const line of lines) {
      const sysQty = Number(line.systemQty) || 0;
      const actQty = Number(line.actualQty) || 0;
      const diffQty = Number(line.diffQty) || 0;

      await prisma.$executeRaw`
        UPDATE "stock_adjustment_lines" 
        SET "systemQty" = ${sysQty}::DECIMAL(12,3),
            "actualQty" = ${actQty}::DECIMAL(12,3),
            "diffQty" = ${diffQty}::DECIMAL(12,3)
        WHERE id = ${line.id}
      `;
      lineCount++;
    }
    console.log(`   ✅ ${lineCount} stock adjustment lines migrated`);

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n⚠️  Next steps:');
    console.log('   1. Run: npx prisma generate');
    console.log('   2. Run: npx prisma migrate deploy (or apply the SQL manually)');
    console.log('   3. Restart your backend server');

  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
