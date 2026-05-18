// ─── controllers/customerController.js ───────────────────────────────────────
'use strict';

const prisma          = require('../config/db');
const { audit }       = require('../utils/auditHelper');
const { safeNum, round2, n } = require('../utils/decimalHelper');

// ── helpers ───────────────────────────────────────────────────────────────────
const CUSTOMER_SELECT = {
  id: true, code: true, name: true, phone: true,
  type: true, openingBalance: true, address: true,
};

const pickCustomer = (body) => {
  const keys = ['name','code','phone','address','type','isActive','notes'];
  return Object.fromEntries(keys.filter(k => body[k] !== undefined).map(k => [k, body[k]]));
};

/** جلب رصيد أول المدة للعميل في موسم معين — يرجع 0 لو مش موجود */
const getSeasonOpeningBalance = async (customerId, seasonId) => {
  if (!seasonId) return 0;
  const rec = await prisma.customerSeasonBalance.findUnique({
    where: { customerId_seasonId: { customerId, seasonId } },
    select: { openingBalance: true },
  });
  return round2(safeNum(rec?.openingBalance));
};

/** upsert رصيد أول المدة في موسم */
const upsertSeasonBalance = async (customerId, seasonId, amount, userId) => {
  await prisma.customerSeasonBalance.upsert({
    where:  { customerId_seasonId: { customerId, seasonId } },
    update: { openingBalance: amount, updatedById: userId },
    create: { customerId, seasonId, openingBalance: amount, updatedById: userId },
  });
};

// ── GET /api/customers ────────────────────────────────────────────────────────
const getCustomers = async (req, res) => {
  try {
    const { search, seasonId } = req.query;

    const where = { isActive: true, deletedAt: null };
    if (search?.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { code: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      select: CUSTOMER_SELECT,
      orderBy: { code: 'asc' },
    });

    if (!customers.length) return res.json([]);

    const ids = customers.map(c => c.id);

    // totals — كلها في موسم معين أو كل المواسم
    const seasonFilter = seasonId ? { seasonId } : {};
    const [salesAgg, returnsAgg, paymentsAgg, seasonBalances] = await Promise.all([
      prisma.saleInvoice.groupBy({
        by: ['customerId'],
        where: { customerId: { in: ids }, status: { in: ['approved','pending'] }, deletedAt: null, ...seasonFilter },
        _sum: { totalAmount: true },
      }),
      prisma.returnInvoice.groupBy({
        by: ['customerId'],
        where: { customerId: { in: ids }, type: 'customer_return', status: 'approved', ...seasonFilter },
        _sum: { totalAmount: true },
      }),
      prisma.payment.groupBy({
        by: ['customerId'],
        where: { customerId: { in: ids }, type: 'customer_payment', ...seasonFilter },
        _sum: { amount: true },
      }),
      // رصيد أول المدة في الموسم المحدد
      seasonId
        ? prisma.customerSeasonBalance.findMany({
            where: { customerId: { in: ids }, seasonId },
            select: { customerId: true, openingBalance: true },
          })
        : Promise.resolve([]),
    ]);

    const salesMap    = new Map(salesAgg.map(r    => [r.customerId, safeNum(r._sum.totalAmount)]));
    const returnsMap  = new Map(returnsAgg.map(r  => [r.customerId, safeNum(r._sum.totalAmount)]));
    const paymentsMap = new Map(paymentsAgg.map(r => [r.customerId, safeNum(r._sum.amount)]));
    const openingMap  = new Map(seasonBalances.map(r => [r.customerId, round2(safeNum(r.openingBalance))]));

    const result = customers.map(c => {
      const totalSales   = salesMap.get(c.id)    ?? 0;
      const totalReturns = returnsMap.get(c.id)  ?? 0;
      const totalPaid    = paymentsMap.get(c.id) ?? 0;
      // الرصيد الابتدائي: لو في موسم → season balance، غير كده → customer.openingBalance
      const openingBal   = seasonId
        ? (openingMap.get(c.id) ?? 0)
        : round2(safeNum(c.openingBalance));
      const balance      = round2(openingBal + totalSales - totalReturns - totalPaid);
      return {
        ...n(c),
        openingBalance: openingBal,
        totalSales, totalReturns, totalPaid, balance,
      };
    });

    res.json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── POST /api/customers ───────────────────────────────────────────────────────
const createCustomer = async (req, res) => {
  try {
    const { openingBalance, initialBalance, ...body } = req.body;
    const exists = await prisma.customer.findUnique({ where: { code: body.code } });
    if (exists) return res.status(400).json({ message: 'كود العميل موجود بالفعل' });

    const customer = await prisma.customer.create({
      data: { ...pickCustomer(body), openingBalance: 0, createdById: req.user.id },
    });

    // لو في رصيد ابتدائي مع الإنشاء → ربطه بالموسم الحالي
    const ob = round2(safeNum(openingBalance ?? initialBalance));
    if (ob !== 0) {
      const season = await prisma.season.findFirst({ where: { isActive: true } });
      if (season) await upsertSeasonBalance(customer.id, season.id, ob, req.user.id);
    }

    await audit(req.user, 'customer_created', 'Customer', customer.id, customer.name, { code: customer.code });
    res.status(201).json(n(customer));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── PUT /api/customers/:id ────────────────────────────────────────────────────
const updateCustomer = async (req, res) => {
  try {
    const { openingBalance, ...body } = req.body;
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data:  pickCustomer(body),
    });
    await audit(req.user, 'customer_updated', 'Customer', customer.id, customer.name);
    res.json(n(customer));
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'العميل مش موجود' });
    res.status(500).json({ message: err.message });
  }
};

// ── PATCH /api/customers/:id/initial-balance ──────────────────────────────────
// يقبل { openingBalance, seasonId } — seasonId مطلوب
const updateInitialBalance = async (req, res) => {
  try {
    const newAmount = round2(safeNum(req.body.openingBalance ?? req.body.initialBalance));
    const { seasonId } = req.body;

    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer) return res.status(404).json({ message: 'العميل مش موجود' });

    if (!seasonId) return res.status(400).json({ message: 'seasonId مطلوب' });

    await upsertSeasonBalance(customer.id, seasonId, newAmount, req.user.id);
    await audit(req.user, 'customer_updated', 'Customer', customer.id, customer.name, { newBalance: newAmount, seasonId });

    res.json({ message: 'تم تعديل الرصيد الابتدائي', openingBalance: newAmount, seasonId });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── DELETE /api/customers/:id ─────────────────────────────────────────────────
const deleteCustomer = async (req, res) => {
  try {
    await prisma.customer.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    res.json({ message: 'تم الحذف' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET /api/customers/:id/statement ─────────────────────────────────────────
const getCustomerStatement = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { seasonId, page = 1, pageSize = 200 } = req.query;

    const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: CUSTOMER_SELECT });
    if (!customer) return res.status(404).json({ message: 'العميل مش موجود' });

    const seasonFilter = seasonId ? { seasonId } : {};
    const invWhere = { customerId, deletedAt: null, status: { in: ['approved','pending'] }, ...seasonFilter };
    const retWhere = { customerId, type: 'customer_return', status: 'approved', ...seasonFilter };
    const payWhere = { customerId, type: 'customer_payment', ...seasonFilter };

    const [totalsAgg, openingBal] = await Promise.all([
      Promise.all([
        prisma.saleInvoice.aggregate({ where: invWhere, _sum: { totalAmount: true } }),
        prisma.returnInvoice.aggregate({ where: retWhere, _sum: { totalAmount: true } }),
        prisma.payment.aggregate({ where: payWhere, _sum: { amount: true } }),
        prisma.saleInvoice.count({ where: invWhere }),
        prisma.returnInvoice.count({ where: retWhere }),
        prisma.payment.count({ where: payWhere }),
      ]),
      getSeasonOpeningBalance(customerId, seasonId),
    ]);

    const [salesAgg, returnsAgg, paymentsAgg, invCount, retCount, payCount] = totalsAgg;
    const totalSales   = round2(safeNum(salesAgg._sum.totalAmount));
    const totalReturns = round2(safeNum(returnsAgg._sum.totalAmount));
    const totalPaid    = round2(safeNum(paymentsAgg._sum.amount));
    const trueBalance  = round2(openingBal + totalSales - totalReturns - totalPaid);

    // جلب الصفوف مرتبة بالتاريخ
    const skip  = (Number(page) - 1) * Number(pageSize);
    const take  = Number(pageSize);

    const [invoices, returns, payments] = await Promise.all([
      prisma.saleInvoice.findMany({
        where: invWhere, skip, take,
        select: { id: true, invoiceNumber: true, docNumber: true, date: true, totalAmount: true, status: true },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
      }),
      prisma.returnInvoice.findMany({
        where: retWhere, skip, take,
        select: { id: true, invoiceNumber: true, docNumber: true, date: true, totalAmount: true, status: true },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
      }),
      prisma.payment.findMany({
        where: payWhere, skip, take,
        select: { id: true, receiptNumber: true, date: true, amount: true, paymentMethod: true, notes: true },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
      }),
    ]);

    // بناء صفوف مرتبة مع running balance
    const allRows = [
      ...invoices.map(r => ({ ...r, rowType: 'invoice', amount: round2(safeNum(r.totalAmount)) })),
      ...returns.map(r  => ({ ...r, rowType: 'return',  amount: round2(safeNum(r.totalAmount)) })),
      ...payments.map(r => ({ ...r, rowType: 'payment', amount: round2(safeNum(r.amount)) })),
    ].sort((a, b) => new Date(a.date) - new Date(b.date) || a.id.localeCompare(b.id));

    let running = openingBal;
    const rows = allRows.map(r => {
      running = r.rowType === 'invoice'
        ? round2(running + r.amount)
        : round2(running - r.amount);
      return { ...r, _id: r.id, runningBalance: running };
    });

    // صف الرصيد الابتدائي في البداية لو موجود
    const openingRow = openingBal !== 0 ? [{
      _id: 'opening', id: 'opening', rowType: 'opening',
      amount: openingBal, runningBalance: openingBal,
      date: customer.createdAt, docNumber: 'رصيد ابتدائي',
    }] : [];

    const seasons = await prisma.season.findMany({ orderBy: { startDate: 'desc' } });

    res.json({
      customer:  { ...n(customer), openingBalance: openingBal },
      seasons:   seasons.map(n),
      totals:    { totalSales, totalReturns, totalPaid, openingBalance: openingBal, netSales: round2(totalSales - totalReturns), balance: trueBalance },
      counts:    { invoices: invCount, returns: retCount, payments: payCount, total: invCount + retCount + payCount },
      rows:      [...openingRow, ...rows],
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET /api/customers/:customerId/all-seasons ────────────────────────────────
const getCustomerAllSeasons = async (req, res) => {
  try {
    const { customerId } = req.params;
    const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: CUSTOMER_SELECT });
    if (!customer) return res.status(404).json({ message: 'العميل مش موجود' });

    const seasons = await prisma.season.findMany({ orderBy: { startDate: 'desc' } });
    const [seasonBalances, salesBySeason, returnsBySeason, paymentsBySeason] = await Promise.all([
      prisma.customerSeasonBalance.findMany({ where: { customerId }, select: { seasonId: true, openingBalance: true } }),
      prisma.saleInvoice.groupBy({ by: ['seasonId'], where: { customerId, deletedAt: null, status: { in: ['approved','pending'] } }, _sum: { totalAmount: true }, _count: { id: true } }),
      prisma.returnInvoice.groupBy({ by: ['seasonId'], where: { customerId, type: 'customer_return', status: 'approved' }, _sum: { totalAmount: true } }),
      prisma.payment.groupBy({ by: ['seasonId'], where: { customerId, type: 'customer_payment' }, _sum: { amount: true } }),
    ]);

    const openingMap   = new Map(seasonBalances.map(r  => [r.seasonId, round2(safeNum(r.openingBalance))]));
    const salesMap     = new Map(salesBySeason.map(r   => [r.seasonId, { total: round2(safeNum(r._sum.totalAmount)), count: r._count.id }]));
    const returnsMap   = new Map(returnsBySeason.map(r => [r.seasonId, round2(safeNum(r._sum.totalAmount))]));
    const paymentsMap  = new Map(paymentsBySeason.map(r=> [r.seasonId, round2(safeNum(r._sum.amount))]));

    const result = seasons.map(s => {
      const ob    = openingMap.get(s.id)   ?? 0;
      const ts    = salesMap.get(s.id)?.total ?? 0;
      const tc    = salesMap.get(s.id)?.count ?? 0;
      const tr    = returnsMap.get(s.id)  ?? 0;
      const tp    = paymentsMap.get(s.id) ?? 0;
      return {
        season: n(s), openingBalance: ob,
        totalSales: ts, totalReturns: tr, totalPaid: tp,
        balance: round2(ob + ts - tr - tp), invoiceCount: tc,
      };
    }).filter(s => s.totalSales > 0 || s.totalReturns > 0 || s.totalPaid > 0 || s.openingBalance !== 0);

    res.json({ customer: n(customer), seasons: result });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET /api/customers/:customerId/timeline ───────────────────────────────────
const getCustomerTimeline = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { seasonId, limit = 100, cursor } = req.query;

    const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: CUSTOMER_SELECT });
    if (!customer) return res.status(404).json({ message: 'العميل مش موجود' });

    const openingBal   = await getSeasonOpeningBalance(customerId, seasonId);
    const seasonFilter = seasonId ? { seasonId } : {};
    const invWhere     = { customerId, deletedAt: null, status: { in: ['approved','pending'] }, ...seasonFilter };
    const retWhere     = { customerId, type: 'customer_return', status: 'approved', ...seasonFilter };
    const payWhere     = { customerId, type: 'customer_payment', ...seasonFilter };

    const [invCount, retCount, payCount, invoices, returns, payments] = await Promise.all([
      prisma.saleInvoice.count({ where: invWhere }),
      prisma.returnInvoice.count({ where: retWhere }),
      prisma.payment.count({ where: payWhere }),
      prisma.saleInvoice.findMany({
        where: invWhere,
        select: { id: true, invoiceNumber: true, docNumber: true, date: true, totalAmount: true, status: true, createdAt: true },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
      }),
      prisma.returnInvoice.findMany({
        where: retWhere,
        select: { id: true, invoiceNumber: true, docNumber: true, date: true, totalAmount: true, status: true, createdAt: true },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
      }),
      prisma.payment.findMany({
        where: payWhere,
        select: { id: true, receiptNumber: true, date: true, amount: true, paymentMethod: true, notes: true, createdAt: true },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const totalRows = invCount + retCount + payCount;

    // دمج وترتيب كل الصفوف
    const allRows = [
      ...invoices.map(r => ({ ...r, rowType: 'invoice', amount: round2(safeNum(r.totalAmount)) })),
      ...returns.map(r  => ({ ...r, rowType: 'return',  amount: round2(safeNum(r.totalAmount)) })),
      ...payments.map(r => ({ ...r, rowType: 'payment', amount: round2(safeNum(r.amount)) })),
    ].sort((a, b) => new Date(a.date) - new Date(b.date) || a.id.localeCompare(b.id));

    // cursor-based pagination
    const cursorIdx  = cursor ? allRows.findIndex(r => r.id === cursor) + 1 : 0;
    const pageRows   = allRows.slice(cursorIdx, cursorIdx + Number(limit));
    const nextCursor = pageRows.length === Number(limit) ? pageRows[pageRows.length - 1].id : null;
    const hasMore    = nextCursor !== null;

    // running balance
    const runningBefore = cursor
      ? round2(parseFloat(req.query.runningBefore || '0'))
      : openingBal;

    let running = runningBefore;
    const rowsWithBalance = pageRows.map(r => {
      running = r.rowType === 'invoice'
        ? round2(running + r.amount)
        : round2(running - r.amount);
      return { ...r, _id: r.id, runningBalance: running };
    });

    // صف الرصيد الابتدائي في الصفحة الأولى
    const openingRow = (!cursor && openingBal !== 0) ? [{
      _id: 'opening', id: 'opening', rowType: 'opening',
      amount: openingBal, runningBalance: openingBal,
      date: customer.createdAt, docNumber: 'رصيد ابتدائي',
    }] : [];

    const totalSales   = round2(invoices.reduce((s, r)  => s + safeNum(r.totalAmount), 0));
    const totalReturns = round2(returns.reduce((s, r)   => s + safeNum(r.totalAmount), 0));
    const totalPaid    = round2(payments.reduce((s, r)  => s + safeNum(r.amount), 0));
    const seasons      = await prisma.season.findMany({ orderBy: { startDate: 'desc' } });

    res.json({
      customer:     { ...n(customer), openingBalance: openingBal },
      seasons:      seasons.map(n),
      totals:       { totalSales, totalReturns, totalPaid, openingBalance: openingBal, netSales: round2(totalSales - totalReturns), balance: round2(openingBal + totalSales - totalReturns - totalPaid) },
      counts:       { invoices: invCount, returns: retCount, payments: payCount, total: totalRows },
      rows:         [...openingRow, ...rowsWithBalance],
      nextCursor,
      hasMore,
      runningAtEnd: running,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = {
  getCustomers, createCustomer, updateCustomer, deleteCustomer,
  updateInitialBalance, getCustomerStatement, getCustomerAllSeasons, getCustomerTimeline,
};
