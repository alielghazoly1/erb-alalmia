// ─── utils/decimalHelper.js ───────────────────────────────────────────────────
// بعد تحويل الـ schema من Float لـ Decimal، Prisma بيرجع Decimal objects
// مش plain numbers. الـ helper ده بيتعامل مع التحويل بأمان.
//
// القاعدة:
//   - INPUT  (من frontend/request): نحوّل بـ safeNum() لـ number
//   - OUTPUT (من Prisma/DB): نحوّل بـ n() في response — يحوّل Decimal → number
//   - الحسابات: plain JavaScript numbers (كافي مع NUMERIC في PG)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * safeNum — تحويل أي قيمة لـ number آمن
 * يقبل string, Decimal object, number, null, undefined
 */
const safeNum = (v, fallback = 0) => {
  if (v === null || v === undefined) return fallback;
  // Prisma Decimal object
  if (v !== null && typeof v === 'object' && typeof v.toNumber === 'function') {
    return v.toNumber();
  }
  const n = Number(v);
  return isFinite(n) ? n : fallback;
};

/**
 * round2 — تقريب لـ 2 decimal (للأموال)
 */
const round2 = (v) => Math.round(safeNum(v) * 100) / 100;

/**
 * round3 — تقريب لـ 3 decimal (للأوزان والكميات)
 */
const round3 = (v) => Math.round(safeNum(v) * 1000) / 1000;

/**
 * normalizeRecord — يحوّل كل الـ Decimal fields في object لـ number
 * يشتغل recursively على nested objects/arrays
 */
const normalizeRecord = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(normalizeRecord);
  if (typeof obj === 'object' && typeof obj.toNumber === 'function') {
    return obj.toNumber(); // Decimal object
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = normalizeRecord(v);
    }
    if (!result._id && result.id) result._id = result.id;
    return result;
  }
  return obj;
};

/**
 * n — alias لـ normalizeRecord (للاستخدام في controllers)
 * مثال: res.json(n(invoice))
 */
const n = normalizeRecord;

module.exports = { safeNum, round2, round3, normalizeRecord, n };
