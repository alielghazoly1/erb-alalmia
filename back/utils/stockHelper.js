// ─── utils/stockHelper.js ────────────────────────────────────────────────────
// أدوات المخزون — تسجيل الحركات وتحديث الأرصدة
// ✅ UPDATED: All qty/weight fields use Decimal-safe operations
// ─────────────────────────────────────────────────────────────────────────────

const prisma = require('../config/db');
const { safeNum, round2, round3, n, decimalAdd, decimalSub } = require('./decimalHelper');

// ── recordStockMovement — تسجيل حركة مخزونية ──────────────────────────────────
const recordStockMovement = async ({
  itemId, itemCode, itemName, type,
  quantityIn = 0, quantityOut = 0,
  weightIn = 0, weightOut = 0,
  price = 0, warehouse,
  reference, referenceModel, referenceId,
  seasonId, userId,
}) => {
  // ✅ Decimal-safe: normalize all inputs
  const qIn = safeNum(quantityIn);
  const qOut = safeNum(quantityOut);
  const wIn = safeNum(weightIn);
  const wOut = safeNum(weightOut);
  const netQty = round3(qIn - qOut);
  const netWeight = round3(wIn - wOut);

  // ── Get current balance ─────────────────────────────────────────────────────
  const stock = await prisma.itemStock.findFirst({
    where: { itemId, warehouse, seasonId },
  });

  const currentQty = safeNum(stock?.quantity, 0);
  const currentWeight = safeNum(stock?.weight, 0);
  const newQty = round3(currentQty + netQty);
  const newWeight = round3(currentWeight + netWeight);

  // ── Upsert stock record ─────────────────────────────────────────────────────
  await prisma.itemStock.upsert({
    where: { itemId_warehouse_seasonId: { itemId, warehouse, seasonId } },
    update: { quantity: newQty, weight: newWeight },
    create: {
      itemId, warehouse, seasonId,
      quantity: newQty,
      weight: newWeight,
    },
  });

  // ── Record movement ─────────────────────────────────────────────────────────
  return prisma.stockMovement.create({
    data: {
      itemId,
      itemCode,
      itemName,
      type,
      quantityIn: qIn,
      quantityOut: qOut,
      weightIn: wIn,
      weightOut: wOut,
      price: round2(price),
      warehouse,
      balanceQty: newQty,
      balanceWeight: newWeight,
      reference,
      referenceModel,
      referenceId,
      seasonId,
      createdById: userId,
    },
  });
};

// ── getStockBalance — رصيد صنف في مخزن ──────────────────────────────────────
const getStockBalance = async (itemId, warehouse, seasonId) => {
  const stock = await prisma.itemStock.findFirst({
    where: { itemId, warehouse, seasonId },
  });
  return {
    quantity: safeNum(stock?.quantity, 0),
    weight: safeNum(stock?.weight, 0),
  };
};

// ── getItemStockMap — رصيد صنف في كل المخازن ──────────────────────────────────
const getItemStockMap = async (itemId, seasonId) => {
  const stocks = await prisma.itemStock.findMany({
    where: { itemId, seasonId },
  });
  const map = { ramses: { quantity: 0, weight: 0 }, october: { quantity: 0, weight: 0 } };
  for (const s of stocks) {
    if (map[s.warehouse]) {
      map[s.warehouse].quantity = safeNum(s.quantity, 0);
      map[s.warehouse].weight = safeNum(s.weight, 0);
    }
  }
  return map;
};

// ── checkStockAvailability — التحقق من توفر المخزون ───────────────────────────
const checkStockAvailability = async (itemId, warehouse, seasonId, requestedQty, requestedWeight) => {
  const stock = await getStockBalance(itemId, warehouse, seasonId);
  const qty = safeNum(requestedQty);
  const weight = safeNum(requestedWeight);
  return {
    available: stock.quantity >= qty && stock.weight >= weight,
    stockQty: stock.quantity,
    stockWeight: stock.weight,
    requestedQty: qty,
    requestedWeight: weight,
    shortfallQty: Math.max(0, qty - stock.quantity),
    shortfallWeight: Math.max(0, weight - stock.weight),
  };
};

// ── reserveStock — حجز مخزون (للطلبات المعلقة) ──────────────────────────────────
const reserveStock = async (itemId, warehouse, seasonId, qty, weight) => {
  // Implementation depends on your reservation logic
  // This is a placeholder for future expansion
  return { reserved: true };
};

// ── releaseStock — إلغاء حجز ────────────────────────────────────────────────────
const releaseStock = async (itemId, warehouse, seasonId, qty, weight) => {
  return { released: true };
};

module.exports = {
  recordStockMovement,
  getStockBalance,
  getItemStockMap,
  checkStockAvailability,
  reserveStock,
  releaseStock,
};
