// ─── utils/decimalHelper.js ───────────────────────────────────────────────────
// ✅ ARCH-001: الوزن هو مصدر الحقيقة الوحيد — quantity مجرد عرض مشتق
//
// القاعدة الجديدة:
//   • كل عملية مخزنية تعتمد على weight فقط
//   • quantity = weight ÷ defaultWeight (للعرض فقط — لا يُصدَّق من frontend)
//   • normalizeInvoiceItems: تحسب quantity من totalWeight دائماً
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const { Decimal } = require('decimal.js');

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ── safeNum ───────────────────────────────────────────────────────────────────
const safeNum = (val, fallback = 0) => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'number')           return isNaN(val) ? fallback : val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? fallback : parsed;
  }
  if (typeof val.toNumber === 'function') return val.toNumber();
  if (typeof val.toFixed  === 'function') return parseFloat(val.toFixed(10));
  const num = Number(val);
  return isNaN(num) ? fallback : num;
};

const toD = (val) => {
  const n = safeNum(val);
  return new Decimal(isFinite(n) ? n : 0);
};

const round2 = (val) => parseFloat(toD(val).toDecimalPlaces(2).toString());
const round3 = (val) => parseFloat(toD(val).toDecimalPlaces(3).toString());

// ── calcWeight ────────────────────────────────────────────────────────────────
/**
 * ✅ ARCH-001: الوزن هو المصدر — لو totalWeight موجود نستخدمه مباشرة
 */
const calcWeight = (qty, unitWeight, totalWeight = null) => {
  if (totalWeight != null && safeNum(totalWeight) > 0)
    return round3(safeNum(totalWeight));
  return round3(toD(qty).mul(toD(unitWeight)).toNumber());
};

const calcTotal = (qty, unitWeight, price, totalWeight = null) => {
  const tw = calcWeight(qty, unitWeight, totalWeight);
  return round2(toD(tw).mul(toD(price)).toNumber());
};

const sumWeights = (arr) => {
  const total = arr.reduce((acc, v) => acc.plus(toD(v)), new Decimal(0));
  return round3(total.toNumber());
};

const sumAmounts = (arr) => {
  const total = arr.reduce((acc, v) => acc.plus(toD(v)), new Decimal(0));
  return round2(total.toNumber());
};

// ── quantityFromWeight ────────────────────────────────────────────────────────
/**
 * ✅ ARCH-001: الكمية دائماً مشتقة من الوزن
 * weight ÷ defaultWeight → بدقة عالية للعرض، مقرّبة للتخزين
 */
const quantityFromWeight = (weight, unitWeight, decimals = 10) => {
  if (!unitWeight || safeNum(unitWeight) === 0) return 0;
  return parseFloat(toD(weight).div(toD(unitWeight)).toDecimalPlaces(decimals).toString());
};

const areEqual = (a, b, tolerance = 0.001) =>
  Math.abs(safeNum(a) - safeNum(b)) < tolerance;

const isEffectivelyZero = (val, tolerance = 0.001) =>
  Math.abs(safeNum(val)) < tolerance;

// ── normalizeStockValue ───────────────────────────────────────────────────────
/**
 * ✅ ARCH-001: يُصفّر القيم الوهمية الناتجة عن floating point
 * المعيار المُقلَّص: 1e-6 بدل 0.0005 — لأن آخر رصيد قد يكون 0.001 حقيقي
 */
const normalizeStockValue = (val, tolerance = 1e-6) => {
  const n = safeNum(val);
  return Math.abs(n) < tolerance ? 0 : round3(n);
};

const isDecimal = (val) =>
  val !== null &&
  typeof val === 'object' &&
  !(val instanceof Date) &&
  !Array.isArray(val) &&
  (typeof val.toNumber === 'function' || typeof val.toFixed === 'function');

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

// ── normalizeInvoiceItems ─────────────────────────────────────────────────────
/**
 * ✅ ARCH-001: الوزن هو المصدر الوحيد للحقيقة
 *
 * المنطق المُحكَم:
 *   1. لو totalWeight > 0 → هو المصدر، يُحسب quantity = totalWeight ÷ unitWeight
 *   2. لو quantity > 0 → يُحسب totalWeight = quantity × unitWeight
 *   3. quantity في الـ DB = totalWeight ÷ unitWeight (بدقة عالية)
 *
 * quantity القادم من الـ frontend يُعاد حسابه دائماً — لا يُصدَّق
 *
 * @param {Array}   items         - أصناف الفاتورة من request.body
 * @param {Object}  opts
 * @param {boolean} opts.hasPrice     - هل فيه price؟
 * @param {number}  opts.qtyDecimals  - دقة quantity المحسوبة (افتراضي 10)
 */
const normalizeInvoiceItems = (items, { hasPrice = true, qtyDecimals = 10 } = {}) => {
  return items.map(item => {
    const unitW = toD(safeNum(item.weight));   // وزن الوحدة (الكرتون)
    const price = toD(safeNum(item.price ?? 0));

    let tw;   // totalWeight الحقيقي
    let qty;  // quantity المشتق

    const sentTW  = safeNum(item.totalWeight);
    const sentQty = safeNum(item.quantity);

    if (sentTW > 0) {
      // ✅ الوزن الكلي هو المصدر
      tw  = toD(sentTW);
      qty = unitW.gt(0)
        ? tw.div(unitW).toDecimalPlaces(qtyDecimals)
        : toD(sentQty);
    } else if (sentQty > 0 && unitW.gt(0)) {
      // fallback: العدد فقط → نحسب الوزن
      qty = toD(sentQty);
      tw  = qty.mul(unitW).toDecimalPlaces(3);
    } else {
      qty = toD(sentQty);
      tw  = toD(0);
    }

    const qtyFinal = parseFloat(qty.toDecimalPlaces(qtyDecimals).toString());
    const twFinal  = parseFloat(tw.toDecimalPlaces(3).toString());
    const totFinal = hasPrice
      ? parseFloat(tw.mul(price).toDecimalPlaces(2).toString())
      : 0;

    return {
      ...item,
      quantity:    qtyFinal,
      totalWeight: twFinal,
      total:       totFinal,
      _tw:         twFinal,
    };
  });
};

module.exports = {
  safeNum, toD,
  round2, round3,
  calcWeight, calcTotal,
  sumWeights, sumAmounts,
  quantityFromWeight,
  areEqual, isEffectivelyZero, normalizeStockValue,
  isDecimal, n,
  normalizeInvoiceItems,
};
