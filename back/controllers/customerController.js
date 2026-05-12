// ─── controllers/customerController.js ───────────────────────────────────────
const prisma       = require('../config/db');
const { audit }    = require('../utils/auditHelper');
const { nextNumber } = require('../utils/counterHelper');

// ── GET /customers ────────────────────────────────────────────────────────────
const getCustomers = async (req, res) => {
  try {
    const result = await _fetchFromDB(req.query);
    return res.json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

async function _fetchFromDB({ search, type } = {}) {
  const where = { isActive: true };
  if (type)   where.type = type;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
    select: { id: true, code: true, name: true, phone: true, type: true, openingBalance: true, address: true },
    orderBy: { code: 'asc' },
  });
  if (customers.length === 0) return [];

  const ids = customers.map(c => c.id);

  const [salesAgg, returnsAgg, paymentsAgg] = await Promise.all([
    prisma.saleInvoice.groupBy({
      by: ['customerId'],
      where: { customerId: { in: ids }, status: { in: ['approved', 'pending'] } },
      _sum: { totalAmount: true },
    }),
    prisma.returnInvoice.groupBy({
      by: ['customerId'],
      where: { customerId: { in: ids }, type: 'customer_return', status: 'approved' },
      _sum: { totalAmount: true },
    }),
    prisma.payment.groupBy({
      by: ['customerId'],
      where: { customerId: { in: ids }, type: 'customer_payment' },
      _sum: { amount: true },
    }),
  ]);

  const salesMap    = new Map(salesAgg.map(r    => [r.customerId, r._sum.totalAmount || 0]));
  const returnsMap  = new Map(returnsAgg.map(r  => [r.customerId, r._sum.totalAmount || 0]));
  const paymentsMap = new Map(paymentsAgg.map(r => [r.customerId, r._sum.amount      || 0]));

  return customers.map(c => {
    const totalSales   = salesMap.get(c.id)    || 0;
    const totalReturns = returnsMap.get(c.id)  || 0;
    const totalPaid    = paymentsMap.get(c.id) || 0;
    return {
      ...c, _id: c.id,
      totalSales, totalReturns, totalPaid,
      balance: totalSales - totalReturns - totalPaid,
    };
  });
}

// ── CREATE ────────────────────────────────────────────────────────────────────
const createCustomer = async (req, res) => {
  try {
    const { openingBalance, ...customerData } = req.body;

    const exists = await prisma.customer.findUnique({ where: { code: customerData.code } });
    if (exists) return res.status(400).json({ message: 'كود العميل موجود بالفعل' });

    const customer = await prisma.customer.create({
      data: {
        ...pickCustomer(customerData),
        openingBalance: Number(openingBalance) || 0,
        createdById:    req.user.id,
      },
    });

    await audit(req.user, 'customer_created', 'Customer', customer.id, customer.name, { code: customer.code, type: customer.type, openingBalance });
    res.status(201).json(n(customer));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── UPDATE ────────────────────────────────────────────────────────────────────
const updateCustomer = async (req, res) => {
  try {
    const { openingBalance, ...updateData } = req.body;
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data:  pickCustomer(updateData),
    });
    await audit(req.user, 'customer_updated', 'Customer', customer.id, customer.name);
    res.json(n(customer));
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'العميل مش موجود' });
    res.status(500).json({ message: err.message });
  }
};

// ── UPDATE INITIAL BALANCE ────────────────────────────────────────────────────
const updateInitialBalance = async (req, res) => {
  try {
    const newAmount = Number(req.body.openingBalance);
    if (isNaN(newAmount) || newAmount < 0) return res.status(400).json({ message: 'المبلغ غير صحيح' });

    const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
    if (!customer) return res.status(404).json({ message: 'العميل مش موجود' });

    await prisma.customer.update({ where: { id: customer.id }, data: { openingBalance: newAmount } });
    await audit(req.user, 'initial_balance_updated', 'Customer', customer.id, customer.name, { newBalance: newAmount });
    res.json({ message: 'تم تعديل الرصيد الابتدائي', openingBalance: newAmount });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── DELETE ────────────────────────────────────────────────────────────────────
const deleteCustomer = async (req, res) => {
  try {
    await prisma.customer.update({ where: { id: req.params.id }, data: { isActive: false } });
    await audit(req.user, 'customer_deleted', 'Customer', req.params.id, '');
    res.json({ message: 'تم الحذف' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── STATEMENT ─────────────────────────────────────────────────────────────────
const getCustomerStatement = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { seasonId, page = 1, pageSize = 200, tab = 'all' } = req.query;

    const customer = await prisma.customer.findUnique({
      where:  { id: customerId },
      select: { id: true, code: true, name: true, phone: true, type: true, openingBalance: true, address: true },
    });
    if (!customer) return res.status(404).json({ message: 'العميل مش موجود' });

    const seasons      = await prisma.season.findMany({ orderBy: { startDate: 'desc' } });
    const targetSeason = seasonId
      ? seasons.find(s => s.id === seasonId)
      : seasons.find(s => s.isActive);

    const sf = targetSeason ? { seasonId: targetSeason.id } : {};
    const pg = Math.max(1, parseInt(page));
    const ps = Math.min(500, Math.max(50, parseInt(pageSize)));
    const skip = (pg - 1) * ps;

    const invSelect = { id: true, invoiceNumber: true, docNumber: true, date: true, createdAt: true, totalAmount: true, status: true };
    const retSelect = { id: true, invoiceNumber: true, docNumber: true, date: true, createdAt: true, totalAmount: true, status: true };
    const paySelect = { id: true, receiptNumber: true, date: true, createdAt: true, amount: true, paymentMethod: true, cashAmount: true, instapayAmount: true, notes: true, reference: true };

    const invWhere = { customerId, status: { in: ['approved', 'pending'] }, ...sf, deletedAt: null };
    const retWhere = { customerId, type: 'customer_return', status: 'approved', ...sf };
    const payWhere = { customerId, type: 'customer_payment', ...(targetSeason ? { seasonId: targetSeason.id } : {}) };

    const [totalsAgg, invCount, retCount, payCount] = await Promise.all([
      prisma.$transaction([
        prisma.saleInvoice.aggregate({ where: invWhere, _sum: { totalAmount: true } }),
        prisma.returnInvoice.aggregate({ where: retWhere, _sum: { totalAmount: true } }),
        prisma.payment.aggregate({ where: payWhere, _sum: { amount: true } }),
      ]),
      prisma.saleInvoice.count({ where: invWhere }),
      prisma.returnInvoice.count({ where: retWhere }),
      prisma.payment.count({ where: payWhere }),
    ]);

    const totalSales   = totalsAgg[0]._sum.totalAmount || 0;
    const totalReturns = totalsAgg[1]._sum.totalAmount || 0;
    const totalPaid    = totalsAgg[2]._sum.amount      || 0;

    const fetchInv = tab === 'all' || tab === 'invoices';
    const fetchRet = tab === 'all' || tab === 'returns';
    const fetchPay = tab === 'all' || tab === 'payments';

    const [invoices, returns_, payments] = await Promise.all([
      fetchInv ? prisma.saleInvoice.findMany({ where: invWhere, select: invSelect, orderBy: { date: 'asc' }, skip, take: ps }) : [],
      fetchRet ? prisma.returnInvoice.findMany({ where: retWhere, select: retSelect, orderBy: { date: 'asc' }, skip, take: ps }) : [],
      fetchPay ? prisma.payment.findMany({ where: payWhere, select: paySelect, orderBy: { date: 'asc' }, skip, take: ps }) : [],
    ]);

    res.json({
      customer: n(customer), season: targetSeason || null, seasons: seasons.map(n),
      invoices: invoices.map(n), returns: returns_.map(n), payments: payments.map(n),
      totalSales, totalReturns, totalPaid,
      netSales:     totalSales - totalReturns,
      balance:      totalSales - totalReturns - totalPaid,
      creditTotal:  totalSales,
      pagination: {
        page: pg, pageSize: ps,
        invTotal: invCount, retTotal: retCount, payTotal: payCount,
        invPages: Math.ceil(invCount / ps),
        retPages: Math.ceil(retCount / ps),
        payPages: Math.ceil(payCount / ps),
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── ALL SEASONS ───────────────────────────────────────────────────────────────
const getCustomerAllSeasons = async (req, res) => {
  try {
    const { customerId } = req.params;
    const seasons = await prisma.season.findMany({ orderBy: { startDate: 'desc' } });
    const seasonIds = seasons.map(s => s.id);

    const [salesRaw, returnsRaw, paymentsRaw] = await Promise.all([
      prisma.saleInvoice.groupBy({ by: ['seasonId'], where: { customerId, status: { in: ['approved', 'pending'] }, seasonId: { in: seasonIds }, deletedAt: null }, _sum: { totalAmount: true }, _count: { id: true } }),
      prisma.returnInvoice.groupBy({ by: ['seasonId'], where: { customerId, type: 'customer_return', status: 'approved', seasonId: { in: seasonIds } }, _sum: { totalAmount: true } }),
      prisma.payment.groupBy({ by: ['seasonId'], where: { customerId, type: 'customer_payment', seasonId: { in: seasonIds } }, _sum: { amount: true } }),
    ]);

    const salesMap    = new Map(salesRaw.map(r    => [r.seasonId, r]));
    const returnsMap  = new Map(returnsRaw.map(r  => [r.seasonId, r]));
    const paymentsMap = new Map(paymentsRaw.map(r => [r.seasonId, r]));

    res.json(seasons.map(s => {
      const ts = salesMap.get(s.id)?._sum.totalAmount    || 0;
      const tr = returnsMap.get(s.id)?._sum.totalAmount  || 0;
      const tp = paymentsMap.get(s.id)?._sum.amount      || 0;
      return { season: { _id: s.id, name: s.name, isActive: s.isActive }, totalSales: ts, totalReturns: tr, totalPaid: tp, balance: ts - tr - tp, invoiceCount: salesMap.get(s.id)?._count.id || 0 };
    }));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── ITEM STATEMENT ────────────────────────────────────────────────────────────
const getCustomerItemStatement = async (req, res) => {
  try {
    const { customerId, itemId } = req.params;
    const { seasonId }           = req.query;

    const [customer, item] = await Promise.all([
      prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, code: true, name: true } }),
      prisma.item.findUnique({ where: { id: itemId }, select: { id: true, code: true, name: true, unit: true } }),
    ]);
    if (!customer) return res.status(404).json({ message: 'العميل مش موجود' });
    if (!item)     return res.status(404).json({ message: 'الصنف مش موجود' });

    const sf = seasonId ? { seasonId } : {};

    const [invoices, returns_] = await Promise.all([
      prisma.saleInvoice.findMany({
        where: { customerId, status: { in: ['approved', 'pending'] }, ...sf, deletedAt: null, items: { some: { itemId } } },
        include: { items: { where: { itemId } }, season: { select: { name: true } } },
        orderBy: { date: 'desc' },
      }),
      prisma.returnInvoice.findMany({
        where: { customerId, type: 'customer_return', status: 'approved', ...sf, items: { some: { itemId } } },
        include: { items: { where: { itemId } }, season: { select: { name: true } } },
        orderBy: { date: 'desc' },
      }),
    ]);

    const toMove = (type) => (inv) => {
      const it = inv.items[0];
      if (!it) return null;
      const qty = Number(it.quantity) || 0;
      const wt  = Number(it.weight)   || 0;
      const pr  = Number(it.price)    || 0;
      return {
        type, date: inv.date, createdAt: inv.createdAt,
        invoiceNumber: inv.invoiceNumber, invoiceId: inv.id,
        docNumber: inv.docNumber, season: inv.season,
        quantity: qty, weight: wt, totalWeight: qty * wt,
        price: pr, total: qty * wt * pr, status: inv.status,
      };
    };

    const movements = [
      ...invoices.map(toMove('sale')).filter(Boolean),
      ...returns_.map(toMove('return')).filter(Boolean),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const sales   = movements.filter(m => m.type === 'sale');
    const returns = movements.filter(m => m.type === 'return');

    res.json({
      customer: { _id: customer.id, code: customer.code, name: customer.name },
      item:     { _id: item.id, code: item.code, name: item.name, unit: item.unit },
      movements,
      totalQty:     sales.reduce((s, m)   => s + m.quantity,    0),
      totalWeight:  sales.reduce((s, m)   => s + m.totalWeight, 0),
      totalAmount:  sales.reduce((s, m)   => s + m.total,       0),
      returnQty:    returns.reduce((s, m) => s + m.quantity,    0),
      returnWeight: returns.reduce((s, m) => s + m.totalWeight, 0),
      lastPrice:    sales[0]?.price || 0,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};



// ── TIMELINE — كل الحركات مرتبة بالتاريخ مع running balance ─────────────────
// cursor-based pagination: أسرع بكتير من offset عند الأرقام الكبيرة
// يبعت: { totals, rows: [{...}], nextCursor, hasMore, totalRows }
const getCustomerTimeline = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { seasonId, cursor, limit = '100' } = req.query;

    const take = Math.min(500, Math.max(20, parseInt(limit)));

    const customer = await prisma.customer.findUnique({
      where:  { id: customerId },
      select: { id: true, code: true, name: true, phone: true, type: true,
                openingBalance: true, address: true },
    });
    if (!customer) return res.status(404).json({ message: 'العميل مش موجود' });

    // ── فلتر الموسم ───────────────────────────────────────────────────────
    const sf = seasonId ? { seasonId } : {};

    const invWhere = { customerId, status: { in: ['approved','pending'] }, ...sf, deletedAt: null };
    const retWhere = { customerId, type: 'customer_return', status: 'approved', ...sf };
    const payWhere = { customerId, type: 'customer_payment', ...sf };

    // ── totals: نحسبهم مرة واحدة بـ aggregate (سريع جداً) ──────────────
    const [salesAgg, returnsAgg, paymentsAgg,
           invCount, retCount, payCount] = await Promise.all([
      prisma.saleInvoice.aggregate({ where: invWhere, _sum: { totalAmount: true } }),
      prisma.returnInvoice.aggregate({ where: retWhere, _sum: { totalAmount: true } }),
      prisma.payment.aggregate({ where: payWhere, _sum: { amount: true } }),
      prisma.saleInvoice.count({ where: invWhere }),
      prisma.returnInvoice.count({ where: retWhere }),
      prisma.payment.count({ where: payWhere }),
    ]);

    const totalSales   = salesAgg._sum.totalAmount   || 0;
    const totalReturns = returnsAgg._sum.totalAmount || 0;
    const totalPaid    = paymentsAgg._sum.amount     || 0;
    const totalRows    = invCount + retCount + payCount;

    // ── جلب الداتا بـ cursor pagination ──────────────────────────────────
    // الـ cursor عبارة عن { date, id, type } — نستخدمه للـ seek
    let cursorDate = null;
    let cursorId   = null;

    if (cursor) {
      try {
        const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString());
        cursorDate = new Date(parsed.date);
        cursorId   = parsed.id;
      } catch { /* cursor باظ، نبدأ من الأول */ }
    }

    const dateFilter = cursorDate
      ? { OR: [
          { date: { gt: cursorDate } },
          { date: cursorDate, id: { gt: cursorId } },
        ]}
      : {};

    // نجيب take+1 عشان نعرف لو في صفحة تانية
    const fetchLimit = take + 1;
    const invDateFilter = cursorDate
      ? { OR: [{ date: { gt: cursorDate } }, { date: cursorDate, id: { gt: cursorId } }] }
      : {};

    const [invoices, returns_, payments] = await Promise.all([
      prisma.saleInvoice.findMany({
        where:   { ...invWhere, ...invDateFilter },
        select:  { id: true, invoiceNumber: true, docNumber: true, date: true, totalAmount: true, status: true },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
        take:    fetchLimit,
      }),
      prisma.returnInvoice.findMany({
        where:   { ...retWhere, ...invDateFilter },
        select:  { id: true, invoiceNumber: true, docNumber: true, date: true, totalAmount: true, status: true },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
        take:    fetchLimit,
      }),
      prisma.payment.findMany({
        where:   { ...payWhere, ...invDateFilter },
        select:  { id: true, receiptNumber: true, date: true, amount: true, paymentMethod: true,
                   cashAmount: true, instapayAmount: true, notes: true, reference: true },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
        take:    fetchLimit,
      }),
    ]);

    // ── دمج وترتيب ────────────────────────────────────────────────────────
    const rows = [
      ...invoices.map(r => ({ ...r, _id: r.id, rowType: 'invoice',  amount: r.totalAmount })),
      ...returns_.map(r => ({ ...r, _id: r.id, rowType: 'return',   amount: r.totalAmount })),
      ...payments.map(r => ({ ...r, _id: r.id, rowType: 'payment',  amount: r.amount })),
    ].sort((a, b) => {
      const d = new Date(a.date) - new Date(b.date);
      return d !== 0 ? d : a.id.localeCompare(b.id);
    });

    // قص fetchLimit+1 لو موجود
    const hasMore  = rows.length > take;
    const pageRows = hasMore ? rows.slice(0, take) : rows;

    const lastRow  = pageRows[pageRows.length - 1];
    const nextCursor = hasMore && lastRow
      ? Buffer.from(JSON.stringify({ date: lastRow.date, id: lastRow.id })).toString('base64')
      : null;

    // ── running balance: نحسبه من الأول لو cursor = null ──────────────────
    // لو cursor موجود (صفحة 2+)، الـ runningBefore بييجي في الـ request
    const runningBefore = cursor
      ? parseFloat(req.query.runningBefore || '0')
      : (customer.openingBalance || 0);

    let running = runningBefore;
    const rowsWithBalance = pageRows.map(r => {
      if (r.rowType === 'invoice') running += r.amount;
      else                         running -= r.amount;
      return { ...r, runningBalance: running };
    });

    const seasons = await prisma.season.findMany({ orderBy: { startDate: 'desc' } });

    res.json({
      customer:    { ...customer, _id: customer.id },
      seasons:     seasons.map(n),
      totals: { totalSales, totalReturns, totalPaid,
                netSales:  totalSales - totalReturns,
                balance:   totalSales - totalReturns - totalPaid },
      counts:      { invoices: invCount, returns: retCount, payments: payCount, total: totalRows },
      rows:        rowsWithBalance,
      nextCursor,
      hasMore,
      runningAtEnd: running,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const n = (x) => ({ ...x, _id: x.id });

const pickCustomer = (data) => {
  const keys = ['name','code','phone','address','type','isActive','notes'];
  return Object.fromEntries(keys.filter(k => k in data).map(k => [k, data[k]]));
};

module.exports = {
  getCustomers, createCustomer, updateCustomer,
  updateInitialBalance, deleteCustomer,
  getCustomerStatement, getCustomerAllSeasons, getCustomerItemStatement,
  getCustomerTimeline,
};