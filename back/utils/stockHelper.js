// ─── utils/stockHelper.js ─────────────────────────────────────────────────────
// أدوات المخزون — تسجيل الحركات وتحديث الأرصدة
// ✅ FIXED: Race Condition — updateStock الآن atomic باستخدام raw SQL
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const prisma                        = require('../config/db');
const { safeNum, round2, round3 }   = require('./decimalHelper');

// ─── OUT-type movements (خروج من المخزن) ─────────────────────────────────────
const OUT_TYPES = new Set([
  'sale_out',
  'return_out',
  'transfer_out',
  'manufacturing_out',
  'adjustment_sub',
]);

// ── getStockBalance ───────────────────────────────────────────────────────────
/** رصيد صنف في مخزن وموسم — يرجع { quantity, weight } */
const getStockBalance = async (itemId, warehouse, seasonId) => {
  const stock = await prisma.itemStock.findFirst({
    where: { itemId, warehouse, seasonId },
  });
  return {
    quantity: safeNum(stock?.quantity, 0),
    weight:   safeNum(stock?.weight,   0),
  };
};

// ── getStockQty ───────────────────────────────────────────────────────────────
/** alias متوافق مع الـ controllers — نفس getStockBalance */
const getStockQty = (itemId, warehouse, seasonId) =>
  getStockBalance(itemId, warehouse, seasonId);

// ── updateStock ───────────────────────────────────────────────────────────────
/**
 * ✅ FIXED: Race Condition — يحدّث رصيد الصنف بشكل ATOMIC باستخدام raw SQL.
 * عمليات القراءة-ثم-الكتابة القديمة كانت تسبب lost update عند التزامن.
 * الحل: UPDATE atomic في خطوة واحدة، ثم INSERT إذا لم يوجد الصف.
 *
 * @param {string} itemId
 * @param {string} warehouse
 * @param {string|null} seasonId
 * @param {{ quantity: number, weight: number }} delta
 */
const updateStock = async (itemId, warehouse, seasonId, delta) => {
  const dQty = round3(safeNum(delta.quantity));
  const dWt  = round3(safeNum(delta.weight));

  if (seasonId) {
    // محاولة UPDATE atomic أولاً — explicit ::uuid cast عشان Prisma بيبعت text
    const updated = await prisma.$executeRaw`
      UPDATE item_stocks
      SET quantity = ROUND(CAST(quantity + ${dQty} AS numeric), 3),
          weight   = ROUND(CAST(weight   + ${dWt}  AS numeric), 3),
          "updatedAt" = NOW()
      WHERE "itemId"   = ${itemId}::uuid
        AND warehouse  = ${warehouse}::"Warehouse"
        AND "seasonId" = ${seasonId}::uuid
    `;

    // لو الصف مش موجود نعمل INSERT
    if (updated === 0) {
      await prisma.$executeRaw`
        INSERT INTO item_stocks (id, "itemId", warehouse, "seasonId", quantity, weight, "updatedAt")
        VALUES (gen_random_uuid(), ${itemId}::uuid, ${warehouse}::"Warehouse", ${seasonId}::uuid,
                ${Math.max(0, dQty)}, ${Math.max(0, dWt)}, NOW())
        ON CONFLICT ("itemId", warehouse, "seasonId") DO UPDATE
          SET quantity = item_stocks.quantity + ${dQty},
              weight   = item_stocks.weight   + ${dWt},
              "updatedAt" = NOW()
      `;
    }
  } else {
    // بدون seasonId — نستخدم نفس الطريقة لكن مع IS NULL
    const updated = await prisma.$executeRaw`
      UPDATE item_stocks
      SET quantity = ROUND(CAST(quantity + ${dQty} AS numeric), 3),
          weight   = ROUND(CAST(weight   + ${dWt}  AS numeric), 3),
          "updatedAt" = NOW()
      WHERE "itemId"  = ${itemId}::uuid
        AND warehouse = ${warehouse}::"Warehouse"
        AND "seasonId" IS NULL
    `;

    if (updated === 0) {
      await prisma.$executeRaw`
        INSERT INTO item_stocks (id, "itemId", warehouse, "seasonId", quantity, weight, "updatedAt")
        VALUES (gen_random_uuid(), ${itemId}::uuid, ${warehouse}::"Warehouse", NULL,
                ${Math.max(0, dQty)}, ${Math.max(0, dWt)}, NOW())
        ON CONFLICT ("itemId", warehouse, "seasonId") DO UPDATE
          SET quantity = item_stocks.quantity + ${dQty},
              weight   = item_stocks.weight   + ${dWt},
              "updatedAt" = NOW()
      `;
    }
  }
};

// ── createStockMovement ───────────────────────────────────────────────────────
/**
 * يسجّل حركة مخزونية — يُستخدم بعد updateStock مباشرةً.
 * يقرأ الرصيد الجديد من DB ليضعه في balanceQty / balanceWeight.
 */
const createStockMovement = async ({
  itemId, itemCode, itemName, type,
  quantity, weight, price = 0,
  warehouse, reference, referenceModel, referenceId,
  seasonId, createdById, date,
}) => {
  const qty   = safeNum(quantity);
  const wt    = safeNum(weight);
  const isOut = OUT_TYPES.has(type);

  // نقرأ الرصيد الحالي (بعد updateStock) ليظهر في سجل الحركة
  const balance = await getStockBalance(itemId, warehouse, seasonId);

  return prisma.stockMovement.create({
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
      seasonId,
      createdById,
      date: date ? new Date(date) : new Date(),
    },
  });
};

// ── recordStockMovement ───────────────────────────────────────────────────────
/**
 * All-in-one: يحدّث الرصيد ويسجّل الحركة في خطوة واحدة.
 * يُستخدم عند الإنشاء المباشر (مثل stock adjustment).
 */
const recordStockMovement = async ({
  itemId, itemCode, itemName, type,
  quantityIn  = 0, quantityOut = 0,
  weightIn    = 0, weightOut   = 0,
  price = 0, warehouse,
  reference, referenceModel, referenceId,
  seasonId, userId,
}) => {
  const qIn      = safeNum(quantityIn);
  const qOut     = safeNum(quantityOut);
  const wIn      = safeNum(weightIn);
  const wOut     = safeNum(weightOut);
  const netQty   = round3(qIn - qOut);
  const netWeight= round3(wIn - wOut);

  // ✅ Atomic update بدل read-then-write
  await updateStock(itemId, warehouse, seasonId, { quantity: netQty, weight: netWeight });

  const balance = await getStockBalance(itemId, warehouse, seasonId);

  return prisma.stockMovement.create({
    data: {
      itemId, itemCode, itemName, type,
      quantityIn: qIn, quantityOut: qOut,
      weightIn: wIn,   weightOut: wOut,
      price: round2(price),
      warehouse,
      balanceQty: balance.quantity, balanceWeight: balance.weight,
      reference, referenceModel, referenceId,
      seasonId,
      createdById: userId,
    },
  });
};

// ── getItemStockMap ───────────────────────────────────────────────────────────
/** رصيد صنف في كل المخازن { ramses, october } */
const getItemStockMap = async (itemId, seasonId) => {
  const stocks = await prisma.itemStock.findMany({ where: { itemId, seasonId } });
  const map = {
    ramses:  { quantity: 0, weight: 0 },
    october: { quantity: 0, weight: 0 },
  };
  for (const s of stocks) {
    if (map[s.warehouse]) {
      map[s.warehouse].quantity = safeNum(s.quantity, 0);
      map[s.warehouse].weight   = safeNum(s.weight,   0);
    }
  }
  return map;
};

// ── checkStockAvailability ────────────────────────────────────────────────────
const checkStockAvailability = async (itemId, warehouse, seasonId, requestedQty, requestedWeight) => {
  const stock  = await getStockBalance(itemId, warehouse, seasonId);
  const qty    = safeNum(requestedQty);
  const weight = safeNum(requestedWeight);
  return {
    available:       stock.quantity >= qty && stock.weight >= weight,
    stockQty:        stock.quantity,
    stockWeight:     stock.weight,
    requestedQty:    qty,
    requestedWeight: weight,
    shortfallQty:    Math.max(0, qty    - stock.quantity),
    shortfallWeight: Math.max(0, weight - stock.weight),
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
