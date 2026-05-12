// ─── controllers/supplierController.js ───────────────────────────────────────
const prisma        = require('../config/db');
const { audit }     = require('../utils/auditHelper');
const { nextNumber } = require('../utils/counterHelper');

// ── getSuppliers ──────────────────────────────────────────────────────────────
const getSuppliers = async (req, res) => {
  try {
    const { search } = req.query;
    const where = { isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const suppliers = await prisma.supplier.findMany({ where, orderBy: { code: 'asc' } });
    if (suppliers.length === 0) return res.json([]);

    const supplierIds = suppliers.map(s => s.id);

    // Aggregation بـ groupBy بدل aggregate
    const [purchasesAgg, returnsAgg, paymentsAgg] = await Promise.all([
      prisma.purchaseInvoice.groupBy({
        by: ['supplierId'],
        where: { supplierId: { in: supplierIds }, status: { not: 'cancelled' } },
        _sum: { totalAmount: true },
      }),
      prisma.returnInvoice.groupBy({
        by: ['supplierId'],
        where: { supplierId: { in: supplierIds }, type: 'supplier_return', status: 'approved' },
        _sum: { totalAmount: true },
      }),
      prisma.payment.groupBy({
        by: ['supplierId'],
        where: { supplierId: { in: supplierIds }, type: 'supplier_payment' },
        _sum: { amount: true },
      }),
    ]);

    const purchasesMap = new Map(purchasesAgg.map(r => [r.supplierId, r._sum.totalAmount || 0]));
    const returnsMap   = new Map(returnsAgg.map(r   => [r.supplierId, r._sum.totalAmount || 0]));
    const paymentsMap  = new Map(paymentsAgg.map(r  => [r.supplierId, r._sum.amount      || 0]));

    const result = suppliers.map(s => ({
      ...s, _id: s.id,
      totalPurchases: purchasesMap.get(s.id) || 0,
      totalReturns:   returnsMap.get(s.id)   || 0,
      totalPaid:      paymentsMap.get(s.id)  || 0,
      balance: (purchasesMap.get(s.id) || 0) - (returnsMap.get(s.id) || 0) - (paymentsMap.get(s.id) || 0),
    }));

    res.json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const getSupplierByCode = async (req, res) => {
  try {
    const supplier = await prisma.supplier.findFirst({ where: { code: req.params.code, isActive: true } });
    if (!supplier) return res.status(404).json({ message: 'المورد مش موجود' });
    res.json(n(supplier));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const createSupplier = async (req, res) => {
  try {
    const { openingBalance, ...supplierData } = req.body;
    const exists = await prisma.supplier.findUnique({ where: { code: supplierData.code } });
    if (exists) return res.status(400).json({ message: 'كود المورد موجود بالفعل' });

    const supplier = await prisma.supplier.create({
      data: { ...pick(supplierData, ['name','code','phone','phone2','address','taxNumber','notes']), openingBalance: Number(openingBalance) || 0, createdById: req.user.id },
    });

    await audit(req.user, 'supplier_created', 'Supplier', supplier.id, supplier.name, { code: supplier.code });
    res.status(201).json(n(supplier));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const updateSupplier = async (req, res) => {
  try {
    const { name, code, phone, address, notes, isActive } = req.body;
    const data = {};
    if (name      !== undefined) data.name      = name;
    if (code      !== undefined) data.code      = code;
    if (phone     !== undefined) data.phone     = phone;
    if (address   !== undefined) data.address   = address;
    if (notes     !== undefined) data.notes     = notes;
    if (isActive  !== undefined) data.isActive  = isActive;

    const supplier = await prisma.supplier.update({ where: { id: req.params.id }, data });
    await audit(req.user, 'supplier_updated', 'Supplier', supplier.id, supplier.name);
    res.json(n(supplier));
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'المورد مش موجود' });
    res.status(500).json({ message: err.message });
  }
};

const deleteSupplier = async (req, res) => {
  try {
    const supplier = await prisma.supplier.update({ where: { id: req.params.id }, data: { isActive: false } });
    await audit(req.user, 'supplier_deleted', 'Supplier', supplier.id, supplier.name);
    res.json({ message: 'تم الحذف' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'المورد مش موجود' });
    res.status(500).json({ message: err.message });
  }
};

const getSupplierStatement = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { seasonId, page = 1, pageSize = 200, tab = 'all' } = req.query;

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, code: true, name: true, phone: true, address: true, notes: true, openingBalance: true },
    });
    if (!supplier) return res.status(404).json({ message: 'المورد مش موجود' });

    const seasons = await prisma.season.findMany({ orderBy: { startDate: 'desc' } });
    const targetSeason = seasonId
      ? seasons.find(s => s.id === seasonId)
      : seasons.find(s => s.isActive);

    const sf = targetSeason ? { seasonId: targetSeason.id } : {};
    const pg = Math.max(1, parseInt(page));
    const ps = Math.min(500, Math.max(50, parseInt(pageSize)));
    const skip = (pg - 1) * ps;

    const invSelect  = { id: true, invoiceNumber: true, docNumber: true, date: true, createdAt: true, totalAmount: true, status: true };
    const retSelect  = { id: true, invoiceNumber: true, docNumber: true, date: true, createdAt: true, totalAmount: true, status: true };
    const paySelect  = { id: true, receiptNumber: true, date: true, createdAt: true, amount: true, paymentMethod: true, cashAmount: true, instapayAmount: true, notes: true, reference: true };

    const invWhere  = { supplierId, status: { not: 'cancelled' }, ...sf };
    const retWhere  = { supplierId, type: 'supplier_return', status: 'approved', ...sf };
    const payWhere  = { supplierId, type: 'supplier_payment', ...(targetSeason ? { seasonId: targetSeason.id } : {}) };

    const [totalsAgg, invCount, retCount, payCount] = await Promise.all([
      prisma.$transaction([
        prisma.purchaseInvoice.aggregate({ where: invWhere, _sum: { totalAmount: true } }),
        prisma.returnInvoice.aggregate({ where: retWhere, _sum: { totalAmount: true } }),
        prisma.payment.aggregate({ where: payWhere, _sum: { amount: true } }),
      ]),
      prisma.purchaseInvoice.count({ where: invWhere }),
      prisma.returnInvoice.count({ where: retWhere }),
      prisma.payment.count({ where: payWhere }),
    ]);

    const totalPurchases = totalsAgg[0]._sum.totalAmount || 0;
    const totalReturns   = totalsAgg[1]._sum.totalAmount || 0;
    const totalPaid      = totalsAgg[2]._sum.amount      || 0;

    const fetchInv = tab === 'all' || tab === 'invoices';
    const fetchRet = tab === 'all' || tab === 'returns';
    const fetchPay = tab === 'all' || tab === 'payments';

    const [invoices, returns_, payments] = await Promise.all([
      fetchInv
        ? prisma.purchaseInvoice.findMany({ where: invWhere, select: invSelect, orderBy: { date: 'asc' }, skip, take: ps })
        : [],
      fetchRet
        ? prisma.returnInvoice.findMany({ where: retWhere, select: retSelect, orderBy: { date: 'asc' }, skip, take: ps })
        : [],
      fetchPay
        ? prisma.payment.findMany({ where: payWhere, select: paySelect, orderBy: { date: 'asc' }, skip, take: ps })
        : [],
    ]);

    res.json({
      supplier: n(supplier), season: targetSeason || null, seasons: seasons.map(n),
      invoices: invoices.map(n), returns: returns_.map(n), payments: payments.map(n),
      totalPurchases, totalReturns, totalPaid,
      netPurchases: totalPurchases - totalReturns,
      balance:      totalPurchases - totalReturns - totalPaid,
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

const getSupplierAllSeasons = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const seasons = await prisma.season.findMany({ orderBy: { startDate: 'desc' } });
    const seasonIds = seasons.map(s => s.id);

    const [purchasesRaw, returnsRaw, paymentsRaw] = await Promise.all([
      prisma.purchaseInvoice.groupBy({ by: ['seasonId'], where: { supplierId, status: { not: 'cancelled' }, seasonId: { in: seasonIds } }, _sum: { totalAmount: true }, _count: { id: true } }),
      prisma.returnInvoice.groupBy({ by: ['seasonId'], where: { supplierId, type: 'supplier_return', status: 'approved', seasonId: { in: seasonIds } }, _sum: { totalAmount: true } }),
      prisma.payment.groupBy({ by: ['seasonId'], where: { supplierId, type: 'supplier_payment', seasonId: { in: seasonIds } }, _sum: { amount: true } }),
    ]);

    const purchasesMap = new Map(purchasesRaw.map(r => [r.seasonId, r]));
    const returnsMap   = new Map(returnsRaw.map(r   => [r.seasonId, r]));
    const paymentsMap  = new Map(paymentsRaw.map(r  => [r.seasonId, r]));

    res.json(seasons.map(s => {
      const tp = purchasesMap.get(s.id)?._sum.totalAmount || 0;
      const tr = returnsMap.get(s.id)?._sum.totalAmount   || 0;
      const tm = paymentsMap.get(s.id)?._sum.amount       || 0;
      return { season: { _id: s.id, name: s.name, isActive: s.isActive }, totalPurchases: tp, totalReturns: tr, totalPaid: tm, balance: tp - tr - tm, invoiceCount: purchasesMap.get(s.id)?._count.id || 0 };
    }));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const updateSupplierInitialBalance = async (req, res) => {
  try {
    const newAmount = Number(req.body.openingBalance);
    if (isNaN(newAmount) || newAmount < 0) return res.status(400).json({ message: 'المبلغ غير صحيح' });

    const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id } });
    if (!supplier) return res.status(404).json({ message: 'المورد مش موجود' });

    await prisma.supplier.update({ where: { id: supplier.id }, data: { openingBalance: newAmount } });
    await audit(req.user, 'initial_balance_updated', 'Supplier', supplier.id, supplier.name, { newBalance: newAmount });
    res.json({ message: 'تم تعديل الرصيد الابتدائي', openingBalance: newAmount });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── SUPPLIER ITEM STATEMENT ────────────────────────────────────────────────────
const getSupplierItemStatement = async (req, res) => {
  try {
    const { supplierId, itemId } = req.params;
    const { seasonId }           = req.query;

    const [supplier, item] = await Promise.all([
      prisma.supplier.findUnique({ where: { id: supplierId }, select: { id: true, code: true, name: true } }),
      prisma.item.findUnique({ where: { id: itemId }, select: { id: true, code: true, name: true, unit: true } }),
    ]);
    if (!supplier) return res.status(404).json({ message: 'المورد مش موجود' });
    if (!item)     return res.status(404).json({ message: 'الصنف مش موجود' });

    const sf = seasonId ? { seasonId } : {};

    const seasons = await prisma.season.findMany({ orderBy: { startDate: 'desc' } });

    const [invoices, returns_] = await Promise.all([
      prisma.purchaseInvoice.findMany({
        where: { supplierId, status: { not: 'cancelled' }, ...sf, items: { some: { itemId } } },
        include: { items: { where: { itemId } }, season: { select: { name: true } } },
        orderBy: { date: 'desc' },
      }),
      prisma.returnInvoice.findMany({
        where: { supplierId, type: 'supplier_return', status: 'approved', ...sf, items: { some: { itemId } } },
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
      ...invoices.map(toMove('purchase')).filter(Boolean),
      ...returns_.map(toMove('return')).filter(Boolean),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const purchases = movements.filter(m => m.type === 'purchase');
    const returns   = movements.filter(m => m.type === 'return');

    res.json({
      supplier: n(supplier),
      item:     n(item),
      seasons:  seasons.map(n),
      movements,
      totalQty:     purchases.reduce((s, m) => s + m.quantity,    0),
      totalWeight:  purchases.reduce((s, m) => s + m.totalWeight, 0),
      totalAmount:  purchases.reduce((s, m) => s + m.total,       0),
      returnQty:    returns.reduce((s, m)   => s + m.quantity,    0),
      returnWeight: returns.reduce((s, m)   => s + m.totalWeight, 0),
      lastPrice:    purchases[0]?.price || 0,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── TIMELINE — كل الحركات مرتبة بالتاريخ مع running balance ─────────────────
const getSupplierTimeline = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { seasonId, cursor, limit = '100' } = req.query;

    const take = Math.min(500, Math.max(20, parseInt(limit)));

    const supplier = await prisma.supplier.findUnique({
      where:  { id: supplierId },
      select: { id: true, code: true, name: true, phone: true, address: true,
                notes: true, openingBalance: true },
    });
    if (!supplier) return res.status(404).json({ message: 'المورد مش موجود' });

    const sf = seasonId ? { seasonId } : {};

    const invWhere = { supplierId, status: { not: 'cancelled' }, ...sf };
    const retWhere = { supplierId, type: 'supplier_return', status: 'approved', ...sf };
    const payWhere = { supplierId, type: 'supplier_payment', ...sf };

    const [purchasesAgg, returnsAgg, paymentsAgg,
           invCount, retCount, payCount] = await Promise.all([
      prisma.purchaseInvoice.aggregate({ where: invWhere, _sum: { totalAmount: true } }),
      prisma.returnInvoice.aggregate({ where: retWhere, _sum: { totalAmount: true } }),
      prisma.payment.aggregate({ where: payWhere, _sum: { amount: true } }),
      prisma.purchaseInvoice.count({ where: invWhere }),
      prisma.returnInvoice.count({ where: retWhere }),
      prisma.payment.count({ where: payWhere }),
    ]);

    const totalPurchases = purchasesAgg._sum.totalAmount || 0;
    const totalReturns   = returnsAgg._sum.totalAmount   || 0;
    const totalPaid      = paymentsAgg._sum.amount       || 0;
    const totalRows      = invCount + retCount + payCount;

    let cursorDate = null;
    let cursorId   = null;
    if (cursor) {
      try {
        const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString());
        cursorDate = new Date(parsed.date);
        cursorId   = parsed.id;
      } catch { /* cursor باظ */ }
    }

    const fetchLimit   = take + 1;
    const invDateFilter = cursorDate
      ? { OR: [{ date: { gt: cursorDate } }, { date: cursorDate, id: { gt: cursorId } }] }
      : {};

    const [invoices, returns_, payments] = await Promise.all([
      prisma.purchaseInvoice.findMany({
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

    const rows = [
      ...invoices.map(r => ({ ...r, _id: r.id, rowType: 'invoice', amount: r.totalAmount })),
      ...returns_.map(r => ({ ...r, _id: r.id, rowType: 'return',  amount: r.totalAmount })),
      ...payments.map(r => ({ ...r, _id: r.id, rowType: 'payment', amount: r.amount })),
    ].sort((a, b) => {
      const d = new Date(a.date) - new Date(b.date);
      return d !== 0 ? d : a.id.localeCompare(b.id);
    });

    const hasMore  = rows.length > take;
    const pageRows = hasMore ? rows.slice(0, take) : rows;
    const lastRow  = pageRows[pageRows.length - 1];
    const nextCursor = hasMore && lastRow
      ? Buffer.from(JSON.stringify({ date: lastRow.date, id: lastRow.id })).toString('base64')
      : null;

    const runningBefore = cursor
      ? parseFloat(req.query.runningBefore || '0')
      : (supplier.openingBalance || 0);

    let running = runningBefore;
    const rowsWithBalance = pageRows.map(r => {
      if (r.rowType === 'invoice') running += r.amount;
      else                         running -= r.amount;
      return { ...r, runningBalance: running };
    });

    const seasons = await prisma.season.findMany({ orderBy: { startDate: 'desc' } });

    res.json({
      supplier:    { ...supplier, _id: supplier.id },
      seasons:     seasons.map(n),
      totals: { totalPurchases, totalReturns, totalPaid,
                netPurchases: totalPurchases - totalReturns,
                balance:      totalPurchases - totalReturns - totalPaid },
      counts:      { invoices: invCount, returns: retCount, payments: payCount, total: totalRows },
      rows:        rowsWithBalance,
      nextCursor,
      hasMore,
      runningAtEnd: running,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const n   = (x) => ({ ...x, _id: x.id });
const pick = (obj, keys) => Object.fromEntries(keys.filter(k => k in obj).map(k => [k, obj[k]]));

module.exports = { getSuppliers, getSupplierByCode, createSupplier, updateSupplier, deleteSupplier, getSupplierStatement, getSupplierAllSeasons, updateSupplierInitialBalance, getSupplierItemStatement, getSupplierTimeline };
