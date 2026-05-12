// ─── supplierUtils.js ────────────────────────────────────────────────────────
// دوال مساعدة مشتركة بين كل مكوّنات الموردين
// ────────────────────────────────────────────────────────────────────────────

/**
 * تنسيق الأرقام بفاصلة آلاف + خانتين عشريتين
 * @param {number} n
 * @returns {string}  مثال: 12,500.00
 */
export const fmt = (n) =>
  Number(n || 0).toLocaleString('en-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * تنسيق التاريخ بالعربي
 * @param {string|Date} d
 * @returns {string}
 */
export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('ar-EG') : '—';

/** تسميات طرق الدفع */
export const PAY_METHOD_LABEL = {
  cash:     'نقدي',
  instapay: 'انستاباي',
  transfer: 'تحويل',
  check:    'شيك',
};
