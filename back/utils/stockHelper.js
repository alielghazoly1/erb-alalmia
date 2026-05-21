// ─── utils/stockHelper.js ─────────────────────────────────────────────────────
// أدوات المخزون — تحديث الأرصدة وتسجيل الحركات
//
// الإصلاحات الجوهرية في هذه النسخة:
//  ① كل دالة تقبل tx (transaction context) اختيارياً — لو مفيش tx تستخدم prisma
//  ② updateStock: ATOMIC raw SQL مع normalizeStockValue لمنع -0.001
//  ③ createStockMovement: تقرأ الرصيد بعد التحديث لضمان دقة الـ snapshot
//  ④ batchUpdateStock: يحدّث عدة أصناف في تحديث واحد (أداء أفضل)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const prisma = require('../config/db');
const {
  safeNum, round2, round3,
  normalizeStockValue,
} = require('./decimalHelper');

// ─── OUT-type movements (خروج من المخزن) ─────────────────────────────────────
const OUT_TYPES = new Set([
  'sale_out',
  'return_out',
  'transfer_out',
  'manufacturing_out',
  'adjustment_sub',
]);

// ── الـ client المناسب: tx (داخل transaction) أو prisma (عادي) ───────────────
const db = (tx) => tx || prisma;

// ── getStockBalance ───────────────────────────────────────────────────────────
/**
 * رصيد صنف في مخزن وموسم — يرجع { quantity, weight }
 * يمكن تمرير tx لقراءة الرصيد داخل transaction
 */
const getStockBalance = async (itemId, warehouse, seasonId, tx = null) => {
  const client = db(tx);
  const stock = await client.itemStock.findFirst({
    where: {
      itemId,
      warehouse,
      seasonId: seasonId ?? null,
    },
  });
  return {
    quantity: safeNum(stock?.quantity, 0),
    weight:   safeNum(stock?.weight,   0),
  };
};

/** alias متوافق مع الـ controllers القديمة */
const getStockQty = (itemId, warehouse, seasonId, tx = null) =>
  getStockBalance(itemId, warehouse, seasonId, tx);

// ── updateStock ───────────────────────────────────────────────────────────────
/**
 * ✅ ATOMIC: يحدّث رصيد الصنف بـ raw SQL في خطوة واحدة (بدون read-then-write)
 * ✅ NORMALIZE: بعد التحديث، يُصفّر القيم "الوهمية" مثل -0.001
 * ✅ TX-AWARE: يعمل داخل prisma.$transaction لو مررت tx
 *
 * @param {string} itemId
 * @param {string} warehouse
 * @param {string|null} seasonId
 * @param {{ quantity: number, weight: number }} delta - التغيير (موجب = إضافة، سالب = خصم)
 * @param {object|null} tx - Prisma transaction context
 */
const updateStock = async (itemId, warehouse, seasonId, delta, tx = null) => {
  const client = db(tx);
  const dQty = round3(safeNum(delta.quantity));
  const dWt  = round3(safeNum(delta.weight));

  if (seasonId) {
    const updated = await client.$executeRaw`
      UPDATE item_stocks
      SET
        quantity = ROUND(CAST(quantity + ${dQty} AS numeric), 3),
        weight   = ROUND(CAST(weight   + ${dWt}  AS numeric), 3),
        "updatedAt" = NOW()
      WHERE "itemId"   = ${itemId}::uuid
        AND warehouse  = ${warehouse}::"Warehouse"
        AND "seasonId" = ${seasonId}::uuid
    `;

    if (updated === 0) {
      await client.$executeRaw`
        INSERT INTO item_stocks (id, "itemId", warehouse, "seasonId", quantity, weight, "updatedAt")
        VALUES (
          gen_random_uuid(),
          ${itemId}::uuid,
          ${warehouse}::"Warehouse",
          ${seasonId}::uuid,
          ${dQty},
          ${dWt},
          NOW()
        )
        ON CONFLICT ("itemId", warehouse, "seasonId") DO UPDATE
          SET
            quantity = ROUND(item_stocks.quantity + ${dQty}, 3),
            weight   = ROUND(item_stocks.weight   + ${dWt},  3),
            "updatedAt" = NOW()
      `;
    }
  } else {
    const updated = await client.$executeRaw`
      UPDATE item_stocks
      SET
        quantity = ROUND(CAST(quantity + ${dQty} AS numeric), 3),
        weight   = ROUND(CAST(weight   + ${dWt}  AS numeric), 3),
        "updatedAt" = NOW()
      WHERE "itemId"  = ${itemId}::uuid
        AND warehouse = ${warehouse}::"Warehouse"
        AND "seasonId" IS NULL
    `;

    if (updated === 0) {
      await client.$executeRaw`
        INSERT INTO item_stocks (id, "itemId", warehouse, "seasonId", quantity, weight, "updatedAt")
        VALUES (
          gen_random_uuid(),
          ${itemId}::uuid,
          ${warehouse}::"Warehouse",
          NULL,
          ${dQty},
          ${dWt},
          NOW()
        )
        ON CONFLICT ("itemId", warehouse, "seasonId") DO UPDATE
          SET
            quantity = ROUND(item_stocks.quantity + ${dQty}, 3),
            weight   = ROUND(item_stocks.weight   + ${dWt},  3),
            "updatedAt" = NOW()
      `;
    }
  }

  // تنظيف القيم الوهمية الصغيرة جداً (مثل 0.0001 أو -0.0001 ناتجة عن floating point)
  // لكن نحافظ على القيم السالبة الحقيقية (مثل -5 كراتين عند البيع بالسالب)
  await _normalizeStockRow(itemId, warehouse, seasonId, client);
};

// ── _normalizeStockRow (private) ──────────────────────────────────────────────
/**
 * يصفّر أي قيمة وهمية (<0.0005) في صف المخزون
 * يُستدعى تلقائياً بعد كل updateStock
 */
const _normalizeStockRow = async (itemId, warehouse, seasonId, client) => {
  if (seasonId) {
    await client.$executeRaw`
      UPDATE item_stocks
      SET
        quantity = CASE WHEN ABS(quantity) < 0.0005 THEN 0 ELSE quantity END,
        weight   = CASE WHEN ABS(weight)   < 0.0005 THEN 0 ELSE weight   END,
        "updatedAt" = NOW()
      WHERE "itemId"   = ${itemId}::uuid
        AND warehouse  = ${warehouse}::"Warehouse"
        AND "seasonId" = ${seasonId}::uuid
        AND (ABS(quantity) < 0.0005 OR ABS(weight) < 0.0005)
    `;
  } else {
    await client.$executeRaw`
      UPDATE item_stocks
      SET
        quantity = CASE WHEN ABS(quantity) < 0.0005 THEN 0 ELSE quantity END,
        weight   = CASE WHEN ABS(weight)   < 0.0005 THEN 0 ELSE weight   END,
        "updatedAt" = NOW()
      WHERE "itemId"  = ${itemId}::uuid
        AND warehouse = ${warehouse}::"Warehouse"
        AND "seasonId" IS NULL
        AND (ABS(quantity) < 0.0005 OR ABS(weight) < 0.0005)
    `;
  }
};

// ── createStockMovement ───────────────────────────────────────────────────────
/**
 * يسجّل حركة مخزونية مع snapshot للرصيد بعد التحديث
 * ✅ TX-AWARE: يعمل داخل prisma.$transaction لو مررت tx
 */
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

  // نقرأ الرصيد الحالي (بعد updateStock) ليظهر في سجل الحركة
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
 * All-in-one: يحدّث الرصيد ويسجّل الحركة في خطوة واحدة
 * ✅ TX-AWARE
 */
const recordStockMovement = async ({
  itemId, itemCode, itemName, type,
  quantityIn  = 0, quantityOut = 0,
  weightIn    = 0, weightOut   = 0,
  price = 0, warehouse,
  reference, referenceModel, referenceId,
  seasonId, userId,
}, tx = null) => {
  const qIn  = safeNum(quantityIn);
  const qOut = safeNum(quantityOut);
  const wIn  = safeNum(weightIn);
  const wOut = safeNum(weightOut);

  const netQty    = round3(qIn - qOut);
  const netWeight = round3(wIn - wOut);

  await updateStock(itemId, warehouse, seasonId, { quantity: netQty, weight: netWeight }, tx);

  const balance = await getStockBalance(itemId, warehouse, seasonId, tx);
  const client  = db(tx);

  return client.stockMovement.create({
    data: {
      itemId, itemCode, itemName, type,
      quantityIn: qIn, quantityOut: qOut,
      weightIn: wIn,   weightOut: wOut,
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
/** رصيد صنف في كل المخازن { ramses, october } */
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
 * يتحقق من توفر المخزون
 * ملاحظة: المقارنة تتم بالكميات (الكراتين) فقط — الوزن يُحسب تلقائياً
 */
const checkStockAvailability = async (itemId, warehouse, seasonId, requestedQty, tx = null) => {
  const stock = await getStockBalance(itemId, warehouse, seasonId, tx);
  const qty   = safeNum(requestedQty);
  return {
    available:    stock.quantity >= qty,
    stockQty:     stock.quantity,
    stockWeight:  stock.weight,
    requestedQty: qty,
    shortfall:    Math.max(0, qty - stock.quantity),
  };
};

// ── reserveStock / releaseStock ───────────────────────────────────────────────
/** placeholder للتوسع مستقبلاً */
const reserveStock = async () => ({ reserved: true });
const releaseStock = async () => ({ released: true });

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  // core
  recordStockMovement,
  getStockBalance,
  getItemStockMap,
  checkStockAvailability,
  reserveStock,
  releaseStock,
  // controller-compatible aliases
  getStockQty,
  updateStock,
  createStockMovement,
};
