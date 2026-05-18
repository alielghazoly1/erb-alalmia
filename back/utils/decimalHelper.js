// ─── utils/decimalHelper.js ───────────────────────────────────────────────────
// أدوات آمنة للتعامل مع Decimal (Prisma) والـ response normalization
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

/**
 * safeNum — يحوّل أي قيمة (Prisma Decimal, string, null, undefined) لـ JS number
 */
const safeNum = (val, fallback = 0) => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'number')           return isNaN(val) ? fallback : val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? fallback : parsed;
  }
  // Prisma Decimal object
  if (typeof val.toNumber === 'function') return val.toNumber();
  if (typeof val.toFixed  === 'function') return parseFloat(val.toFixed(10));
  const num = Number(val);
  return isNaN(num) ? fallback : num;
};

const round2 = (val) => Math.round(safeNum(val) * 100) / 100;
const round3 = (val) => Math.round(safeNum(val) * 1000) / 1000;

// Prisma Decimal object detection
const isDecimal = (val) =>
  val !== null &&
  typeof val === 'object' &&
  !(val instanceof Date) &&
  !Array.isArray(val) &&
  (typeof val.toNumber === 'function' || typeof val.toFixed === 'function');

/**
 * n (normalize) — يحوّل Prisma objects لـ plain JS بشكل recursive:
 *  - Decimal  → number
 *  - object   → بيضيف _id: obj.id تلقائياً لو موجود (للـ frontend)
 *  - Array    → map(n)
 *  - Date     → كما هي
 *  - primitives → كما هي
 */
const n = (obj) => {
  if (obj === null || obj === undefined) return obj;

  // Prisma Decimal
  if (isDecimal(obj)) return safeNum(obj);

  // Array
  if (Array.isArray(obj)) return obj.map(n);

  // Date — نرجعها زي ما هي
  if (obj instanceof Date) return obj;

  // Plain object
  if (typeof obj === 'object') {
    const out = {};
    for (const key of Object.keys(obj)) {
      out[key] = n(obj[key]);
    }
    // ✅ يضيف _id تلقائياً لو الـ object عنده id — مطلوب في الـ frontend
    if (out.id && out._id === undefined) out._id = out.id;
    return out;
  }

  // primitives (string, number, boolean)
  return obj;
};

module.exports = { safeNum, round2, round3, n };
