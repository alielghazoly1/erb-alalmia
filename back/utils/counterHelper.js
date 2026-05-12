// ─── utils/counterHelper.js ───────────────────────────────────────────────────
// بديل Counter model من MongoDB
// بيستخدم Prisma transaction عشان يضمن atomic increment
// ──────────────────────────────────────────────────────────────────────────────

const prisma = require('../config/db');

/**
 * يرجع رقم تسلسلي جديد لأي prefix (SAL, PUR, RET, TRF, MAN ...)
 * @param {string} name - اسم العداد
 * @param {string} prefix - البادئة في الرقم (مثلاً 'SAL')
 * @returns {Promise<string>} - مثلاً 'SAL-00001'
 */
const nextNumber = async (name, prefix) => {
  const counter = await prisma.counter.upsert({
    where:  { name },
    create: { name, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${String(counter.value).padStart(5, '0')}`;
};

module.exports = { nextNumber };
