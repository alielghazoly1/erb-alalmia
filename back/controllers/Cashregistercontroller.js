// ─── controllers/Cashregistercontroller.js ───────────────────────────────────
// متوافق مع schema الجديدة:
//   - prisma.treasuryEntry (كان prisma.treasury)
//   - userId/userName بدل adminId/adminName
//   - direction field
const prisma = require('../config/db');

const calcTotals = (movements) => {
  let totalIn = 0, totalOut = 0;
  for (const m of movements) {
    if (m.direction > 0) totalIn  += m.amount;
    else                  totalOut += m.amount;
  }
  return { totalIn, totalOut, net: totalIn - totalOut };
};

const groupByMethod = (movements) => {
  const byMethod = {};
  for (const m of movements) {
    const k = m.paymentMethod || 'other';
    if (!byMethod[k]) byMethod[k] = { in: 0, out: 0 };
    if (m.direction > 0) byMethod[k].in  += m.amount;
    else                  byMethod[k].out += m.amount;
  }
  return byMethod;
};

const dateRange = (startDate, endDate) => {
  const q = {};
  if (startDate) q.gte = new Date(startDate);
  if (endDate)   q.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
  return Object.keys(q).length ? q : null;
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
const getAdminRegister = async (req, res) => {
  try {
    const { adminId } = req.params;
    const { startDate, endDate, type } = req.query;

    const where = { treasury: 'cash', userId: adminId };
    if (type) where.type = type;
    const dr = dateRange(startDate, endDate);
    if (dr) where.date = dr;

    const movements = await prisma.treasuryEntry.findMany({
      where,
      include: { user: { select: { name: true, username: true } } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    const { totalIn, totalOut, net } = calcTotals(movements);
    res.json({ movements: movements.map(n), totalIn, totalOut, net, count: movements.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET /cash-register/bank ───────────────────────────────────────────────────
const getBankRegister = async (req, res) => {
  try {
    const { startDate, endDate, type, paymentMethod } = req.query;

    const where = { treasury: 'bank' };
    if (type)          where.type          = type;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    const dr = dateRange(startDate, endDate);
    if (dr) where.date = dr;

    const movements = await prisma.treasuryEntry.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    const { totalIn, totalOut, net } = calcTotals(movements);
    res.json({ movements: movements.map(n), totalIn, totalOut, net, byMethod: groupByMethod(movements), count: movements.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET /cash-register/summary ────────────────────────────────────────────────
const getDailySummary = async (req, res) => {
  try {
    const targetDate = req.query.date ? new Date(req.query.date) : new Date();
    const start = new Date(targetDate); start.setHours(0, 0, 0, 0);
    const end   = new Date(targetDate); end.setHours(23, 59, 59, 999);

    const [adminMovements, bankMovements] = await Promise.all([
      prisma.treasuryEntry.findMany({
        where:   { treasury: 'cash', date: { gte: start, lte: end } },
        include: { user: { select: { name: true, username: true } } },
      }),
      prisma.treasuryEntry.findMany({
        where:  { treasury: 'bank', date: { gte: start, lte: end } },
        select: { id: true, amount: true, direction: true, paymentMethod: true },
      }),
    ]);

    // تجميع حسب الأدمن (userId)
    const byAdmin = {};
    for (const m of adminMovements) {
      const id = m.userId;
      if (!id) continue;
      if (!byAdmin[id]) {
        byAdmin[id] = { admin: m.user ? { ...m.user, _id: m.userId } : null, net: 0, totalIn: 0, totalOut: 0, saleCash: 0, paymentCash: 0, returnCash: 0, count: 0 };
      }
      const a = byAdmin[id];
      a.count++;
      if (m.direction > 0) {
        a.totalIn += m.amount;
        if (m.type === 'sale_cash')    a.saleCash    += m.amount;
        if (m.type === 'payment_cash') a.paymentCash += m.amount;
      } else {
        a.totalOut += m.amount;
        if (m.type === 'return_cash') a.returnCash += m.amount;
      }
      a.net = a.totalIn - a.totalOut;
    }

    let bankIn = 0, bankOut = 0;
    const bankByMethod = {};
    for (const m of bankMovements) {
      const k = m.paymentMethod || 'other';
      if (!bankByMethod[k]) bankByMethod[k] = { in: 0, out: 0 };
      if (m.direction > 0) { bankIn  += m.amount; bankByMethod[k].in  += m.amount; }
      else                  { bankOut += m.amount; bankByMethod[k].out += m.amount; }
    }

    const grandTotal = [...adminMovements, ...bankMovements].filter(m => m.direction > 0).reduce((s, m) => s + m.amount, 0);

    res.json({
      date: targetDate,
      admins: Object.values(byAdmin),
      adminTotal: Object.values(byAdmin).reduce((s, a) => s + a.net, 0),
      bank: { totalIn: bankIn, totalOut: bankOut, net: bankIn - bankOut, byMethod: bankByMethod, count: bankMovements.length },
      grandTotal,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const n = (x) => ({ ...x, _id: x.id });

module.exports = { getAdmins, getAdminRegister, getBankRegister, getDailySummary };
