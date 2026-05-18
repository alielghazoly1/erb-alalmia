// ─── front/src/utils/decimalHelper.js ────────────────────────────────────────
// أدوات التعامل مع الأرقام العشرية
// ─────────────────────────────────────────────────────────────────────────────

/**
 * parseDecimalFromInput — تحويل إدخال المستخدم لرقم عشري آمن
 */
export const parseDecimalFromInput = (val) => {
  if (val === '' || val === null || val === undefined) return 0;
  const str = String(val).trim().replace(/,/g, '');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * formatQty — تنسيق الكمية (3 منازل عشرية)
 */
export const formatQty = (val) => {
  const num = parseDecimalFromInput(val);
  if (num === 0) return '0';
  return num.toLocaleString('ar-EG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
};

/**
 * formatPrice — تنسيق السعر (2 منازل عشرية) ✅ FIXED: added this function
 */
export const formatPrice = (val) => {
  const num = parseDecimalFromInput(val);
  if (num === 0) return '0.00';
  return num.toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * safeNum — تحويل آمن لأي قيمة لرقم
 */
export const safeNum = (val, fallback = 0) => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val.replace(/,/g, ''));
    return isNaN(parsed) ? fallback : parsed;
  }
  if (val && typeof val === 'object') return parseFloat(String(val));
  const num = Number(val);
  return isNaN(num) ? fallback : num;
};

/**
 * round3 — تقريب لـ 3 منازل
 */
export const round3 = (val) => {
  const num = safeNum(val);
  return Math.round(num * 1000) / 1000;
};
