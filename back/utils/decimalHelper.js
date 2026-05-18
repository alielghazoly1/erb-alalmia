const safeNum = (val, fallback = 0) => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? fallback : parsed;
  }
  if (val && typeof val.toNumber === 'function') return val.toNumber();
  if (val && typeof val.toFixed === 'function') return parseFloat(val.toFixed(10));
  const num = Number(val);
  return isNaN(num) ? fallback : num;
};

const round2 = (val) => {
  const num = safeNum(val);
  return Math.round(num * 100) / 100;
};

const round3 = (val) => {
  const num = safeNum(val);
  return Math.round(num * 1000) / 1000;
};

module.exports = { safeNum, round2, round3 };
