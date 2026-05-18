// ─── controllers/Cashregistercontroller.js ───────────────────────────────────
const prisma              = require('../config/db');
const { safeNum, round2, n } = require('../utils/decimalHelper');

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 100; // حجم الصفحة للـ lazy loading

// ── Helpers ───────────────────────────────────────────────────────────────────
const calcTotals = (movements) => {
  let totalIn = 0, totalOut = 0;
  for (const m of movements) {
    const amt = safeNum(m.amount);
    if (safeNum(m.direction) > 0) totalIn  = round2(totalIn  + amt);
    else                           totalOut = round2(totalOut + amt);
  }
  return { totalIn, totalOut, net: round2(totalIn - totalOut) };
};

const groupByMethod = (movements) => {
  const map = {};
  for (const m of movements) {
    const k   = m.paymentMethod || 'other';
    const amt = safeNum(m.amount);
    if (!map[k]) map[k] = { in: 0, out: 0 };
    if (safeNum(m.direction) > 0) map[k].in  = round2(map[k].in  + amt);
    else                           map[k].out = round2(map[k].out + amt);
  }
  return map;
};

const buildDateRange = (startDate, endDate) => {
  const q = {};
  if (startDate) q.gte = new Date(startDate);
  if (endDate)   q.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
  return Object.keys(q).length ? q : undefined;
};

// ── GET /cash-register/admins ─────────────────────────────────────────────────
const getAdmins = async (req, res) => {
  try {
    const admins = await prisma.user.findMany({
      where:   { role: 'admin', isActive: true },
      select:  { id: true, name: true, username: true, scope: true },
      orderBy: { name: 'asc' },
    });
    res.json(admins.map(a => ({ ...a, _id: a.id })));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET /cash-register/:adminId ───────────────────────────────────────────────
// يدعم pagination بـ cursor (cursor = آخر createdAt شُفناه)
// يرجع: { movements, totalIn, totalOut, net, count, nextCursor, hasMore }
const getAdminRegister = async (req, res) => {
  try {
    const { adminId }                          = req.params;
    const { startDate, endDate, type, cursor } = req.query;
    const take                                 = PAGE_SIZE + 1; // نجيب واحد زيادة لنعرف hasMore

    const where = { treasury: 'cash', userId: adminId };
    if (type) where.type = type;
    const dr = buildDateRange(startDate, endDate);
    if (dr)   where.date = dr;

    // cursor-based pagination باستخدام createdAt + id
    const cursorClause = cursor
      ? { cursor: { id: cursor }, skip: 1 }
      : {};

    // جلب الحركات مع pagination
    const movements = await prisma.treasuryEntry.findMany({
      where,
      include: { user: { select: { name: true, username: true } } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take,
      ...cursorClause,
    });

    const hasMore    = movements.length > PAGE_SIZE;
    const page       = hasMore ? movements.slice(0, PAGE_SIZE) : movements;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    // الإجماليات: لو في cursor (صفحة تانية) نحسبها من الكل
    // لو أول صفحة نحسب aggregate من DB مباشرة — أسرع بكتير
    let totalIn = 0, totalOut = 0;

    if (!cursor) {
      // aggregate query — بيشتغل على الـ index بكفاءة عالية
      const [inAgg, outAgg] = await Promise.all([
        prisma.treasuryEntry.aggregate({
          where: { ...where, direction: 1 },
          _sum:  { amount: true },
        }),
        prisma.treasuryEntry.aggregate({
          where: { ...where, direction: -1 },
          _sum:  { amount: true },
        }),
      ]);
      totalIn  = round2(safeNum(inAgg._sum.amount));
      totalOut = round2(safeNum(outAgg._sum.amount));
    }

    res.json({
      movements:  page.map(n),
      totalIn,
      totalOut,
      net:        round2(totalIn - totalOut),
      count:      await prisma.treasuryEntry.count({ where }),
      nextCursor,
      hasMore,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET /cash-register/bank ───────────────────────────────────────────────────
const getBankRegister = async (req, res) => {
  try {
    const { startDate, endDate, type, paymentMethod, cursor } = req.query;
    const take = PAGE_SIZE + 1;

    const where = { treasury: 'bank' };
    if (type)          where.type          = type;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    const dr = buildDateRange(startDate, endDate);
    if (dr)   where.date = dr;

    const cursorClause = cursor
      ? { cursor: { id: cursor }, skip: 1 }
      : {};

    const movements = await prisma.treasuryEntry.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take,
      ...cursorClause,
    });

    const hasMore    = movements.length > PAGE_SIZE;
    const page       = hasMore ? movements.slice(0, PAGE_SIZE) : movements;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    // aggregate للإجماليات فقط عند أول صفحة
    let totalIn = 0, totalOut = 0, byMethod = {};

    if (!cursor) {
      const [inAgg, outAgg, allForMethod] = await Promise.all([
        prisma.treasuryEntry.aggregate({
          where: { ...where, direction: 1 },
          _sum:  { amount: true },
        }),
        prisma.treasuryEntry.aggregate({
          where: { ...where, direction: -1 },
          _sum:  { amount: true },
        }),
        // groupBy لـ byMethod — Prisma يعملها في DB مباشرة
        prisma.treasuryEntry.groupBy({
          by:     ['paymentMethod', 'direction'],
          where,
          _sum:   { amount: true },
        }),
      ]);
      totalIn  = round2(safeNum(inAgg._sum.amount));
      totalOut = round2(safeNum(outAgg._sum.amount));

      for (const row of allForMethod) {
        const k = row.paymentMethod || 'other';
        if (!byMethod[k]) byMethod[k] = { in: 0, out: 0 };
        if (row.direction > 0) byMethod[k].in  = round2(byMethod[k].in  + safeNum(row._sum.amount));
        else                   byMethod[k].out = round2(byMethod[k].out + safeNum(row._sum.amount));
      }
    }

    res.json({
      movements:  page.map(n),
      totalIn,
      totalOut,
      net:        round2(totalIn - totalOut),
      byMethod,
      count:      await prisma.treasuryEntry.count({ where }),
      nextCursor,
      hasMore,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET /cash-register/summary ────────────────────────────────────────────────
const getDailySummary = async (req, res) => {
  try {
    const targetDate = req.query.date ? new Date(req.query.date) : new Date();
    const start = new Date(targetDate); start.setHours(0,  0,  0,   0);
    const end   = new Date(targetDate); end.setHours(23, 59, 59, 999);

    const [adminMovements, bankMovements] = await Promise.all([
      prisma.treasuryEntry.findMany({
        where:   { treasury: 'cash', date: { gte: start, lte: end } },
        include: { user: { select: { name: true, username: true } } },
        orderBy: [{ date: 'asc' }],
      }),
      prisma.treasuryEntry.findMany({
        where:   { treasury: 'bank', date: { gte: start, lte: end } },
        select:  { id: true, amount: true, direction: true, paymentMethod: true },
        orderBy: [{ date: 'asc' }],
      }),
    ]);

    // تجميع حسب الأدمن
    const byAdmin = {};
    for (const m of adminMovements) {
      const id  = m.userId;
      const amt = safeNum(m.amount);
      if (!id) continue;
      if (!byAdmin[id]) {
        byAdmin[id] = {
          admin:        m.user ? { ...m.user, _id: m.userId } : null,
          net:          0,
          totalIn:      0,
          totalOut:     0,
          saleCash:     0,
          paymentCash:  0,
          returnCash:   0,
          count:        0,
        };
      }
      const a   = byAdmin[id];
      const dir = safeNum(m.direction);
      a.count++;

      if (dir > 0) {
        a.totalIn    = round2(a.totalIn    + amt);
        if (m.type === 'sale_cash')                                   a.saleCash    = round2(a.saleCash    + amt);
        if (m.type === 'payment_cash' || m.type === 'payment_in_cash') a.paymentCash = round2(a.paymentCash + amt);
      } else {
        a.totalOut   = round2(a.totalOut   + amt);
        // المرتجعات النقدية — يشمل كلا النوعين
        if (m.type === 'return_cash' || m.type === 'return_in_cash')   a.returnCash  = round2(a.returnCash  + amt);
      }
      a.net = round2(a.totalIn - a.totalOut);
    }

    // بنك
    let bankIn = 0, bankOut = 0;
    const bankByMethod = {};
    for (const m of bankMovements) {
      const k   = m.paymentMethod || 'other';
      const amt = safeNum(m.amount);
      if (!bankByMethod[k]) bankByMethod[k] = { in: 0, out: 0 };
      if (safeNum(m.direction) > 0) {
        bankIn             = round2(bankIn             + amt);
        bankByMethod[k].in = round2(bankByMethod[k].in + amt);
      } else {
        bankOut              = round2(bankOut              + amt);
        bankByMethod[k].out  = round2(bankByMethod[k].out  + amt);
      }
    }

    const allIn = [...adminMovements, ...bankMovements]
      .filter(m => safeNum(m.direction) > 0)
      .reduce((s, m) => round2(s + safeNum(m.amount)), 0);

    res.json({
      date:       targetDate,
      admins:     Object.values(byAdmin),
      adminTotal: round2(Object.values(byAdmin).reduce((s, a) => s + a.net, 0)),
      bank:       { totalIn: bankIn, totalOut: bankOut, net: round2(bankIn - bankOut), byMethod: bankByMethod, count: bankMovements.length },
      grandTotal: allIn,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getAdmins, getAdminRegister, getBankRegister, getDailySummary };
