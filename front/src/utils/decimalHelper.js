export const parseDecimalFromInput = (val) => {
  if (val === '' || val === null || val === undefined) return 0;
  const str = String(val).trim().replace(/,/g, '');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
};

export const formatQty = (val) => {
  const num = parseDecimalFromInput(val);
  if (num === 0) return '0';
  return num.toLocaleString('ar-EG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
};

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
