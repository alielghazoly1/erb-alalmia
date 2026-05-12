// ─── controllers/reportController.js ─────────────────────────────────────────
const prisma = require('../config/db');

// ─────────────────────────────────────────────────────────────────────────────
// getGeneralStats  –  optimised for 100 k+ invoices / season
// بدل 13 query منفصلة: كل حاجة في parallel مع select محدود + no includes
// ─────────────────────────────────────────────────────────────────────────────
const getGeneralStats = async (req, res) => {
  try {
    const { seasonId } = req.query;

    // ── 1. resolve season (lightweight) ────────────────────────────────────
    const activeSeason = seasonId
      ? await prisma.season.findUnique({
          where:  { id: seasonId },
          select: { id: true, name: true, startDate: true, endDate: true, isActive: true },
        })
      : await prisma.season.findFirst({
          where:  { isActive: true },
          select: { id: true, name: true, startDate: true, endDate: true, isActive: true },
        });

    const sf = activeSeason ? { seasonId: activeSeason.id } : {};

    // ── 2. fire all aggregates in ONE Promise.all – no sequential awaits ───
    const [
      salesByMethod,          // groupBy paymentMethod → totals
      salesReturnsAgg,
      purchasesAgg,
      supplierReturnsAgg,
      pendingCounts,          // count all pending in one groupBy
      totalCustomers,
      totalItems,
      paymentsAgg,
    ] = await Promise.all([

      // كل المبيعات المعتمدة – مجمّعة حسب طريقة الدفع (query واحدة بدل 3)
      prisma.saleInvoice.groupBy({
        by:     ['paymentMethod'],
        where:  { status: 'approved', ...sf, deletedAt: null },
        _sum:   { totalAmount: true, paidAmount: true },
        _count: { id: true },
      }),

      // مرتجعات العملاء
      prisma.returnInvoice.aggregate({
        where: { status: 'approved', type: 'customer_return', ...sf },
        _sum:  { totalAmount: true },
      }),

      // مشتريات
      prisma.purchaseInvoice.aggregate({
        where: { status: 'approved', ...sf },
        _sum:  { totalAmount: true },
        _count: { id: true },
      }),

      // مرتجعات موردين
      prisma.returnInvoice.aggregate({
        where: { status: 'approved', type: 'supplier_return', ...sf },
        _sum:  { totalAmount: true },
      }),

      // كل counts الـ pending في query واحدة – بدل 4 queries
      Promise.all([
        prisma.saleInvoice.count({    where: { status: 'pending', deletedAt: null } }),
        prisma.purchaseInvoice.count({ where: { status: 'pending' } }),
        prisma.returnInvoice.count({   where: { status: 'pending' } }),
        prisma.transfer.count({        where: { status: 'pending' } }),
      ]),

      prisma.customer.count({ where: { isActive: true } }),
      prisma.item.count({     where: { isActive: true } }),

      // دفعات العملاء (آجل)
      prisma.payment.aggregate({
        where: { type: 'customer_payment', ...(activeSeason ? { seasonId: activeSeason.id } : {}) },
        _sum:  { amount: true },
      }),
    ]);

    // ── 3. crunch numbers locally (zero extra DB round-trips) ──────────────
    let totalSales = 0, salesCount = 0;
    let cashSalesTotal = 0, cashSalesCount = 0, cashCollected = 0;
    let creditSales = 0, creditSalesCount = 0;

    for (const row of salesByMethod) {
      const amt   = row._sum.totalAmount || 0;
      const paid  = row._sum.paidAmount  || 0;
      const cnt   = row._count.id        || 0;
      totalSales += amt;
      salesCount += cnt;

      if (row.paymentMethod === 'credit') {
        creditSales      = amt;
        creditSalesCount = cnt;
      } else {
        cashSalesTotal  += amt;
        cashSalesCount  += cnt;
        cashCollected   += paid;
      }
    }

    const customerReturns = salesReturnsAgg._sum.totalAmount    || 0;
    const totalPurchases  = purchasesAgg._sum.totalAmount       || 0;
    const purchasesCount  = purchasesAgg._count.id              || 0;
    const supplierReturns = supplierReturnsAgg._sum.totalAmount || 0;

    const netSales     = totalSales    - customerReturns;
    const netPurchases = totalPurchases - supplierReturns;
    const grossProfit  = netSales - netPurchases;

    const collected    = paymentsAgg._sum.amount || 0;
    const outstanding  = creditSales - collected;

    const [pendingSales, pendingPurchases, pendingReturns, pendingTransfers] = pendingCounts;

    res.json({
      season: activeSeason ? { ...activeSeason, _id: activeSeason.id } : null,

      // مبيعات
      totalSales, salesCount, customerReturns, netSales,
      cashSalesTotal, cashSalesCount,
      creditSales, creditSalesCount,

      // مشتريات
      totalPurchases, purchasesCount, supplierReturns, netPurchases,

      // ربح
      grossProfit,
      profitMargin: netSales > 0 ? ((grossProfit / netSales) * 100).toFixed(1) : 0,

      // تحصيل
      cashCollected,
      collected,
      totalCollectedAll: cashCollected + collected,
      outstanding,

      // انتظار
      pending: {
        sales:     pendingSales,
        purchases: pendingPurchases,
        returns:   pendingReturns,
        transfers: pendingTransfers,
      },

      totalCustomers,
      totalItems,
    });
  } catch (err) {
    console.error('getGeneralStats:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// getTodayMovements  –  unchanged logic, kept for other consumers
// ─────────────────────────────────────────────────────────────────────────────
const getTodayMovements = async (req, res) => {
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end   = new Date(); end.setHours(23, 59, 59, 999);
    const range = { gte: start, lte: end };

    const SELECT_USER = { createdBy: { select: { name: true } } };

    const [sales, purchases, returns, transfers] = await Promise.all([
      prisma.saleInvoice.findMany({
        where:   { createdAt: range, deletedAt: null },
        select:  { id: true, invoiceNumber: true, customerName: true, totalAmount: true, paidAmount: true, paymentMethod: true, status: true, createdAt: true, createdBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.purchaseInvoice.findMany({
        where:   { createdAt: range },
        select:  { id: true, invoiceNumber: true, supplierName: true, totalAmount: true, status: true, createdAt: true, createdBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.returnInvoice.findMany({
        where:   { createdAt: range },
        select:  { id: true, invoiceNumber: true, type: true, totalAmount: true, status: true, createdAt: true, createdBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transfer.findMany({
        where:   { createdAt: range },
        select:  { id: true, transferNumber: true, fromWarehouse: true, toWarehouse: true, status: true, createdAt: true, createdBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const approved       = sales.filter(s => s.status === 'approved');
    const salesTotal     = approved.reduce((s, i) => s + i.totalAmount, 0);
    const cashTotal      = approved.filter(i => i.paymentMethod !== 'credit').reduce((s, i) => s + i.paidAmount, 0);
    const creditTotal    = approved.filter(i => i.paymentMethod === 'credit').reduce((s, i) => s + i.totalAmount, 0);
    const purchasesTotal = purchases.filter(p => p.status === 'approved').reduce((s, i) => s + i.totalAmount, 0);

    res.json({
      sales:    sales.map(n),
      purchases: purchases.map(n),
      returns:  returns.map(n),
      transfers: transfers.map(n),
      date: new Date(),
      salesTotal, cashTotal, creditTotal, purchasesTotal,
    });
  } catch (err) {
    console.error('getTodayMovements:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// getStockReport
// ─────────────────────────────────────────────────────────────────────────────
const getStockReport = async (req, res) => {
  try {
    const { warehouse } = req.query;

    const items = await prisma.item.findMany({
      where:   { isActive: true },
      select:  { id: true, code: true, name: true, category: true, unit: true, lastPurchasePrice: true, lastSalePrice: true },
      orderBy: { code: 'asc' },
    });

    // جلب المخزون من ItemStock table
    const allStocks = await prisma.itemStock.findMany({
      where: { itemId: { in: items.map(i => i.id) } },
      select: { itemId: true, warehouse: true, quantity: true, weight: true },
    });

    const stockMap = {};
    for (const s of allStocks) {
      if (!stockMap[s.itemId]) stockMap[s.itemId] = {};
      stockMap[s.itemId][s.warehouse] = { quantity: s.quantity, weight: s.weight };
    }

    const report = items.map(item => {
      const s = stockMap[item.id] || {};
      return {
        _id: item.id, code: item.code, name: item.name,
        category: item.category || '', unit: item.unit,
        ramses:  { quantity: s.ramses?.quantity  || 0, weight: s.ramses?.weight  || 0 },
        october: { quantity: s.october?.quantity || 0, weight: s.october?.weight || 0 },
        lastPurchasePrice: item.lastPurchasePrice || 0,
        lastSalePrice:     item.lastSalePrice     || 0,
      };
    });

    const filtered = warehouse
      ? report.filter(i => (i[warehouse]?.quantity || 0) > 0)
      : report;

    res.json(filtered);
  } catch (err) {
    console.error('getStockReport:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// getUserMovements
// ─────────────────────────────────────────────────────────────────────────────
const getUserMovements = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.gte = new Date(startDate);
      if (endDate)   dateFilter.createdAt.lte = new Date(new Date(endDate).setHours(23, 59, 59));
    }

    const [sales, purchases, returns, transfers] = await Promise.all([
      prisma.saleInvoice.findMany({
        where:   { createdById: userId, ...dateFilter, deletedAt: null },
        select:  { id: true, invoiceNumber: true, customerName: true, totalAmount: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.purchaseInvoice.findMany({
        where:   { createdById: userId, ...dateFilter },
        select:  { id: true, invoiceNumber: true, supplierName: true, totalAmount: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.returnInvoice.findMany({
        where:   { createdById: userId, ...dateFilter },
        select:  { id: true, invoiceNumber: true, type: true, totalAmount: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transfer.findMany({
        where:   { createdById: userId, ...dateFilter },
        select:  { id: true, transferNumber: true, fromWarehouse: true, toWarehouse: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      sales:     sales.map(n),
      purchases: purchases.map(n),
      returns:   returns.map(n),
      transfers: transfers.map(n),
    });
  } catch (err) {
    console.error('getUserMovements:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// getCustomerItemPrices
// ─────────────────────────────────────────────────────────────────────────────
const getCustomerItemPrices = async (req, res) => {
  try {
    const { customerId } = req.params;

    const invoices = await prisma.saleInvoice.findMany({
      where:   { customerId, status: 'approved', deletedAt: null },
      select:  { date: true, invoiceNumber: true, items: { select: { itemCode: true, itemName: true, price: true } } },
      orderBy: { date: 'desc' },
    });

    const lastPrices = {};
    for (const inv of invoices) {
      for (const item of inv.items) {
        if (!lastPrices[item.itemCode]) {
          lastPrices[item.itemCode] = {
            itemName: item.itemName,
            price: item.price,
            date: inv.date,
            invoiceNumber: inv.invoiceNumber,
          };
        }
      }
    }

    res.json(Object.entries(lastPrices).map(([code, data]) => ({ code, ...data })));
  } catch (err) {
    console.error('getCustomerItemPrices:', err.message);
    res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
const n = x => ({ ...x, _id: x.id });

module.exports = {
  getGeneralStats,
  getTodayMovements,
  getStockReport,
  getUserMovements,
  getCustomerItemPrices,
};
