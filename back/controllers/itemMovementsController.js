// ─── controllers/itemMovementsController.js ──────────────────────────────────
// حركات الأصناف — رصيد صحيح 100% مع running balance و pagination احترافي
//
// الخوارزمية:
//   1. نحسب openingBalance  = مجموع الحركات قبل startDate (لو في فلتر)
//   2. نجيب حركات الفترة    مرتبة ASC مع pagination
//   3. لكل صفحة > 1 نحسب   مجموع الصفحات السابقة لتصحيح نقطة البداية
//   4. نحسب running balance  لكل حركة في الصفحة بـ Decimal.js (تجنب 1.11e-16)
//   5. نرجع إجماليات الفترة الكاملة (مش الصفحة بس)
//
// مُحسَّن لـ 100K+ صنف: aggregate SQL بدل findMany للحسابات

const prisma      = require('../config/db');
const { safeNum } = require('../utils/decimalHelper');
const { Decimal }  = require('decimal.js');

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

const MOV_PAGE_SIZE = 200;

// ── اختصار: تحويل BigInt الجاي من $queryRaw لـ Number ────────────────────────
const n = (v) => Number(v ?? 0);

// ── normalise Prisma row → plain JSON-safe object ─────────────────────────────
const norm = (x) => ({
  _id:         x.id,
  id:          x.id,
  itemId:      x.itemId,
  itemCode:    x.itemCode,
  itemName:    x.itemName,
  type:        x.type,
  quantityIn:  safeNum(x.quantityIn),
  quantityOut: safeNum(x.quantityOut),
  weightIn:    safeNum(x.weightIn),
  weightOut:   safeNum(x.weightOut),
  price:       safeNum(x.price),
  warehouse:   x.warehouse,
  reference:   x.reference   ?? null,
  referenceId: x.referenceId ?? null,
  seasonId:    x.seasonId    ?? null,
  season:      x.season      ?? null,
  createdBy:   x.createdBy   ?? null,
  date:        x.date,
  createdAt:   x.createdAt,
});

// ── حساب مجموع صفوف (من findMany) بـ Decimal.js لتجنب float drift ──────────
const sumRows = (rows) => {
  let qIn = new Decimal(0), qOut = new Decimal(0);
  let wIn = new Decimal(0), wOut = new Decimal(0);
  for (const r of rows) {
    qIn  = qIn.plus(new Decimal(safeNum(r.quantityIn)));
    qOut = qOut.plus(new Decimal(safeNum(r.quantityOut)));
    wIn  = wIn.plus(new Decimal(safeNum(r.weightIn)));
    wOut = wOut.plus(new Decimal(safeNum(r.weightOut)));
  }
  return {
    qIn:  parseFloat(qIn.toFixed(6)),
    qOut: parseFloat(qOut.toFixed(6)),
    wIn:  parseFloat(wIn.toFixed(6)),
    wOut: parseFloat(wOut.toFixed(6)),
  };
};

// ── GET /api/items/:itemId/movements ─────────────────────────────────────────
const getItemMovements = async (req, res) => {
  try {
    const { itemId }  = req.params;
    const { warehouse, startDate, endDate, page = 1, seasonId } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const skip    = (pageNum - 1) * MOV_PAGE_SIZE;

    // ── بناء where object للاستخدام مع Prisma ORM ──────────────────────────
    const baseWhere   = { itemId };
    if (warehouse) baseWhere.warehouse = warehouse;
    // ✅ FIX: فلتر بالموسم لو اتبعت
    if (seasonId) baseWhere.seasonId = seasonId;

    const periodWhere = { ...baseWhere };
    const dateFilter  = {};
    if (startDate) {
      const sd = new Date(startDate); sd.setHours(0, 0, 0, 0);
      dateFilter.gte = sd;
    }
    if (endDate) {
      const ed = new Date(endDate); ed.setHours(23, 59, 59, 999);
      dateFilter.lte = ed;
    }
    if (Object.keys(dateFilter).length) periodWhere.date = dateFilter;

    // ── 1. openingBalance = مجموع كل الحركات قبل startDate ─────────────────
    let openingQty = 0, openingWeight = 0;
    if (startDate) {
      const sd = new Date(startDate); sd.setHours(0, 0, 0, 0);
      const preWhere = { ...baseWhere, date: { lt: sd } };
      // aggregate مع groupBy محاكاة: نستخدم $queryRaw لأداء أفضل
      const [agg] = await prisma.stockMovement.groupBy({
        by:    ['itemId'],
        where: preWhere,
        _sum:  { quantityIn: true, quantityOut: true, weightIn: true, weightOut: true },
      });
      openingQty    = parseFloat(new Decimal(safeNum(agg?._sum?.quantityIn)).minus(new Decimal(safeNum(agg?._sum?.quantityOut))).toFixed(6));
      openingWeight = parseFloat(new Decimal(safeNum(agg?._sum?.weightIn)).minus(new Decimal(safeNum(agg?._sum?.weightOut))).toFixed(6));
      if (Math.abs(openingQty)    < 1e-9) openingQty    = 0;
      if (Math.abs(openingWeight) < 1e-9) openingWeight = 0;
    }

    // ── 2. total + صفحة الحركات (ASC) ──────────────────────────────────────
    const [total, movements] = await Promise.all([
      prisma.stockMovement.count({ where: periodWhere }),
      prisma.stockMovement.findMany({
        where:   periodWhere,
        include: {
          createdBy: { select: { name: true } },
          season:    { select: { name: true } },
        },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        skip,
        take: MOV_PAGE_SIZE,
      }),
    ]);

    // ── 3. رصيد الصفحات السابقة لو page > 1 ────────────────────────────────
    let pageOpeningQty    = openingQty;
    let pageOpeningWeight = openingWeight;

    if (pageNum > 1) {
      // aggregate الصفحات السابقة بدل findMany لتوفير الذاكرة
      const [prevAgg] = await prisma.stockMovement.groupBy({
        by:    ['itemId'],
        where: periodWhere,
        _sum:  { quantityIn: true, quantityOut: true, weightIn: true, weightOut: true },
        // Prisma groupBy مش بيدعم take/skip — نستخدم aggregate أخف
      });
      // لأن groupBy مش بيدعم pagination نعمل workaround بـ findMany select فقط
      const prevRows = await prisma.stockMovement.findMany({
        where:   periodWhere,
        select:  { quantityIn: true, quantityOut: true, weightIn: true, weightOut: true },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        take:    skip,
      });
      const p = sumRows(prevRows);
      const pOQ = parseFloat(new Decimal(pageOpeningQty).plus(new Decimal(p.qIn)).minus(new Decimal(p.qOut)).toFixed(6));
      const pOW = parseFloat(new Decimal(pageOpeningWeight).plus(new Decimal(p.wIn)).minus(new Decimal(p.wOut)).toFixed(6));
      pageOpeningQty    = Math.abs(pOQ) < 1e-9 ? 0 : pOQ;
      pageOpeningWeight = Math.abs(pOW) < 1e-9 ? 0 : pOW;
    }

    // ── 4. running balance لكل حركة في الصفحة ──────────────────────────────
    // نستخدم Decimal.js لتجنب تراكم أخطاء floating point (مثل 1.1102e-16 بدل صفر)
    const toD = (v) => new Decimal(isFinite(safeNum(v)) ? safeNum(v) : 0);
    const dp  = (d) => {
      const n = parseFloat(d.toFixed(6));
      return Math.abs(n) < 1e-9 ? 0 : n;   // تنظيف قيم أصغر من 1 نانو
    };

    let runQty    = toD(pageOpeningQty);
    let runWeight = toD(pageOpeningWeight);

    const normed = movements.map((m) => {
      runQty    = runQty.plus(toD(m.quantityIn)).minus(toD(m.quantityOut));
      runWeight = runWeight.plus(toD(m.weightIn)).minus(toD(m.weightOut));
      return { ...norm(m), runningQty: dp(runQty), runningWeight: dp(runWeight) };
    });

    // ── 5. إجماليات الفترة كاملة (aggregate) ───────────────────────────────
    const [periodAgg] = await prisma.stockMovement.groupBy({
      by:    ['itemId'],
      where: periodWhere,
      _sum:  { quantityIn: true, quantityOut: true, weightIn: true, weightOut: true },
    });

    res.json({
      movements: normed,
      total,
      page:       pageNum,
      pageSize:   MOV_PAGE_SIZE,
      hasMore:    skip + movements.length < total,
      // رصيد افتتاحي (قبل الفترة)
      openingQty,
      openingWeight,
      // إجماليات الفترة كلها
      periodTotals: {
        totalInQty:     safeNum(periodAgg?._sum?.quantityIn),
        totalOutQty:    safeNum(periodAgg?._sum?.quantityOut),
        totalInWeight:  safeNum(periodAgg?._sum?.weightIn),
        totalOutWeight: safeNum(periodAgg?._sum?.weightOut),
      },
    });
  } catch (err) {
    console.error('[getItemMovements]', err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getItemMovements };
