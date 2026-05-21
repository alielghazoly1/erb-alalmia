// ─── controllers/itemMovementsController.js ──────────────────────────────────
// حركات الأصناف — رصيد صحيح 100% مع running balance و pagination احترافي
//
// الخوارزمية:
//   1. نحسب openingBalance  = مجموع الحركات قبل startDate (لو في فلتر)
//   2. نجيب حركات الفترة    مرتبة ASC مع pagination
//   3. لكل صفحة > 1 نحسب   مجموع الصفحات السابقة لتصحيح نقطة البداية
//   4. نحسب running balance  لكل حركة في الصفحة
//   5. نرجع إجماليات الفترة الكاملة (مش الصفحة بس)
//
// مُحسَّن لـ 100K+ صنف: aggregate SQL بدل findMany للحسابات

const prisma      = require('../config/db');
const { safeNum } = require('../utils/decimalHelper');

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

// ── حساب مجموع صفوف (من findMany) ────────────────────────────────────────────
const sumRows = (rows) => {
  let qIn = 0, qOut = 0, wIn = 0, wOut = 0;
  for (const r of rows) {
    qIn  += safeNum(r.quantityIn);
    qOut += safeNum(r.quantityOut);
    wIn  += safeNum(r.weightIn);
    wOut += safeNum(r.weightOut);
  }
  return { qIn, qOut, wIn, wOut };
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
      openingQty    = safeNum(agg?._sum?.quantityIn)  - safeNum(agg?._sum?.quantityOut);
      openingWeight = safeNum(agg?._sum?.weightIn)    - safeNum(agg?._sum?.weightOut);
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
      pageOpeningQty    += p.qIn - p.qOut;
      pageOpeningWeight += p.wIn - p.wOut;
    }

    // ── 4. running balance لكل حركة في الصفحة ──────────────────────────────
    let runQty    = pageOpeningQty;
    let runWeight = pageOpeningWeight;

    const normed = movements.map((m) => {
      runQty    += safeNum(m.quantityIn)  - safeNum(m.quantityOut);
      runWeight += safeNum(m.weightIn)    - safeNum(m.weightOut);
      return { ...norm(m), runningQty: runQty, runningWeight: runWeight };
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
