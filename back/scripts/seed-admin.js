
'use strict';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('');
  console.log('════════════════════════════════════════════');
  console.log('         سكريبت تصفير أرصدة الأصناف         ');
  console.log('════════════════════════════════════════════');
  console.log('');

  // ── 1. عدّ السجلات قبل التصفير ──────────────────────────────────────────
  const stockCount = await prisma.itemStock.count();
  const movCount   = await prisma.stockMovement.count();

  console.log(`📦 سجلات المخزون الحالية : ${stockCount}`);
  console.log(`📋 حركات المخزون الحالية : ${movCount}`);
  console.log('');

  if (stockCount === 0 && movCount === 0) {
    console.log('✅ الأرصدة والحركات صفر بالفعل — لا توجد بيانات للتصفير.');
    return;
  }

  // ── 2. تصفير item_stocks ─────────────────────────────────────────────────
  console.log('⏳ جارٍ تصفير أرصدة item_stocks ...');
  const updatedStock = await prisma.$executeRaw`
    UPDATE item_stocks
    SET quantity = 0,
        weight   = 0,
        "updatedAt" = NOW()
  `;
  console.log(`✅ تم تصفير ${updatedStock} سطر في item_stocks`);

  // ── 3. حذف stock_movements ───────────────────────────────────────────────
  console.log('⏳ جارٍ حذف سجلات stock_movements ...');
  const deletedMov = await prisma.$executeRaw`
    DELETE FROM stock_movements
  `;
  console.log(`✅ تم حذف ${deletedMov} سطر من stock_movements`);

  // ── 4. تحقق نهائي ───────────────────────────────────────────────────────
  console.log('');
  console.log('── تحقق نهائي ──────────────────────────────');
  const afterStock = await prisma.itemStock.count();
  const afterMov   = await prisma.stockMovement.count();
  const nonZero    = await prisma.$queryRaw`
    SELECT COUNT(*) as cnt
    FROM item_stocks
    WHERE ABS(quantity) > 0.0005 OR ABS(weight) > 0.0005
  `;

  console.log(`📦 سجلات item_stocks المتبقية    : ${afterStock}`);
  console.log(`📋 سجلات stock_movements المتبقية : ${afterMov}`);
  console.log(`⚠️  سجلات غير صفرية (لو > 0 = مشكلة): ${Number(nonZero[0]?.cnt ?? 0)}`);
  console.log('');
  console.log('════════════════════════════════════════════');
  console.log('           ✅ تم التصفير بنجاح               ');
  console.log('════════════════════════════════════════════');
  console.log('');
  console.log('ملاحظة: الفواتير والتحويلات والمرتجعات لم تُحذف.');
  console.log('         لإعادة بناء المخزون اعتمد الفواتير من جديد.');
  console.log('');
}

main()
  .catch((err) => {
    console.error('');
    console.error('❌ خطأ أثناء التصفير:');
    console.error(err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());