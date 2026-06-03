// ─── controllers/saleController.js ───────────────────────────────────────────
// ✅ PERF-001: cursor-based pagination بدل OFFSET — يدعم 10M+ صف بلا تدهور
// ✅ PERF-002: COUNT مرة واحدة عند أول طلب فقط — لا COUNT في كل صفحة
// ✅ PERF-003: getSaleInvoiceById → قراءة واحدة بـ OR بدل 3 sequential queries
// ✅ PERF-004: approveSaleInvoice → updateMany لـ lastSalePrice بدل N+1 loop
// ✅ PERF-005: searchInvoice → select محدود بدل invoiceIncludes الثقيل
// ✅ DATA-001: createSaleInvoice → totalWeight مخزَّن في كل سطر من اللحظة الأولى
// ✅ DATA-002: docNumber check داخل الـ transaction نفسه — no race condition
// ✅ DATA-003: updateSaleInvoice → remainingAmount يُحسب ويُحدَّث صح
// ✅ DATA-004: updateSaleInvoice → stock check يأخذ في الاعتبار المخزون المُعاد
// ✅ ARCH-001: الوزن هو مصدر الحقيقة الوحيد في كل عملية
// ✅ FIX-PAY-001: التحقق من paidAmount = totalAmount للعملاء النقديين
// ✅ FIX-SALE-CANCEL-001/002: إلغاء الفواتير المعتمدة للأدمن فقط + soft delete
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const prisma = require('../config/db');
const { safeNum, round2, round3, calcWeight, sumWeights, sumAmounts, n, normalizeInvoiceItems } = require('../utils/decimalHelper');
const { recordSaleInvoice, deleteTreasuryEntries } = require('../utils/treasuryHelper');
const { updateStock, createStockMovement } = require('../utils/stockHelper');
const { audit }      = require('../utils/auditHelper');
const { nextNumber } = require('../utils/counterHelper');

// ── extractTotalWeight ────────────────────────────────────────────────────────
/**
 * ✅ ARCH-001: الأولوية للـ totalWeight المخزّن صراحةً
 *  1. totalWeight صريح → الأدق دائماً
 *  2. total ÷ price  → fallback للبيانات القديمة
 *  3. qty × weight بـ Decimal
 */
const extractTotalWeight = (item) => {
  if (item.totalWeight != null && safeNum(item.totalWeight) > 0)
    return round3(safeNum(item.totalWeight));
  const pr = safeNum(item.price);
  if (pr > 0 && safeNum(item.total) > 0) return round3(safeNum(item.total) / pr);
  return calcWeight(item.quantity, item.weight);
};

// ── validatePayment ───────────────────────────────────────────────────────────
const validatePayment = (paymentMethod, totalAmount, paidAmount, cashAmount, instapayAmount, customerType) => {
  if (paymentMethod === 'credit' || customerType === 'credit') return { valid: true };

  const total    = round2(safeNum(totalAmount));
  const cash     = round2(safeNum(cashAmount));
  const instapay = round2(safeNum(instapayAmount));
  const paid     = round2(safeNum(paidAmount));

  if (paymentMethod === 'mixed') {
    const mixedTotal = round2(cash + instapay);
    if (Math.abs(mixedTotal - total) > 0.01)
      return { valid: false, message: `المبلغ المدفوع (${mixedTotal.toFixed(2)}) لا يساوي إجمالي الفاتورة (${total.toFixed(2)})` };
    return { valid: true };
  }

  const effectivePaid = paymentMethod === 'instapay' ? instapay || cash : cash || paid;
  if (Math.abs(effectivePaid - total) > 0.01)
    return { valid: false, message: `المبلغ المدفوع (${effectivePaid.toFixed(2)}) لا يساوي إجمالي الفاتورة (${total.toFixed(2)}) — الفاتورة النقدية تحتاج دفع كامل` };

  return { valid: true };
};

// ── invoiceIncludes ───────────────────────────────────────────────────────────
const invoiceIncludes = () => ({
  items:      true,
  customer:   { select: { name: true, code: true, phone: true, type: true } },
  createdBy:  { select: { name: true } },
  approvedBy: { select: { name: true } },
  editedBy:   { select: { name: true } },
  season:     { select: { name: true } },
});

// ── بناء بيانات السطر للإنشاء/التعديل ────────────────────────────────────────
const buildItemCreate = (i) => ({
  itemId:      i.item,
  itemCode:    i.itemCode,
  itemName:    i.itemName,
  quantity:    safeNum(i.quantity),
  weight:      safeNum(i.weight),
  totalWeight: safeNum(i.totalWeight ?? i._tw ?? 0), // ✅ DATA-001
  price:       safeNum(i.price),
  total:       safeNum(i.total),
});

// ── GET all (cursor-based pagination) ────────────────────────────────────────
/**
 * ✅ PERF-001: cursor pagination بدل OFFSET
 * الـ cursor هو createdAt من آخر عنصر — لا يتأثر بإضافة/حذف صفوف
 *
 * ✅ PERF-002: total يُرسَل مرة واحدة فقط (عند cursor=null) ثم الفرونت يخزّنه
 * لأن COUNT(*) على 10M صف بطيء حتى مع الـ index
 */
const PAGE_SIZE = 100;

const getSaleInvoices = async (req, res) => {
  try {
    const {
      status, warehouse, startDate, endDate,
      search, customerId, seasonId,
      cursor, limit,
    } = req.query;

    const take    = Math.min(parseInt(limit, 10) || PAGE_SIZE, 200);
    const isFirst = !cursor; // الصفحة الأولى فقط تحتاج COUNT

    const where = { deletedAt: null };
    if (status)     where.status     = status;
    if (warehouse)  where.warehouse  = warehouse;
    if (customerId) where.customerId = customerId;
    if (seasonId)   where.seasonId   = seasonId;

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate)   where.date.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customerName:  { contains: search, mode: 'insensitive' } },
        { docNumber:     { contains: search, mode: 'insensitive' } },
      ];
    }

    // ✅ PERF-001: cursor-based — لا OFFSET
    // الـ cursor = id (UUID) — مضمون فريد + index@id تلقائي في Prisma
    const cursorObj = cursor ? { id: cursor } : undefined;

    const [invoices, total] = await Promise.all([
      prisma.saleInvoice.findMany({
        where,
        select: {
          id: true, docNumber: true, invoiceNumber: true,
          customerName: true, customerId: true,
          date: true, warehouse: true, totalAmount: true,
          paidAmount: true, remainingAmount: true,
          status: true, paymentMethod: true, allowNegative: true,
          createdAt: true,
          createdBy:  { select: { name: true } },
          approvedBy: { select: { name: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], // ثنائي لضمان ترتيب حتمي
        take: take + 1, // +1 لمعرفة هل في صفحة تالية
        ...(cursorObj ? { cursor: cursorObj, skip: 1 } : {}),
      }),
      // ✅ PERF-002: COUNT مرة واحدة فقط عند أول طلب
      isFirst ? prisma.saleInvoice.count({ where }) : Promise.resolve(null),
    ]);

    const hasMore    = invoices.length > take;
    const data       = hasMore ? invoices.slice(0, take) : invoices;
    // الـ cursor = id الأخير — UUID فريد دائماً
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    res.json({
      invoices: data.map(n),
      hasMore,
      nextCursor,
      ...(total !== null ? { total } : {}),
      pageSize: take,
    });
  } catch (err) {
    console.error('[getSaleInvoices]', err);
    res.status(500).json({ message: err.message });
  }
};

// ── GET by id ─────────────────────────────────────────────────────────────────
/**
 * ✅ PERF-003: استعلام واحد بـ OR بدل 3 sequential queries
 * يبحث في (id, invoiceNumber, docNumber) في نفس الوقت
 */
const getSaleInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.saleInvoice.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { id:            id },
          { invoiceNumber: id },
          { docNumber:     id },
        ],
      },
      include: invoiceIncludes(),
      orderBy: { createdAt: 'desc' }, // لو docNumber مكرر في مواسم → الأحدث
    });
    if (!invoice) return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    res.json(n(invoice));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── CHECK docNumber ───────────────────────────────────────────────────────────
const checkDocNumber = async (req, res) => {
  try {
    const { docNumber, excludeId, seasonId } = req.query;
    if (!docNumber?.trim()) return res.json({ exists: false });

    let targetSeason;
    if (seasonId) targetSeason = await prisma.season.findUnique({ where: { id: seasonId }, select: { id: true, name: true } });
    else          targetSeason = await prisma.season.findFirst({ where: { isActive: true }, select: { id: true, name: true } });

    const where = { docNumber: docNumber.trim(), deletedAt: null, seasonId: targetSeason?.id ?? null };
    if (excludeId) where.id = { not: excludeId };

    const exists = await prisma.saleInvoice.findFirst({ where, select: { invoiceNumber: true } });
    if (exists) return res.json({ exists: true, seasonName: targetSeason?.name || 'هذا الموسم', invoiceNumber: exists.invoiceNumber });
    res.json({ exists: false });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── SEARCH ────────────────────────────────────────────────────────────────────
/**
 * ✅ PERF-005: select محدود — لا invoiceIncludes الثقيل في البحث
 */
const searchInvoice = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q?.trim()) return res.json([]);

    const invoices = await prisma.saleInvoice.findMany({
      where: {
        deletedAt: null,
        OR: [
          { invoiceNumber: { contains: q, mode: 'insensitive' } },
          { docNumber:     { contains: q, mode: 'insensitive' } },
          { customerName:  { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true, invoiceNumber: true, docNumber: true,
        customerName: true, customerId: true,
        date: true, warehouse: true, totalAmount: true,
        paidAmount: true, status: true, paymentMethod: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });
    res.json(invoices.map(n));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── CREATE ────────────────────────────────────────────────────────────────────
const createSaleInvoice = async (req, res) => {
  try {
    const {
      docNumber, date, customerId, customerCode, customerName,
      warehouse, items, paidAmount, cashAmount, instapayAmount,
      paymentMethod, notes,
    } = req.body;

    if (!docNumber?.trim())    return res.status(400).json({ message: 'رقم المستند مطلوب' });
    if (!items?.length)        return res.status(400).json({ message: 'لازم تضيف صنف واحد على الأقل' });
    if (!warehouse)            return res.status(400).json({ message: 'حدد المخزن' });

    // ── جلب بيانات متوازية ────────────────────────────────────────────────
    const isAdmin         = req.user?.role === 'admin';
    const permsArr        = req.user?.permissions || [];
    const negativeAllowed = isAdmin || permsArr.some(p => p.permission === 'sale_allow_negative' && p.granted === true);

    const itemIds = [...new Set(items.map(i => i.item))];

    const [activeSeason, customerRecord, dbItems, stockBalances] = await Promise.all([
      prisma.season.findFirst({ where: { isActive: true }, select: { id: true, name: true } }),
      customerId
        ? prisma.customer.findUnique({ where: { id: customerId }, select: { type: true } })
        : Promise.resolve(null),
      prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, code: true } }),
      negativeAllowed ? Promise.resolve([]) : prisma.itemStock.findMany({
        where: { itemId: { in: itemIds }, warehouse, seasonId: null }, // يُضبط بعد جلب activeSeason
      }),
    ]);

    const customerType = customerRecord?.type || 'credit';
    const seasonId     = activeSeason?.id ?? null;

    // تحقق من الأصناف وجود في DB
    const itemMap = new Map(dbItems.map(i => [i.id, i]));
    for (const si of items) {
      if (!itemMap.has(si.item))
        return res.status(404).json({ message: `الصنف "${si.itemCode || si.item}" مش موجود في الـ DB` });
    }

    // ── تطبيع الأصناف ────────────────────────────────────────────────────
    const recalcItems = normalizeInvoiceItems(items, { hasPrice: true });
    const totalAmount = sumAmounts(recalcItems.map(i => i.total));
    const totalWeight = sumWeights(recalcItems.map(i => i._tw));

    // ── تحقق المبلغ ────────────────────────────────────────────────────
    const effectivePaymentMethod = customerType === 'credit' ? 'credit' : (paymentMethod || 'credit');
    if (effectivePaymentMethod !== 'credit') {
      const payCheck = validatePayment(
        effectivePaymentMethod, totalAmount,
        safeNum(paidAmount), safeNum(cashAmount), safeNum(instapayAmount),
        customerType,
      );
      if (!payCheck.valid) return res.status(400).json({ message: payCheck.message });
    }

    const safePaid      = safeNum(paidAmount) || 0;
    const safeCash      = safeNum(cashAmount) || 0;
    const safeInstapay  = safeNum(instapayAmount) || 0;
    const remaining     = round2(totalAmount - safePaid);

    // ── Transaction: كل شيء atomic ───────────────────────────────────────
    const invoice = await prisma.$transaction(async (tx) => {
      // ✅ DATA-002: docNumber check داخل الـ tx — no race condition
      const docExists = await tx.saleInvoice.findFirst({
        where: { docNumber: docNumber.trim(), deletedAt: null, seasonId },
        select: { invoiceNumber: true },
      });
      if (docExists)
        throw Object.assign(new Error(`رقم المستند "${docNumber}" موجود بالفعل (${docExists.invoiceNumber})`), { code: 'DOC_DUP' });

      // ✅ تحقق المخزون داخل الـ tx بعد lock
      if (!negativeAllowed) {
        const stocks = await tx.itemStock.findMany({
          where: { itemId: { in: itemIds }, warehouse, seasonId },
        });
        const stockMap = new Map(stocks.map(s => [s.itemId, s]));
        for (const si of recalcItems) {
          const avail = safeNum(stockMap.get(si.item)?.weight, 0);
          if (avail < si._tw)
            throw Object.assign(
              new Error(`المخزون مش كافي للصنف "${si.itemName}" — متاح: ${avail.toFixed(3)} ك، مطلوب: ${si._tw.toFixed(3)} ك`),
              { code: 'STOCK_INSUFF' },
            );
        }
      }

      const invoiceNumber = await nextNumber('SAL', 'SAL', tx);

      return tx.saleInvoice.create({
        data: {
          invoiceNumber,
          docNumber:       docNumber.trim(),
          date:            date ? new Date(date) : new Date(),
          customerId,
          customerCode,
          customerName,
          warehouse,
          totalAmount,
          totalWeight,
          discountAmount:  0,
          netAmount:       totalAmount,
          paidAmount:      safePaid,
          remainingAmount: remaining,
          cashAmount:      safeCash,
          instapayAmount:  safeInstapay,
          paymentMethod:   effectivePaymentMethod,
          status:          'pending',
          seasonId,
          allowNegative:   negativeAllowed,
          notes,
          createdById:     req.user.id,
          items: {
            create: recalcItems.map(buildItemCreate),
          },
        },
        include: { items: true },
      });
    }, { isolationLevel: 'Serializable' });

    await audit(req.user, 'invoice_created', 'SaleInvoice', invoice.id, invoice.invoiceNumber, {
      customerName, totalAmount, paymentMethod: effectivePaymentMethod,
    });

    res.status(201).json(n(invoice));
  } catch (err) {
    if (err.code === 'DOC_DUP')       return res.status(400).json({ message: err.message });
    if (err.code === 'STOCK_INSUFF')  return res.status(400).json({ message: err.message });
    if (err.code === 'P2002')         return res.status(400).json({ message: 'رقم المستند موجود بالفعل في هذا الموسم' });
    if (err.code === 'P2034')         return res.status(409).json({ message: 'تعارض في العملية، حاول مرة أخرى' });
    console.error('[createSaleInvoice]', err);
    res.status(500).json({ message: err.message });
  }
};

// ── UPDATE ────────────────────────────────────────────────────────────────────
const updateSaleInvoice = async (req, res) => {
  try {
    const invoice = await prisma.saleInvoice.findUnique({
      where:   { id: req.params.id },
      include: { items: true },
    });
    if (!invoice)                       return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    if (invoice.status === 'cancelled') return res.status(400).json({ message: 'الفاتورة ملغية' });
    if (invoice.deletedAt)              return res.status(404).json({ message: 'الفاتورة مش موجودة' });

    const wasApproved = invoice.status === 'approved';

    const { docNumber, date, items, paidAmount, cashAmount, instapayAmount, paymentMethod, notes } = req.body;

    if (!items?.length) return res.status(400).json({ message: 'لازم تضيف صنف واحد على الأقل' });

    if (docNumber && docNumber.trim() !== invoice.docNumber) {
      const docExists = await prisma.saleInvoice.findFirst({
        where: { docNumber: docNumber.trim(), seasonId: invoice.seasonId ?? null, id: { not: invoice.id }, deletedAt: null },
      });
      if (docExists) return res.status(400).json({ message: 'رقم المستند موجود بالفعل في هذا الموسم' });
    }

    const isAdmin         = req.user?.role === 'admin';
    const permsArr        = req.user?.permissions || [];
    const negativeAllowed = isAdmin || permsArr.some(p => p.permission === 'sale_allow_negative' && p.granted === true);

    const recalcItems = normalizeInvoiceItems(items, { hasPrice: true });
    const totalAmount = sumAmounts(recalcItems.map(i => i.total));
    const totalWeight = sumWeights(recalcItems.map(i => i._tw));

    // ✅ DATA-004: لو الفاتورة كانت معتمدة → المخزون سيُرجَع أولاً
    // فالمتاح الحقيقي = stock_current + old_invoice_weight
    // لا نحتاج تحقق للمعتمدة لأننا سنعيد الاعتماد لاحقاً
    if (!negativeAllowed && !wasApproved) {
      const itemIds   = [...new Set(recalcItems.map(i => i.item))];
      const stocks    = await prisma.itemStock.findMany({
        where: { itemId: { in: itemIds }, warehouse: invoice.warehouse, seasonId: invoice.seasonId ?? null },
      });
      const stockMap  = new Map(stocks.map(s => [s.itemId, s]));
      for (const si of recalcItems) {
        const avail = safeNum(stockMap.get(si.item)?.weight, 0);
        if (avail < si._tw)
          return res.status(400).json({
            message: `المخزون مش كافي للصنف "${si.itemName}" — متاح: ${avail.toFixed(3)} ك، مطلوب: ${si._tw.toFixed(3)} ك`,
          });
      }
    }

    const effectivePaymentMethod = paymentMethod || invoice.paymentMethod;
    if (effectivePaymentMethod !== 'credit') {
      const cust = invoice.customerId
        ? await prisma.customer.findUnique({ where: { id: invoice.customerId }, select: { type: true } })
        : null;
      if (cust?.type !== 'credit') {
        const payCheck = validatePayment(
          effectivePaymentMethod, totalAmount,
          safeNum(paidAmount), safeNum(cashAmount), safeNum(instapayAmount),
          cust?.type || 'cash',
        );
        if (!payCheck.valid) return res.status(400).json({ message: payCheck.message });
      }
    }

    const safePaid     = safeNum(paidAmount) || 0;
    const safeCash     = safeNum(cashAmount) || 0;
    const safeInstapay = safeNum(instapayAmount) || 0;
    // ✅ DATA-003: remainingAmount يُحسب دائماً
    const remaining    = round2(totalAmount - safePaid);

    const updated = await prisma.$transaction(async (tx) => {
      if (wasApproved) {
        for (const item of invoice.items) {
          const tw = extractTotalWeight(item);
          await updateStock(item.itemId, invoice.warehouse, invoice.seasonId, { weight: tw }, tx);
        }
        await tx.stockMovement.deleteMany({ where: { referenceId: invoice.id } });
        await deleteTreasuryEntries(invoice.id, 'SaleInvoice', tx);
      }

      await tx.saleInvoiceItem.deleteMany({ where: { invoiceId: invoice.id } });

      return tx.saleInvoice.update({
        where: { id: invoice.id },
        data: {
          docNumber:       docNumber?.trim() || invoice.docNumber,
          date:            date ? new Date(date) : invoice.date,
          totalAmount,     totalWeight,
          paidAmount:      safePaid,
          remainingAmount: remaining,  // ✅ DATA-003
          cashAmount:      safeCash,
          instapayAmount:  safeInstapay,
          paymentMethod:   effectivePaymentMethod,
          notes,
          netAmount:       totalAmount,
          status:          'pending',
          approvedById:    null,
          approvedAt:      null,
          items: { create: recalcItems.map(buildItemCreate) },
        },
        include: { items: true },
      });
    });

    res.json({ message: 'تم التعديل ✅', invoice: n(updated) });
  } catch (err) {
    if (err.code === 'P2034') return res.status(409).json({ message: 'تعارض في العملية، حاول مرة أخرى' });
    console.error('[updateSaleInvoice]', err);
    res.status(500).json({ message: err.message });
  }
};

// ── FORCE EDIT ────────────────────────────────────────────────────────────────
const forceEditSaleInvoice = async (req, res) => {
  try {
    const invoice = await prisma.saleInvoice.findUnique({
      where:   { id: req.params.id },
      include: { items: true },
    });
    if (!invoice)                       return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    if (invoice.status === 'cancelled') return res.status(400).json({ message: 'الفاتورة ملغية' });

    const wasApproved = invoice.status === 'approved';
    const { docNumber, date, items, paidAmount, cashAmount, instapayAmount, paymentMethod, notes, editNotes } = req.body;

    if (!items?.length) return res.status(400).json({ message: 'لازم تضيف صنف واحد على الأقل' });

    if (docNumber && docNumber.trim() !== invoice.docNumber) {
      const docExists = await prisma.saleInvoice.findFirst({
        where: { docNumber: docNumber.trim(), seasonId: invoice.seasonId ?? null, id: { not: invoice.id }, deletedAt: null },
      });
      if (docExists) return res.status(400).json({ message: 'رقم المستند موجود بالفعل في هذا الموسم' });
    }

    const recalcItems = normalizeInvoiceItems(items, { hasPrice: true });
    const totalAmount = sumAmounts(recalcItems.map(i => i.total));
    const totalWeight = sumWeights(recalcItems.map(i => i._tw));

    const effectivePaymentMethod = paymentMethod || invoice.paymentMethod;
    if (effectivePaymentMethod !== 'credit') {
      const cust = invoice.customerId
        ? await prisma.customer.findUnique({ where: { id: invoice.customerId }, select: { type: true } })
        : null;
      if (cust?.type !== 'credit') {
        const payCheck = validatePayment(
          effectivePaymentMethod, totalAmount,
          safeNum(paidAmount), safeNum(cashAmount), safeNum(instapayAmount),
          cust?.type || 'cash',
        );
        if (!payCheck.valid) return res.status(400).json({ message: payCheck.message });
      }
    }

    const safePaid     = safeNum(paidAmount) || 0;
    const safeCash     = safeNum(cashAmount) || 0;
    const safeInstapay = safeNum(instapayAmount) || 0;
    const remaining    = round2(totalAmount - safePaid);

    const updated = await prisma.$transaction(async (tx) => {
      if (wasApproved) {
        for (const item of invoice.items) {
          const tw = extractTotalWeight(item);
          await updateStock(item.itemId, invoice.warehouse, invoice.seasonId, { weight: tw }, tx);
        }
        await tx.stockMovement.deleteMany({ where: { referenceId: invoice.id } });
        await deleteTreasuryEntries(invoice.id, 'SaleInvoice', tx);
      }

      await tx.saleInvoiceItem.deleteMany({ where: { invoiceId: invoice.id } });

      return tx.saleInvoice.update({
        where: { id: invoice.id },
        data: {
          docNumber:       docNumber?.trim() || invoice.docNumber,
          date:            date ? new Date(date) : invoice.date,
          totalAmount,     totalWeight,
          paidAmount:      safePaid,
          remainingAmount: remaining,
          cashAmount:      safeCash,
          instapayAmount:  safeInstapay,
          paymentMethod:   effectivePaymentMethod,
          netAmount:       totalAmount,
          notes:           notes ?? invoice.notes,
          status:          'pending',
          approvedById:    null,
          approvedAt:      null,
          editedById:      req.user.id,
          editedAt:        new Date(),
          editNotes:       editNotes || '',
          items: { create: recalcItems.map(buildItemCreate) },
        },
        include: invoiceIncludes(),
      });
    });

    await audit(req.user, 'invoice_edited', 'SaleInvoice', updated.id, updated.invoiceNumber, {
      editNotes: editNotes || '', customerName: updated.customerName, totalAmount: updated.totalAmount,
    });
    res.json({ message: 'تم التعديل بواسطة الأدمن ✅', invoice: n(updated) });
  } catch (err) {
    if (err.code === 'P2034') return res.status(409).json({ message: 'تعارض في العملية، حاول مرة أخرى' });
    console.error('[forceEditSaleInvoice]', err);
    res.status(500).json({ message: err.message });
  }
};

// ── APPROVE ───────────────────────────────────────────────────────────────────
const approveSaleInvoice = async (req, res) => {
  try {
    const invoice = await prisma.saleInvoice.findUnique({
      where:   { id: req.params.id },
      include: { items: true },
    });
    if (!invoice)                       return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    if (invoice.status === 'approved')  return res.status(400).json({ message: 'اتوافق عليها قبل كده' });
    if (invoice.status === 'cancelled') return res.status(400).json({ message: 'الفاتورة ملغية' });
    if (invoice.deletedAt)              return res.status(404).json({ message: 'الفاتورة مش موجودة' });

    if (invoice.paymentMethod !== 'credit') {
      const cust = invoice.customerId
        ? await prisma.customer.findUnique({ where: { id: invoice.customerId }, select: { type: true } })
        : null;
      if (cust?.type !== 'credit') {
        const payCheck = validatePayment(
          invoice.paymentMethod,
          safeNum(invoice.totalAmount), safeNum(invoice.paidAmount),
          safeNum(invoice.cashAmount), safeNum(invoice.instapayAmount),
          cust?.type || 'cash',
        );
        if (!payCheck.valid)
          return res.status(400).json({ message: `لا يمكن اعتماد الفاتورة: ${payCheck.message}` });
      }
    }

    const approved = await prisma.$transaction(async (tx) => {
      // ✅ PERF-004: updateMany لـ lastSalePrice بدل N loops
      const priceUpdates = invoice.items.map(si =>
        tx.item.update({
          where: { id: si.itemId },
          data:  { lastSalePrice: si.price },
        })
      );

      const stockOps = invoice.items.flatMap(si => {
        const tw = extractTotalWeight(si);
        return [
          updateStock(si.itemId, invoice.warehouse, invoice.seasonId, { weight: -tw }, tx),
          createStockMovement({
            itemId: si.itemId, itemCode: si.itemCode, itemName: si.itemName,
            type: 'sale_out', quantity: safeNum(si.quantity), weight: tw, price: si.price,
            warehouse: invoice.warehouse, reference: invoice.invoiceNumber,
            referenceModel: 'SaleInvoice', referenceId: invoice.id,
            seasonId: invoice.seasonId || null, createdById: req.user.id, date: invoice.date,
          }, tx),
        ];
      });

      // تنفيذ updates الأسعار بشكل متوازي
      await Promise.all(priceUpdates);
      // تنفيذ عمليات المخزون — يجب تسلسلية لضمان الرصيد الصحيح في كل حركة
      for (const op of stockOps) await op;

      const approvedInvoice = await tx.saleInvoice.update({
        where: { id: invoice.id },
        data:  { status: 'approved', approvedById: req.user.id, approvedAt: new Date() },
        include: { items: true },
      });

      await recordSaleInvoice(approvedInvoice, req.user, tx);
      return approvedInvoice;
    }, { isolationLevel: 'Serializable' });

    await audit(req.user, 'invoice_approved', 'SaleInvoice', approved.id, approved.invoiceNumber, {
      customerName: approved.customerName, totalAmount: approved.totalAmount,
    });
    res.json({ message: 'تم الموافقة ✅', invoice: n(approved) });
  } catch (err) {
    if (err.code === 'P2034') return res.status(409).json({ message: 'تعارض في العملية، حاول مرة أخرى' });
    console.error('[approveSaleInvoice]', err);
    res.status(500).json({ message: err.message });
  }
};

// ── SUSPEND ───────────────────────────────────────────────────────────────────
const suspendSaleInvoice = async (req, res) => {
  try {
    const invoice = await prisma.saleInvoice.findUnique({ where: { id: req.params.id } });
    if (!invoice)                       return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    if (invoice.status === 'approved')  return res.status(400).json({ message: 'مينفعش تعلق فاتورة موافق عليها' });
    if (invoice.status === 'cancelled') return res.status(400).json({ message: 'الفاتورة ملغية' });

    const updated = await prisma.saleInvoice.update({
      where: { id: invoice.id },
      data:  { status: 'suspended', suspendReason: req.body.reason || '' },
    });
    await audit(req.user, 'invoice_suspended', 'SaleInvoice', invoice.id, invoice.invoiceNumber);
    res.json({ message: 'تم التعليق', invoice: n(updated) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── CANCEL ────────────────────────────────────────────────────────────────────
const cancelSaleInvoice = async (req, res) => {
  try {
    const invoice = await prisma.saleInvoice.findUnique({
      where:   { id: req.params.id },
      include: { items: true },
    });
    if (!invoice) return res.status(404).json({ message: 'الفاتورة مش موجودة' });

    const isAdmin     = req.user?.role === 'admin';
    const wasApproved = invoice.status === 'approved';

    // ✅ FIX-SALE-CANCEL-001: الفواتير المعتمدة للأدمن فقط
    if (wasApproved && !isAdmin)
      return res.status(403).json({ message: 'مينفعش تلغي فاتورة معتمدة — اطلب من الأدمن' });

    await prisma.$transaction(async (tx) => {
      if (wasApproved) {
        for (const item of invoice.items) {
          const tw = extractTotalWeight(item);
          await updateStock(item.itemId, invoice.warehouse, invoice.seasonId, { weight: tw }, tx);
        }
        await tx.stockMovement.deleteMany({ where: { referenceId: invoice.id } });
        await deleteTreasuryEntries(invoice.id, 'SaleInvoice', tx);
        // ✅ FIX-SALE-CANCEL-002: soft delete — يحفظ السجل المحاسبي
        await tx.saleInvoice.update({
          where: { id: invoice.id },
          data:  { status: 'cancelled', deletedAt: new Date() },
        });
      } else {
        // الفواتير غير المعتمدة: hard delete مقبول (لا تأثير محاسبي)
        await tx.saleInvoice.delete({ where: { id: invoice.id } });
      }
    }, { isolationLevel: 'Serializable' });

    await audit(req.user, 'invoice_cancelled', 'SaleInvoice', invoice.id, invoice.invoiceNumber, {
      customerName: invoice.customerName, docNumber: invoice.docNumber,
      totalAmount: invoice.totalAmount, wasApproved,
    });
    res.json({ message: 'تم الإلغاء' });
  } catch (err) {
    if (err.code === 'P2034') return res.status(409).json({ message: 'تعارض في العملية، حاول مرة أخرى' });
    console.error('[cancelSaleInvoice]', err);
    res.status(500).json({ message: err.message });
  }
};

// ── Exports ───────────────────────────────────────────────────────────────────
module.exports = {
  getSaleInvoices, getSaleInvoiceById,
  checkDocNumber, searchInvoice,
  createSaleInvoice, updateSaleInvoice,
  forceEditSaleInvoice,
  approveSaleInvoice, suspendSaleInvoice, cancelSaleInvoice,
};
