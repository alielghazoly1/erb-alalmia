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
 * smartFmt — عرض رقم بدون أصفار زيادة في النهاية
 * بيضبط عدد الخانات تلقائياً:
 *   - الأعداد الصحيحة: بلا فاصلة           → "5"    مش "5.000"
 *   - رقم كسري:        بأقل خانات ممكنة    → "22.68" مش "22.680"
 *   - يحترم maxDecimals كحد أقصى للدقة
 *
 * @param {*}      v            — القيمة
 * @param {number} maxDecimals  — أقصى خانات عشرية (default: 3)
 * @param {number} minDecimals  — أدنى خانات عشرية (default: 0)
 * @returns {string}
 */
export const smartFmt = (v, maxDecimals = 3, minDecimals = 0) => {
  const n = toNum(v);
  // نقرّب للدقة المطلوبة أولاً لتجنب 22.6800000001
  const rounded = parseFloat(n.toFixed(maxDecimals));
  // نحوّل لـ string ونشيل الأصفار الزيادة
  let s = rounded.toFixed(maxDecimals);
  if (s.includes('.')) {
    s = s.replace(/\.?0+$/, '');        // شيل أصفار النهاية والنقطة لو اتشالوا كلهم
  }
  // لو minDecimals > 0، نضمن إن فيه على الأقل minDecimals خانة
  if (minDecimals > 0) {
    const parts = s.split('.');
    const currentDec = parts[1]?.length ?? 0;
    if (currentDec < minDecimals) {
      s = rounded.toFixed(minDecimals);
    }
  }
  return s;
};

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
