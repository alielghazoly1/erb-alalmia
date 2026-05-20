// ─── controllers/supplierController.js ───────────────────────────────────────
'use strict';

const prisma          = require('../config/db');
const { audit }       = require('../utils/auditHelper');
const { safeNum, round2, n } = require('../utils/decimalHelper');

// ── helpers ───────────────────────────────────────────────────────────────────
const SUPPLIER_SELECT = {
  id: true, code: true, name: true, phone: true, phone2: true,
  address: true, taxNumber: true, isActive: true, notes: true, openingBalance: true,
};

const pickSupplier = (body) => {
  const keys = ['name','code','phone','phone2','address','taxNumber','notes','isActive'];
  return Object.fromEntries(keys.filter(k => body[k] !== undefined).map(k => [k, body[k]]));
};

const getSeasonOpeningBalance = async (supplierId, seasonId) => {
  if (!seasonId) return 0;
  const rec = await prisma.supplierSeasonBalance.findUnique({
    where:  { supplierId_seasonId: { supplierId, seasonId } },
    select: { openingBalance: true },
  });
  return round2(safeNum(rec?.openingBalance));
};

const upsertSeasonBalance = async (supplierId, seasonId, amount, userId) => {
  await prisma.supplierSeasonBalance.upsert({
    where:  { supplierId_seasonId: { supplierId, seasonId } },
    update: { openingBalance: amount, updatedById: userId },
    create: { supplierId, seasonId, openingBalance: amount, updatedById: userId },
  });
};

// ── GET /api/suppliers ────────────────────────────────────────────────────────
const getSuppliers = async (req, res) => {
  try {
    const { search, seasonId } = req.query;

    const where = { isActive: true, deletedAt: null };
    if (search?.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { code: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const suppliers = await prisma.supplier.findMany({ where, select: SUPPLIER_SELECT, orderBy: { code: 'asc' } });
    if (!suppliers.length) return res.json([]);

    const ids          = suppliers.map(s => s.id);
    const seasonFilter = seasonId ? { seasonId } : {};

    const [purchasesAgg, returnsAgg, paymentsAgg, seasonBalances] = await Promise.all([
      prisma.purchaseInvoice.groupBy({
        by: ['supplierId'],
        where: { supplierId: { in: ids }, status: { not: 'cancelled' }, ...seasonFilter },
        _sum: { totalAmount: true },
      }),
      prisma.returnInvoice.groupBy({
        by: ['supplierId'],
        where: { supplierId: { in: ids }, type: 'supplier_return', status: 'approved', ...seasonFilter },
        _sum: { totalAmount: true },
      }),
      prisma.payment.groupBy({
        by: ['supplierId'],
        where: { supplierId: { in: ids }, type: 'supplier_payment', ...seasonFilter },
        _sum: { amount: true },
      }),
      seasonId
        ? prisma.supplierSeasonBalance.findMany({
            where: { supplierId: { in: ids }, seasonId },
            select: { supplierId: true, openingBalance: true },
          })
        : Promise.resolve([]),
    ]);

    const purchasesMap = new Map(purchasesAgg.map(r => [r.supplierId, round2(safeNum(r._sum.totalAmount))]));
    const returnsMap   = new Map(returnsAgg.map(r   => [r.supplierId, round2(safeNum(r._sum.totalAmount))]));
    const paymentsMap  = new Map(paymentsAgg.map(r  => [r.supplierId, round2(safeNum(r._sum.amount))]));
    const openingMap   = new Map(seasonBalances.map(r=> [r.supplierId, round2(safeNum(r.openingBalance))]));

    const result = suppliers.map(s => {
      const tp  = purchasesMap.get(s.id) ?? 0;
      const tr  = returnsMap.get(s.id)   ?? 0;
      const pay = paymentsMap.get(s.id)  ?? 0;
      const ob  = seasonId
        ? (openingMap.get(s.id) ?? 0)
        : round2(safeNum(s.openingBalance));
      return {
        ...n(s),
        openingBalance: ob,
        totalPurchases: tp,
        totalReturns:   tr,
        totalPaid:      pay,
        balance:        round2(ob + tp - tr - pay),
      };
    });

    res.json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET /api/suppliers/code/:code ─────────────────────────────────────────────
const getSupplierByCode = async (req, res) => {
  try {
    const s = await prisma.supplier.findFirst({ where: { code: req.params.code, isActive: true } });
    if (!s) return res.status(404).json({ message: 'المورد مش موجود' });
    res.json(n(s));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── POST /api/suppliers ───────────────────────────────────────────────────────
const createSupplier = async (req, res) => {
  try {
    const { openingBalance, ...body } = req.body;
    const exists = await prisma.supplier.findUnique({ where: { code: body.code } });
    if (exists) return res.status(400).json({ message: 'كود المورد موجود بالفعل' });

    const supplier = await prisma.supplier.create({
      data: { ...pickSupplier(body), openingBalance: 0, createdById: req.user.id },
    });

    const ob = round2(safeNum(openingBalance));
    if (ob !== 0) {
      const season = await prisma.season.findFirst({ where: { isActive: true } });
      if (season) await upsertSeasonBalance(supplier.id, season.id, ob, req.user.id);
    }

    await audit(req.user, 'supplier_created', 'Supplier', supplier.id, supplier.name, { code: supplier.code });
    res.status(201).json(n(supplier));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── PUT /api/suppliers/:id ────────────────────────────────────────────────────
const updateSupplier = async (req, res) => {
  try {
    const { openingBalance, ...body } = req.body;
    const supplier = await prisma.supplier.update({
      where: { id: req.params.id },
      data:  pickSupplier(body),
    });
    await audit(req.user, 'supplier_updated', 'Supplier', supplier.id, supplier.name);
    res.json(n(supplier));
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'المورد مش موجود' });
    res.status(500).json({ message: err.message });
  }
};

// ── DELETE /api/suppliers/:id ─────────────────────────────────────────────────
const deleteSupplier = async (req, res) => {
  try {
    await prisma.supplier.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } });
    res.json({ message: 'تم الحذف' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── PATCH /api/suppliers/:id/initial-balance ──────────────────────────────────
const updateSupplierInitialBalance = async (req, res) => {
  try {
    const newAmount = round2(safeNum(req.body.openingBalance ?? req.body.initialBalance));
    const { seasonId } = req.body;

    const supplier = await prisma.supplier.findUnique({ where: { id: req.params.id } });
    if (!supplier) return res.status(404).json({ message: 'المورد مش موجود' });
    if (!seasonId) return res.status(400).json({ message: 'seasonId مطلوب' });

    await upsertSeasonBalance(supplier.id, seasonId, newAmount, req.user.id);
    await audit(req.user, 'supplier_updated', 'Supplier', supplier.id, supplier.name, { newBalance: newAmount, seasonId });

    res.json({ message: 'تم تعديل الرصيد الابتدائي', openingBalance: newAmount, seasonId });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET /api/suppliers/:id/statement ─────────────────────────────────────────
const getSupplierStatement = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { seasonId, page = 1, pageSize = 200 } = req.query;

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: SUPPLIER_SELECT });
    if (!supplier) return res.status(404).json({ message: 'المورد مش موجود' });

    const seasonFilter = seasonId ? { seasonId } : {};
    const purWhere = { supplierId, status: { not: 'cancelled' }, ...seasonFilter };
    const retWhere = { supplierId, type: 'supplier_return', status: 'approved', ...seasonFilter };
    const payWhere = { supplierId, type: 'supplier_payment', ...seasonFilter };

    const [openingBal, purAgg, retAgg, payAgg, purCount, retCount, payCount] = await Promise.all([
      getSeasonOpeningBalance(supplierId, seasonId),
      prisma.purchaseInvoice.aggregate({ where: purWhere, _sum: { totalAmount: true } }),
      prisma.returnInvoice.aggregate({ where: retWhere, _sum: { totalAmount: true } }),
      prisma.payment.aggregate({ where: payWhere, _sum: { amount: true } }),
      prisma.purchaseInvoice.count({ where: purWhere }),
      prisma.returnInvoice.count({ where: retWhere }),
      prisma.payment.count({ where: payWhere }),
    ]);

    const totalPurchases = round2(safeNum(purAgg._sum.totalAmount));
    const totalReturns   = round2(safeNum(retAgg._sum.totalAmount));
    const totalPaid      = round2(safeNum(payAgg._sum.amount));
    const trueBalance    = round2(openingBal + totalPurchases - totalReturns - totalPaid);

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    const [purchases, returns, payments] = await Promise.all([
      prisma.purchaseInvoice.findMany({
        where: purWhere, skip, take,
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

    const allRows = [
      ...purchases.map(r => ({ ...r, rowType: 'purchase', amount: round2(safeNum(r.totalAmount)) })),
      ...returns.map(r   => ({ ...r, rowType: 'supplier_return', amount: round2(safeNum(r.totalAmount)) })),
      ...payments.map(r  => ({ ...r, rowType: 'supplier_payment', amount: round2(safeNum(r.amount)) })),
    ].sort((a, b) => new Date(a.date) - new Date(b.date) || a.id.localeCompare(b.id));

    let running = openingBal;
    const rows = allRows.map(r => {
      running = r.rowType === 'purchase'
        ? round2(running + r.amount)
        : round2(running - r.amount);
      return { ...r, _id: r.id, runningBalance: running };
    });

    const openingRow = openingBal !== 0 ? [{
      _id: 'opening', id: 'opening', rowType: 'opening',
      amount: openingBal, runningBalance: openingBal,
      date: supplier.createdAt, docNumber: 'رصيد ابتدائي',
    }] : [];

    const seasons = await prisma.season.findMany({ orderBy: { startDate: 'desc' } });

    res.json({
      supplier:  { ...n(supplier), openingBalance: openingBal },
      seasons:   seasons.map(n),
      totals:    { totalPurchases, totalReturns, totalPaid, openingBalance: openingBal, netPurchases: round2(totalPurchases - totalReturns), balance: trueBalance },
      counts:    { invoices: purCount, returns: retCount, payments: payCount, total: purCount + retCount + payCount },
      rows:      [...openingRow, ...rows],
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET /api/suppliers/:supplierId/all-seasons ────────────────────────────────
const getSupplierAllSeasons = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: SUPPLIER_SELECT });
    if (!supplier) return res.status(404).json({ message: 'المورد مش موجود' });

    const seasons = await prisma.season.findMany({ orderBy: { startDate: 'desc' } });
    const [seasonBalances, purBySeason, retBySeason, payBySeason] = await Promise.all([
      prisma.supplierSeasonBalance.findMany({ where: { supplierId }, select: { seasonId: true, openingBalance: true } }),
      prisma.purchaseInvoice.groupBy({ by: ['seasonId'], where: { supplierId, status: { not: 'cancelled' } }, _sum: { totalAmount: true }, _count: { id: true } }),
      prisma.returnInvoice.groupBy({ by: ['seasonId'], where: { supplierId, type: 'supplier_return', status: 'approved' }, _sum: { totalAmount: true } }),
      prisma.payment.groupBy({ by: ['seasonId'], where: { supplierId, type: 'supplier_payment' }, _sum: { amount: true } }),
    ]);

    const openingMap  = new Map(seasonBalances.map(r => [r.seasonId, round2(safeNum(r.openingBalance))]));
    const purMap      = new Map(purBySeason.map(r   => [r.seasonId, { total: round2(safeNum(r._sum.totalAmount)), count: r._count.id }]));
    const retMap      = new Map(retBySeason.map(r   => [r.seasonId, round2(safeNum(r._sum.totalAmount))]));
    const payMap      = new Map(payBySeason.map(r   => [r.seasonId, round2(safeNum(r._sum.amount))]));

    const result = seasons.map(s => {
      const ob  = openingMap.get(s.id)  ?? 0;
      const tp  = purMap.get(s.id)?.total ?? 0;
      const tc  = purMap.get(s.id)?.count ?? 0;
      const tr  = retMap.get(s.id)  ?? 0;
      const pay = payMap.get(s.id)  ?? 0;
      return {
        season: n(s), openingBalance: ob,
        totalPurchases: tp, totalReturns: tr, totalPaid: pay,
        balance: round2(ob + tp - tr - pay), invoiceCount: tc,
      };
    }).filter(s => s.totalPurchases > 0 || s.totalReturns > 0 || s.totalPaid > 0 || s.openingBalance !== 0);

    res.json({ supplier: n(supplier), seasons: result });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET /api/suppliers/:supplierId/timeline ───────────────────────────────────
const getSupplierTimeline = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { seasonId, limit = 100, cursor } = req.query;

    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: SUPPLIER_SELECT });
    if (!supplier) return res.status(404).json({ message: 'المورد مش موجود' });

    const openingBal   = await getSeasonOpeningBalance(supplierId, seasonId);
    const seasonFilter = seasonId ? { seasonId } : {};
    const purWhere     = { supplierId, status: { not: 'cancelled' }, ...seasonFilter };
    const retWhere     = { supplierId, type: 'supplier_return', status: 'approved', ...seasonFilter };
    const payWhere     = { supplierId, type: 'supplier_payment', ...seasonFilter };

    const [purCount, retCount, payCount, purchases, returns, payments] = await Promise.all([
      prisma.purchaseInvoice.count({ where: purWhere }),
      prisma.returnInvoice.count({ where: retWhere }),
      prisma.payment.count({ where: payWhere }),
      prisma.purchaseInvoice.findMany({
        where: purWhere,
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

    const allRows = [
      ...purchases.map(r => ({ ...r, rowType: 'purchase',         amount: round2(safeNum(r.totalAmount)) })),
      ...returns.map(r   => ({ ...r, rowType: 'supplier_return',   amount: round2(safeNum(r.totalAmount)) })),
      ...payments.map(r  => ({ ...r, rowType: 'supplier_payment',  amount: round2(safeNum(r.amount)) })),
    ].sort((a, b) => new Date(a.date) - new Date(b.date) || a.id.localeCompare(b.id));

    const cursorIdx      = cursor ? allRows.findIndex(r => r.id === cursor) + 1 : 0;
    const pageRows       = allRows.slice(cursorIdx, cursorIdx + Number(limit));
    const nextCursor     = pageRows.length === Number(limit) ? pageRows[pageRows.length - 1].id : null;

    const runningBefore  = cursor
      ? round2(parseFloat(req.query.runningBefore || '0'))
      : openingBal;

    let running = runningBefore;
    const rowsWithBalance = pageRows.map(r => {
      running = r.rowType === 'purchase'
        ? round2(running + r.amount)
        : round2(running - r.amount);
      return { ...r, _id: r.id, runningBalance: running };
    });

    const openingRow = (!cursor && openingBal !== 0) ? [{
      _id: 'opening', id: 'opening', rowType: 'opening',
      amount: openingBal, runningBalance: openingBal,
      date: supplier.createdAt, docNumber: 'رصيد ابتدائي',
    }] : [];

    const totalPurchases = round2(purchases.reduce((s, r) => s + safeNum(r.totalAmount), 0));
    const totalReturns   = round2(returns.reduce((s, r)   => s + safeNum(r.totalAmount), 0));
    const totalPaid      = round2(payments.reduce((s, r)  => s + safeNum(r.amount), 0));
    const seasons        = await prisma.season.findMany({ orderBy: { startDate: 'desc' } });

    res.json({
      supplier:     { ...n(supplier), openingBalance: openingBal },
      seasons:      seasons.map(n),
      totals:       { totalPurchases, totalReturns, totalPaid, openingBalance: openingBal, netPurchases: round2(totalPurchases - totalReturns), balance: round2(openingBal + totalPurchases - totalReturns - totalPaid) },
      counts:       { invoices: purCount, returns: retCount, payments: payCount, total: purCount + retCount + payCount },
      rows:         [...openingRow, ...rowsWithBalance],
      nextCursor,
      hasMore:      nextCursor !== null,
      runningAtEnd: running,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET /api/suppliers/:supplierId/item/:itemId ───────────────────────────────
const getSupplierItemStatement = async (req, res) => {
  try {
    const { supplierId, itemId } = req.params;
    const { seasonId }           = req.query;
    if (!itemId) return res.status(400).json({ message: 'itemId مطلوب' });

    const [supplier, item] = await Promise.all([
      prisma.supplier.findUnique({ where: { id: supplierId }, select: SUPPLIER_SELECT }),
      prisma.item.findUnique({
        where:  { id: itemId },
        select: { id: true, code: true, name: true, unit: true },
      }),
    ]);
    if (!supplier) return res.status(404).json({ message: 'المورد مش موجود' });
    if (!item)     return res.status(404).json({ message: 'الصنف مش موجود' });

    const purWhere = { supplierId, status: { not: 'cancelled' }, items: { some: { itemId } } };
    const retWhere = { supplierId, type: 'supplier_return', status: 'approved', items: { some: { itemId } } };
    if (seasonId) { purWhere.seasonId = seasonId; retWhere.seasonId = seasonId; }

    const [purchaseInvoices, returnInvoices] = await Promise.all([
      prisma.purchaseInvoice.findMany({
        where:   purWhere,
        select: {
          id: true, invoiceNumber: true, docNumber: true, date: true,
          status: true, createdAt: true,
          items: { where: { itemId }, select: { quantity: true, weight: true, price: true, total: true } },
        },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
      }),
      prisma.returnInvoice.findMany({
        where:   retWhere,
        select: {
          id: true, invoiceNumber: true, docNumber: true, date: true,
          status: true, createdAt: true,
          items: { where: { itemId }, select: { quantity: true, weight: true, price: true, total: true } },
        },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const movements = [
      ...purchaseInvoices.flatMap(inv =>
        inv.items.map(it => ({
          invoiceId:     inv.id,
          docNumber:     inv.docNumber  || inv.invoiceNumber || '—',
          invoiceNumber: inv.invoiceNumber,
          date:          inv.date,
          createdAt:     inv.createdAt,
          status:        inv.status,
          type:          'purchase',
          quantity:      round2(safeNum(it.quantity)),
          weight:        round2(safeNum(it.weight)),
          totalWeight:   round2(safeNum(it.quantity) * safeNum(it.weight)),
          price:         round2(safeNum(it.price)),
          total:         round2(safeNum(it.total)),
        }))
      ),
      ...returnInvoices.flatMap(inv =>
        inv.items.map(it => ({
          invoiceId:     inv.id,
          docNumber:     inv.docNumber  || inv.invoiceNumber || '—',
          invoiceNumber: inv.invoiceNumber,
          date:          inv.date,
          createdAt:     inv.createdAt,
          status:        inv.status,
          type:          'return',
          quantity:      round2(safeNum(it.quantity)),
          weight:        round2(safeNum(it.weight)),
          totalWeight:   round2(safeNum(it.quantity) * safeNum(it.weight)),
          price:         round2(safeNum(it.price)),
          total:         round2(safeNum(it.total)),
        }))
      ),
    ].sort((a, b) => new Date(a.date) - new Date(b.date) || a.invoiceId.localeCompare(b.invoiceId));

    const sales   = movements.filter(m => m.type === 'purchase');
    const returns = movements.filter(m => m.type === 'return');

    const totalQty    = round2(sales.reduce((s, m) => s + m.quantity, 0));
    const totalWeight = round2(sales.reduce((s, m) => s + m.totalWeight, 0));
    const totalAmount = round2(sales.reduce((s, m) => s + m.total, 0));
    const returnQty   = round2(returns.reduce((s, m) => s + m.quantity, 0));
    const returnWeight= round2(returns.reduce((s, m) => s + m.totalWeight, 0));
    const lastPrice   = sales.length ? sales[sales.length - 1].price : 0;

    res.json({
      supplier: n(supplier),
      item,
      movements,
      totalQty, totalWeight, totalAmount,
      returnQty, returnWeight, lastPrice,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = {
  getSuppliers, getSupplierByCode, createSupplier, updateSupplier, deleteSupplier,
  updateSupplierInitialBalance, getSupplierStatement, getSupplierAllSeasons,
  getSupplierItemStatement, getSupplierTimeline,
};
