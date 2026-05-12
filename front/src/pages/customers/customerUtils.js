// ─── customerUtils.js ───────────────────────────────────────────────────────
// دوال مساعدة مشتركة بين كل مكوّنات العملاء
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
 * @returns {string}  مثال: ١٥ يناير ٢٠٢٥
 */
export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('ar-EG') : '—';

/**
 * تنسيق الوقت بالعربي (ساعة:دقيقة)
 * @param {string|Date} d
 * @returns {string}
 */
export const fmtTime = (d) =>
  d
    ? new Date(d).toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

/** تسميات طرق الدفع */
export const PAY_METHOD_LABEL = {
  cash:      'نقدي',
  instapay:  'انستاباي',
  transfer:  'تحويل',
  check:     'شيك',
};

/**
 * إرجاع classes ألوان الـ badge حسب نوع العميل
 * @param {'credit'|'cash'} type
 * @returns {string}
 */
export const typeClass = (type) =>
  type === 'cash'
    ? 'bg-green-100 text-green-700'
    : 'bg-blue-100 text-blue-700';

/**
 * إرجاع تسمية نوع العميل بالعربي
 * @param {'credit'|'cash'} type
 * @returns {string}
 */
export const typeLabel = (type) => (type === 'cash' ? 'نقدي' : 'آجل');
