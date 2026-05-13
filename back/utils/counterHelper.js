// ─── utils/counterHelper.js ──────────────────────────────────────────────────
// ✅ يستخدم GlobalCounter الموجود في الـ Schema
// ─────────────────────────────────────────────────────────────────────────────

const prisma = require('../config/db');

/**
 * يولّد رقم فاتورة تسلسلي باستخدام GlobalCounter
 * @param {string} name — اسم العداد (مثلاً 'SAL')
 * @param {string} prefix — بادئة الرقم (مثلاً 'SAL-')
 * @param {number} pad — عدد الأصفار (default 5)
 */
const nextNumber = async (name, prefix, pad = 5) => {
  const counter = await prisma.globalCounter.upsert({
    where: { name },
    create: { name, value: 1 },
    update: { value: { increment: 1 } },
  });

  return `${prefix}-${String(counter.value).padStart(pad, '0')}`;
};

module.exports = { nextNumber };