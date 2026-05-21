// ─── utils/decimalHelper.js ───────────────────────────────────────────────────
// أدوات آمنة للتعامل مع الأرقام العشرية وتجنب مشاكل Floating Point
//
// المشكلة الجوهرية:
//   5 كيلو ÷ 22.680 (وزن الكرتون) = 0.22045855... كرتون
//   ثم 0.22045855 × 22.680 = 4.999999... بدل 5 — فساد في المخزون
//
// الحل: كل العمليات الحسابية تمر عبر Decimal.js (precision 20 خانة)
//       بدل IEEE-754 float الذي يخزّن الكسور العشرية بشكل تقريبي
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const { Decimal } = require('decimal.js');

// ── إعدادات Decimal.js ────────────────────────────────────────────────────────
// precision 20: أكثر من كافية للتعامل مع أوزان الكراتين
// ROUND_HALF_UP: التقريب الطبيعي (0.5 → 1)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ── safeNum ───────────────────────────────────────────────────────────────────
/**
 * يحوّل أي قيمة (Prisma Decimal, string, null, undefined) إلى JS number
 * آمن ضد: null, undefined, NaN, Prisma Decimal objects
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

// ── toD ───────────────────────────────────────────────────────────────────────
/** يحوّل أي قيمة إلى Decimal.js instance بأمان */
const toD = (val) => {
  const n = safeNum(val);
  return new Decimal(isFinite(n) ? n : 0);
};

// ── round2 / round3 ───────────────────────────────────────────────────────────
/** تقريب إلى خانتين عشريتين (للأسعار والمبالغ) */
const round2 = (val) => parseFloat(toD(val).toDecimalPlaces(2).toString());

/** تقريب إلى 3 خانات عشرية (للكميات والأوزان) */
const round3 = (val) => parseFloat(toD(val).toDecimalPlaces(3).toString());

// ── calcWeight ────────────────────────────────────────────────────────────────
/**
 * حساب الوزن الكلي بأمان كامل ضد Floating Point
 *
 * المنطق:
 *  - لو الـ frontend بعت totalWeight صريح → نستخدمه مباشرة (أدق)
 *  - لو مبعتش → نحسب qty × unitWeight بـ Decimal.js
 *
 * مثال: qty=5, unitWeight=22.680
 *   JavaScript عادي: 5 * 22.680 = 113.39999999999999  ← فساد
 *   Decimal.js:      5 * 22.680 = 113.400             ← صح
 *
 * @param {number} qty          - الكمية بالكراتين
 * @param {number} unitWeight   - وزن الكرتون الواحد
 * @param {number|null} totalWeight - الوزن الكلي لو بعته الـ frontend
 * @returns {number} الوزن مقرّب لـ 3 خانات
 */
const calcWeight = (qty, unitWeight, totalWeight = null) => {
  if (totalWeight != null) return round3(safeNum(totalWeight));
  return round3(toD(qty).mul(toD(unitWeight)).toNumber());
};

// ── calcTotal ─────────────────────────────────────────────────────────────────
/**
 * حساب إجمالي السطر: totalWeight × price
 * يستخدم calcWeight داخلياً لضمان الوزن الصحيح
 */
const calcTotal = (qty, unitWeight, price, totalWeight = null) => {
  const tw = calcWeight(qty, unitWeight, totalWeight);
  return round2(toD(tw).mul(toD(price)).toNumber());
};

// ── sumWeights ────────────────────────────────────────────────────────────────
/**
 * جمع قائمة من الأوزان بـ Decimal.js لتجنب تراكم أخطاء الـ floating point
 * مثال: [113.400, 22.680, 45.360] → 181.440 (وليس 181.43999999...)
 */
const sumWeights = (arr) => {
  const total = arr.reduce((acc, v) => acc.plus(toD(v)), new Decimal(0));
  return round3(total.toNumber());
};

/** نفس sumWeights لكن للمبالغ (تقريب لـ 2 خانة) */
const sumAmounts = (arr) => {
  const total = arr.reduce((acc, v) => acc.plus(toD(v)), new Decimal(0));
  return round2(total.toNumber());
};

// ── quantityFromWeight ────────────────────────────────────────────────────────
/**
 * حساب الكمية من الوزن: weight ÷ unitWeight → تُقرَّب لأقرب 0.001 كرتون
 * هذه الدالة هي قلب مشكلة الـ floating point
 *
 * مثال: weight=5, unitWeight=22.680
 *   نتيجة: 0.220 كرتون (وليس 0.22045855379188...)
 */
const quantityFromWeight = (weight, unitWeight) => {
  if (!unitWeight || safeNum(unitWeight) === 0) return 0;
  return round3(toD(weight).div(toD(unitWeight)).toNumber());
};

// ── areEqual ──────────────────────────────────────────────────────────────────
/**
 * مقارنة رقمين مع tolerance لتجنب مشكلة 0 vs -0.001
 *
 * المشكلة: عدد = 0 لكن وزن = -0.001 بسبب تراكم الـ floating point
 * الحل: لو الفرق أصغر من 0.001 → نعتبرهم متساويين
 */
const areEqual = (a, b, tolerance = 0.001) => {
  return Math.abs(safeNum(a) - safeNum(b)) < tolerance;
};

// ── isEffectivelyZero ─────────────────────────────────────────────────────────
/**
 * يتحقق لو قيمة "فعلياً صفر" (قد تكون -0.001 بسبب floating point)
 * يُستخدم للتحقق من المخزون: لو qty=0 و weight=-0.001 → كلاهما فعلياً صفر
 */
const isEffectivelyZero = (val, tolerance = 0.001) => {
  return Math.abs(safeNum(val)) < tolerance;
};

// ── normalizeStockValue ───────────────────────────────────────────────────────
/**
 * ينظف أي قيمة مخزون من "الأرقام الوهمية":
 *  -0.001 → 0
 *   0.001 → 0.001 (تُبقى كما هي، قد تكون حقيقية)
 *  -0.0001 → 0
 */
const normalizeStockValue = (val, tolerance = 0.0005) => {
  const n = safeNum(val);
  return Math.abs(n) < tolerance ? 0 : round3(n);
};

// ── Prisma Decimal detection ──────────────────────────────────────────────────
const isDecimal = (val) =>
  val !== null &&
  typeof val === 'object' &&
  !(val instanceof Date) &&
  !Array.isArray(val) &&
  (typeof val.toNumber === 'function' || typeof val.toFixed === 'function');

// ── n (normalize) ─────────────────────────────────────────────────────────────
/**
 * يحوّل Prisma objects لـ plain JS بشكل recursive:
 *  - Decimal  → number (مُقرَّب بـ round3 للأوزان/الكميات)
 *  - object   → يضيف _id تلقائياً لو موجود (للـ frontend)
 *  - Array    → map(n)
 */
const n = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (isDecimal(obj)) return safeNum(obj);
  if (Array.isArray(obj)) return obj.map(n);
  if (obj instanceof Date) return obj;
  if (typeof obj === 'object') {
    const out = {};
    for (const key of Object.keys(obj)) {
      out[key] = n(obj[key]);
    }
    if (out.id && out._id === undefined) out._id = out.id;
    return out;
  }
  return obj;
};

module.exports = {
  safeNum, toD,
  round2, round3,
  calcWeight, calcTotal,
  sumWeights, sumAmounts,
  quantityFromWeight,
  areEqual, isEffectivelyZero, normalizeStockValue,
  isDecimal, n,
};
