// ─── utils/stockHelper.js ────────────────────────────────────────────────────
const prisma = require('../config/db');

// جلب رصيد صنف في مخزن
const getStockQty = async (itemId, warehouse, seasonId = null) => {
  const stock = await prisma.itemStock.findFirst({
    where: { itemId, warehouse, seasonId: seasonId || null },
  });
  return { quantity: stock?.quantity ?? 0, weight: stock?.weight ?? 0 };
};

// تأمين القيم ضد NaN/null
const safeNum = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };

// تحديث مخزون صنف (delta موجب = إضافة، سالب = خصم)
// ✅ FIX: رفع Math.max(0) — المخزون يُسمح له بالسالب
const updateStock = async (itemId, warehouse, seasonId, delta) => {
  const sid = seasonId || null;
  const existing = await prisma.itemStock.findFirst({
    where: { itemId, warehouse, seasonId: sid },
  });

  const newQty    = safeNum(existing?.quantity) + safeNum(delta.quantity);
  const newWeight = safeNum(existing?.weight)   + safeNum(delta.weight);

  if (existing) {
    await prisma.itemStock.update({
      where: { id: existing.id },
      data:  { quantity: newQty, weight: newWeight },
    });
  } else {
    await prisma.itemStock.create({
      data: { itemId, warehouse, seasonId: sid, quantity: newQty, weight: newWeight },
    });
  }
};

// تسجيل حركة مخزونية مع حساب الرصيد التلقائي
// ✅ FIX: safeNum على كل القيم لتفادي NaN في DB
const createStockMovement = async ({
  itemId, itemCode, itemName, type,
  quantity, weight, price,
  warehouse, seasonId,
  reference, referenceModel, referenceId,
  createdById, date,
}) => {
  const current = await getStockQty(itemId, warehouse, seasonId);

  const INS = ['purchase_in', 'return_in', 'transfer_in', 'manufacturing_out', 'adjustment_add', 'opening_stock'];
  const isIn = INS.includes(type);

  const absQty = Math.abs(safeNum(quantity));
  const absWgt = Math.abs(safeNum(weight));

  const quantityIn  = isIn ? absQty : 0;
  const quantityOut = isIn ? 0      : absQty;
  const weightIn    = isIn ? absWgt : 0;
  const weightOut   = isIn ? 0      : absWgt;

  // ✅ الرصيد يُسمح بالسالب — بدون Math.max(0,...)
  const balanceQty    = safeNum(current.quantity) + quantityIn - quantityOut;
  const balanceWeight = safeNum(current.weight)   + weightIn   - weightOut;

  return prisma.stockMovement.create({
    data: {
      itemId, itemCode, itemName, type,
      quantityIn, quantityOut,
      weightIn,   weightOut,
      price:          safeNum(price),
      warehouse,
      balanceQty,  balanceWeight,
      reference:      reference      ?? null,
      referenceModel: referenceModel ?? null,
      referenceId:    referenceId    ?? null,
      seasonId:       seasonId       ?? null,
      createdById,
      date: date ? new Date(date) : new Date(),
    },
  });
};

module.exports = { getStockQty, updateStock, createStockMovement };
