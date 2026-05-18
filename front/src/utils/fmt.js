// ─── utils/fmt.js ─────────────────────────────────────────────────────────────
// Safe number utilities — يتعامل مع:
//   - Prisma Decimal objects (من بعد تحويل schema لـ Decimal)
//   - Strings من API
//   - null / undefined
//   - NaN / Infinity
// ─────────────────────────────────────────────────────────────────────────────

/** تحويل أي قيمة لـ number آمن */
export const toNum = (v, fallback = 0) => {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'object' && typeof v.toNumber === 'function') return v.toNumber();
  const n = Number(v);
  return isFinite(n) ? n : fallback;
};

/** تقريب لـ 2 decimal */
export const round2 = (v) => Math.round(toNum(v) * 100) / 100;

/** تقريب لـ 3 decimal */
export const round3 = (v) => Math.round(toNum(v) * 1000) / 1000;

/**
 * fmtFixed — عرض رقم بعدد خانات عشرية محدد (string)
 * @param {*}      v       — القيمة (أي نوع)
 * @param {number} d       — خانات عشرية (default: 2)
 * @returns {string}       — مثال: "1234.56"
 */
export const fmtFixed = (v, d = 2) => toNum(v).toFixed(d);

/**
 * fmt — عرض رقم بفواصل ألاف + خانتين عشريتين
 * @returns {string}       — مثال: "1,234.56"
 */
export const fmt = (v, decimals = 2) =>
  toNum(v).toLocaleString('ar-EG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export default fmt;
