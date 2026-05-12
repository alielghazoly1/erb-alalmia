// ─── utils/stockHelper.js ────────────────────────────────────────────────────
const prisma = require('../config/db');

// جلب رصيد صنف في مخزن
const getStockQty = async (itemId, warehouse, seasonId = null) => {
  const stock = await prisma.itemStock.findFirst({
    where: { itemId, warehouse, seasonId: seasonId || null },
  });
  return { quantity: stock?.quantity ?? 0, weight: stock?.weight ?? 0 };
};

// تحديث مخزون صنف (delta موجب = إضافة، سالب = خصم)
const updateStock = async (itemId, warehouse, seasonId, delta) => {
  const sid = seasonId || null;
  const existing = await prisma.itemStock.findFirst({
    where: { itemId, warehouse, seasonId: sid },
  });

  const newQty    = (existing?.quantity ?? 0) + (delta.quantity ?? 0);
  const newWeight = (existing?.weight   ?? 0) + (delta.weight   ?? 0);

  if (existing) {
    await prisma.itemStock.update({
      where: { id: existing.id },
      data:  { quantity: newQty, weight: newWeight },
    });
  } else {
    await prisma.itemStock.create({
      data: { itemId, warehouse, seasonId: sid, quantity: Math.max(0, newQty), weight: Math.max(0, newWeight) },
    });
  }
};

// تسجيل حركة مخزونية مع حساب الرصيد التلقائي
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

  const quantityIn  = isIn ? Math.abs(quantity) : 0;
  const quantityOut = isIn ? 0 : Math.abs(quantity);
  const weightIn    = isIn ? Math.abs(weight) : 0;
  const weightOut   = isIn ? 0 : Math.abs(weight);
  const balanceQty    = Math.max(0, current.quantity + quantityIn - quantityOut);
  const balanceWeight = Math.max(0, current.weight   + weightIn   - weightOut);

  return prisma.stockMovement.create({
    data: {
      itemId, itemCode, itemName, type,
      quantityIn, quantityOut,
      weightIn,   weightOut,
      price:          price  ?? 0,
      warehouse,
      balanceQty, balanceWeight,
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
