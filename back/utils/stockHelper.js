// ─── utils/stockHelper.js ─────────────────────────────────────────────────────
// ✅ ARCH-001: الوزن هو مصدر الحقيقة الوحيد
//   • updateStock: يخصم/يضيف بالوزن فقط — quantity يُحسب تلقائياً من weight ÷ defaultWeight
//   • _normalizeStockRow: tolerance مُقلَّص إلى 1e-6 لمنع صفرة آخر رصيد حقيقي
//   • checkStockAvailability: يعتمد على weight فقط
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const prisma = require('../config/db');
const { safeNum, round2, round3, normalizeStockValue, toD } = require('./decimalHelper');

const OUT_TYPES = new Set([
  'sale_out', 'return_out', 'transfer_out', 'manufacturing_out', 'adjustment_sub',
]);

const db = (tx) => tx || prisma;

// ── getStockBalance ───────────────────────────────────────────────────────────
const getStockBalance = async (itemId, warehouse, seasonId, tx = null) => {
  const client = db(tx);
  const stock = await client.itemStock.findFirst({
    where: { itemId, warehouse, seasonId: seasonId ?? null },
  });
  return {
    quantity: safeNum(stock?.quantity, 0),
    weight:   safeNum(stock?.weight,   0),
  };
};

const getStockQty = (itemId, warehouse, seasonId, tx = null) =>
  getStockBalance(itemId, warehouse, seasonId, tx);

// ── updateStock ───────────────────────────────────────────────────────────────
/**
 * ✅ ARCH-001: التحديث يعتمد على weight فقط
 *   quantity = weight ÷ defaultWeight (محسوبة تلقائياً من الـ DB)
 *   لو delta.quantity مُمرَّر يُحسب quantity في الـ DB كـ: existing + delta.quantity
 *   لكن الأصح أن تُمرَّر delta.weight دايماً
 */
const updateStock = async (itemId, warehouse, seasonId, delta, tx = null) => {
  const client = db(tx);
  const dWt  = round3(safeNum(delta.weight));

  // ✅ ARCH-001: quantity تُحسب من weight ÷ defaultWeight تلقائياً
  // نجيب defaultWeight من جدول items
  const item = await client.item.findUnique({
    where: { id: itemId },
    select: { defaultWeight: true },
  });
  const defaultWeight = safeNum(item?.defaultWeight, 0);

  // دلتا الكمية: إما من الـ delta المُمرَّر أو محسوبة من الوزن
  const dQty = delta.quantity !== undefined
    ? round3(safeNum(delta.quantity))
    : (defaultWeight > 0
        ? parseFloat(toD(dWt).div(toD(defaultWeight)).toDecimalPlaces(10).toString())
        : 0);

  if (seasonId) {
    const updated = await client.$executeRaw`
      UPDATE item_stocks
      SET
        weight   = ROUND(CAST(weight   + ${dWt}  AS numeric), 3),
        quantity = CASE
          WHEN ${defaultWeight}::numeric > 0
          THEN ROUND(CAST((weight + ${dWt}) / ${defaultWeight} AS numeric), 10)
          ELSE ROUND(CAST(quantity + ${dQty} AS numeric), 10)
        END,
        "updatedAt" = NOW()
      WHERE "itemId"   = ${itemId}::uuid
        AND warehouse  = ${warehouse}::"Warehouse"
        AND "seasonId" = ${seasonId}::uuid
    `;

    if (updated === 0) {
      const initWt  = Math.max(0, dWt);
      const initQty = defaultWeight > 0
        ? parseFloat(toD(initWt).div(toD(defaultWeight)).toDecimalPlaces(10).toString())
        : Math.max(0, dQty);
      await client.$executeRaw`
        INSERT INTO item_stocks (id, "itemId", warehouse, "seasonId", quantity, weight, "updatedAt")
        VALUES (
          gen_random_uuid(),
          ${itemId}::uuid,
          ${warehouse}::"Warehouse",
          ${seasonId}::uuid,
          ${initQty},
          ${initWt},
          NOW()
        )
        ON CONFLICT ("itemId", warehouse, "seasonId") DO UPDATE
          SET
            weight   = ROUND(item_stocks.weight   + ${dWt},  3),
            quantity = CASE
              WHEN ${defaultWeight}::numeric > 0
              THEN ROUND(CAST((item_stocks.weight + ${dWt}) / ${defaultWeight} AS numeric), 10)
              ELSE ROUND(item_stocks.quantity + ${dQty}, 10)
            END,
            "updatedAt" = NOW()
      `;
    }
  } else {
    const updated = await client.$executeRaw`
      UPDATE item_stocks
      SET
        weight   = ROUND(CAST(weight   + ${dWt}  AS numeric), 3),
        quantity = CASE
          WHEN ${defaultWeight}::numeric > 0
          THEN ROUND(CAST((weight + ${dWt}) / ${defaultWeight} AS numeric), 10)
          ELSE ROUND(CAST(quantity + ${dQty} AS numeric), 10)
        END,
        "updatedAt" = NOW()
      WHERE "itemId"  = ${itemId}::uuid
        AND warehouse = ${warehouse}::"Warehouse"
        AND "seasonId" IS NULL
    `;

    if (updated === 0) {
      const initWt  = Math.max(0, dWt);
      const initQty = defaultWeight > 0
        ? parseFloat(toD(initWt).div(toD(defaultWeight)).toDecimalPlaces(10).toString())
        : Math.max(0, dQty);
      await client.$executeRaw`
        INSERT INTO item_stocks (id, "itemId", warehouse, "seasonId", quantity, weight, "updatedAt")
        VALUES (
          gen_random_uuid(),
          ${itemId}::uuid,
          ${warehouse}::"Warehouse",
          NULL,
          ${initQty},
          ${initWt},
          NOW()
        )
        ON CONFLICT ("itemId", warehouse, "seasonId") DO UPDATE
          SET
            weight   = ROUND(item_stocks.weight   + ${dWt},  3),
            quantity = CASE
              WHEN ${defaultWeight}::numeric > 0
              THEN ROUND(CAST((item_stocks.weight + ${dWt}) / ${defaultWeight} AS numeric), 10)
              ELSE ROUND(item_stocks.quantity + ${dQty}, 10)
            END,
            "updatedAt" = NOW()
      `;
    }
  }

  // ✅ ARCH-001: tolerance مُقلَّص لـ 1e-6 — لا نُصفِّر رصيد 0.001 كيلو حقيقي
  await _normalizeStockRow(itemId, warehouse, seasonId, client);
};

// ── _normalizeStockRow (private) ──────────────────────────────────────────────
/**
 * ✅ ARCH-001: يُصفِّر القيم الوهمية (<1e-6) فقط
 * المعيار القديم 0.0005 كان يُصفِّر آخر رصيد حقيقي!
 * المعيار الجديد 1e-6 يمنع فقط أخطاء floating point الحقيقية (مثل -0.000000001)
 */
const _normalizeStockRow = async (itemId, warehouse, seasonId, client) => {
  const TOLERANCE = 0.000001; // 1e-6
  if (seasonId) {
    await client.$executeRaw`
      UPDATE item_stocks
      SET
        weight   = CASE WHEN ABS(weight)   < ${TOLERANCE}::numeric THEN 0 ELSE weight   END,
        quantity = CASE WHEN ABS(quantity) < ${TOLERANCE}::numeric THEN 0 ELSE quantity END,
        "updatedAt" = NOW()
      WHERE "itemId"   = ${itemId}::uuid
        AND warehouse  = ${warehouse}::"Warehouse"
        AND "seasonId" = ${seasonId}::uuid
        AND (ABS(weight) < ${TOLERANCE}::numeric OR ABS(quantity) < ${TOLERANCE}::numeric)
    `;
  } else {
    await client.$executeRaw`
      UPDATE item_stocks
      SET
        weight   = CASE WHEN ABS(weight)   < ${TOLERANCE}::numeric THEN 0 ELSE weight   END,
        quantity = CASE WHEN ABS(quantity) < ${TOLERANCE}::numeric THEN 0 ELSE quantity END,
        "updatedAt" = NOW()
      WHERE "itemId"  = ${itemId}::uuid
        AND warehouse = ${warehouse}::"Warehouse"
        AND "seasonId" IS NULL
        AND (ABS(weight) < ${TOLERANCE}::numeric OR ABS(quantity) < ${TOLERANCE}::numeric)
    `;
  }
};

// ── createStockMovement ───────────────────────────────────────────────────────
const createStockMovement = async ({
  itemId, itemCode, itemName, type,
  quantity, weight, price = 0,
  warehouse, reference, referenceModel, referenceId,
  seasonId, createdById, date,
}, tx = null) => {
  const client = db(tx);
  const qty   = safeNum(quantity);
  const wt    = safeNum(weight);
  const isOut = OUT_TYPES.has(type);

  const balance = await getStockBalance(itemId, warehouse, seasonId, client);

  return client.stockMovement.create({
    data: {
      itemId, itemCode, itemName, type,
      quantityIn:    isOut ? 0   : qty,
      quantityOut:   isOut ? qty : 0,
      weightIn:      isOut ? 0   : wt,
      weightOut:     isOut ? wt  : 0,
      price:         round2(price),
      warehouse,
      balanceQty:    balance.quantity,
      balanceWeight: balance.weight,
      reference,
      referenceModel,
      referenceId,
      seasonId:      seasonId ?? null,
      createdById,
      date:          date ? new Date(date) : new Date(),
    },
  });
};

// ── recordStockMovement ───────────────────────────────────────────────────────
/**
 * ✅ ARCH-001: All-in-one — يعتمد على weight فقط
 */
const recordStockMovement = async ({
  itemId, itemCode, itemName, type,
  quantityIn  = 0, quantityOut = 0,
  weightIn    = 0, weightOut   = 0,
  price = 0, warehouse,
  reference, referenceModel, referenceId,
  seasonId, userId,
}, tx = null) => {
  const wIn  = safeNum(weightIn);
  const wOut = safeNum(weightOut);
  const netWeight = round3(wIn - wOut);

  // ✅ ARCH-001: نحسب الكمية من الوزن بعد التحديث — لا نعتمد على quantityIn/Out
  // نمرر delta.weight فقط، والكمية تُحسب تلقائياً في updateStock
  await updateStock(itemId, warehouse, seasonId, { weight: netWeight }, tx);

  const balance = await getStockBalance(itemId, warehouse, seasonId, tx);
  const client  = db(tx);

  const qIn  = safeNum(quantityIn);
  const qOut = safeNum(quantityOut);

  return client.stockMovement.create({
    data: {
      itemId, itemCode, itemName, type,
      quantityIn: qIn,  quantityOut: qOut,
      weightIn: wIn,    weightOut: wOut,
      price:    round2(price),
      warehouse,
      balanceQty:    balance.quantity,
      balanceWeight: balance.weight,
      reference, referenceModel, referenceId,
      seasonId: seasonId ?? null,
      createdById: userId,
    },
  });
};

// ── getItemStockMap ───────────────────────────────────────────────────────────
const getItemStockMap = async (itemId, seasonId, tx = null) => {
  const client = db(tx);
  const stocks = await client.itemStock.findMany({
    where: { itemId, seasonId: seasonId ?? null },
  });
  const map = {
    ramses:  { quantity: 0, weight: 0 },
    october: { quantity: 0, weight: 0 },
  };
  for (const s of stocks) {
    if (map[s.warehouse]) {
      map[s.warehouse].quantity = normalizeStockValue(s.quantity);
      map[s.warehouse].weight   = normalizeStockValue(s.weight);
    }
  }
  return map;
};

// ── checkStockAvailability ────────────────────────────────────────────────────
/**
 * ✅ ARCH-001: التحقق يعتمد على weight فقط
 */
const checkStockAvailability = async (itemId, warehouse, seasonId, requestedWeight, tx = null) => {
  const stock = await getStockBalance(itemId, warehouse, seasonId, tx);
  const wt    = safeNum(requestedWeight);
  return {
    available:       stock.weight >= wt,
    stockWeight:     stock.weight,
    stockQty:        stock.quantity,
    requestedWeight: wt,
    shortfall:       Math.max(0, wt - stock.weight),
  };
};

const reserveStock = async () => ({ reserved: true });
const releaseStock = async () => ({ released: true });

module.exports = {
  recordStockMovement,
  getStockBalance,
  getItemStockMap,
  checkStockAvailability,
  reserveStock,
  releaseStock,
  getStockQty,
  updateStock,
  createStockMovement,
};
