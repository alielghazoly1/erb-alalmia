// ─── utils/counterHelper.js ───────────────────────────────────────────────────
// ✅ FIX CRIT-NUM-002: nextNumber الآن atomic بـ prisma.$transaction(Serializable)
//    الإصلاح يمنع Race Condition الذي كان يجعل فاتورتين تأخذان نفس الرقم
//    عند استدعاء nextNumber() في نفس اللحظة من طلبين متزامنين
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const prisma = require('../config/db');

/**
 * يرجع رقم تسلسلي جديد — مثال: 'SAL-00001'
 * ✅ ATOMIC: يعمل داخل transaction serializable لضمان عدم تكرار الأرقام
 *    حتى لو جاء طلبان في نفس اللحظة (Race Condition)
 *
 * @param {string} name   - اسم العداد (مثلاً 'SAL')
 * @param {string} prefix - البادئة في الرقم (مثلاً 'SAL')
 * @param {object|null} tx - Prisma transaction context (اختياري)
 */
const nextNumber = async (name, prefix, tx = null) => {
  // لو في transaction خارجي — نستخدمه مباشرة بدون transaction داخلي
  if (tx) {
    const counter = await tx.globalCounter.upsert({
      where:  { name },
      create: { name, value: 1 },
      update: { value: { increment: 1 } },
    });
    return `${prefix}-${String(counter.value).padStart(5, '0')}`;
  }

  // ✅ FIX: serializable transaction لمنع قراءة نفس الـ value قبل الـ increment
  const result = await prisma.$transaction(async (txInner) => {
    const counter = await txInner.globalCounter.upsert({
      where:  { name },
      create: { name, value: 1 },
      update: { value: { increment: 1 } },
    });
    return `${prefix}-${String(counter.value).padStart(5, '0')}`;
  }, {
    isolationLevel: 'Serializable',
  });

  return result;
};

module.exports = { nextNumber };
