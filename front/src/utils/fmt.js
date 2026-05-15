// ─── utils/fmt.js ─────────────────────────────────────────────────────────────
// Safe number utilities — handles Prisma Decimal strings/objects, null, undefined
// ─────────────────────────────────────────────────────────────────────────────

/** تحويل أي قيمة لـ number آمن */
export const toNum = (v, fallback = 0) => {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'object' && typeof v.toNumber === 'function') return v.toNumber();
  const n = Number(v);
  return isFinite(n) ? n : fallback;
};

/** تقريب لـ 2 decimal آمن */
export const round2 = (v) => Math.round(toNum(v) * 100) / 100;

/** تقريب لـ 3 decimal آمن */
export const round3 = (v) => Math.round(toNum(v) * 1000) / 1000;

/** عرض رقم بفواصل ألاف + خانتين عشريتين */
export const fmt = (v, decimals = 2) =>
  toNum(v).toLocaleString('ar-EG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/** عرض رقم بـ toFixed آمن */
export const fmtFixed = (v, d = 2) => toNum(v).toFixed(d);

export default fmt;
