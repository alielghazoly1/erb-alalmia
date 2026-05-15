// ─── utils/counterHelper.js ───────────────────────────────────────────────────
// يستخدم GlobalCounter من الـ schema (@@map: "global_counters")
// atomic increment عبر prisma.$transaction لضمان uniqueness
// ─────────────────────────────────────────────────────────────────────────────
const prisma = require('../config/db');

/**
 * يرجع رقم تسلسلي جديد — مثال: 'SAL-00001'
 * @param {string} name   - اسم العداد (مثلاً 'SAL')
 * @param {string} prefix - البادئة في الرقم (مثلاً 'SAL')
 */
const nextNumber = async (name, prefix) => {
  // ✅ FIX: globalCounter بدل counter (اسم الموديل في الـ schema)
  const counter = await prisma.globalCounter.upsert({
    where:  { name },
    create: { name, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${String(counter.value).padStart(5, '0')}`;
};

module.exports = { nextNumber };
