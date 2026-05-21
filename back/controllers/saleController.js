// ─── controllers/saleController.js ───────────────────────────────────────────
// ✅ CRIT-NEW-002: كل عمليات approve/cancel/forceEdit داخل prisma.$transaction
// ✅ FLOAT-FIX: حساب الأوزان عبر calcWeight (Decimal.js) بدل الضرب المباشر
// ✅ TX-AWARE: stockHelper و treasuryHelper يقبلون tx
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const prisma = require('../config/db');
const { safeNum, round2, round3, calcWeight, calcTotal, sumWeights, sumAmounts, n } = require('../utils/decimalHelper');
const { recordSaleInvoice, deleteTreasuryEntries } = require('../utils/treasuryHelper');
const { getStockQty, updateStock, createStockMovement } = require('../utils/stockHelper');
const { audit }      = require('../utils/auditHelper');
const { nextNumber } = require('../utils/counterHelper');

// ── حساب الوزن الكلي للسطر ───────────────────────────────────────────────────
// calcWeight من decimalHelper تستخدم Decimal.js — بدل floating point
const calcItemTotalWeight = (qty, wt, totalWt = null) =>
  calcWeight(qty, wt, totalWt);

const calcItemTotal = (qty, wt, pr, totalWt = null) =>
  calcTotal(qty, wt, pr, totalWt);

// ── extractTotalWeight ────────────────────────────────────────────────────────
/**
 * يستخلص الوزن الكلي الدقيق من سطر الفاتورة:
 *  - لو السعر > 0 → نحسب total ÷ price (أدق لأن total مخزّن في DB)
 *  - غير ذلك    → نحسب qty × weight بـ Decimal.js
 */
const extractTotalWeight = (item) => {
  const pr = safeNum(item.price);
  if (pr > 0) return round3(safeNum(item.total) / pr);
  return calcWeight(item.quantity, item.weight);
};

// ── GET all ───────────────────────────────────────────────────────────────────
const getSaleInvoices = async (req, res) => {
  try {
    const { status, warehouse, startDate, endDate, search, customerId, seasonId, page = 1, limit } = req.query;

    const where = { deletedAt: null };
    if (status)     where.status     = status;
    if (warehouse)  where.warehouse  = warehouse;
    if (customerId) where.customerId = customerId;
    if (seasonId)   where.seasonId   = seasonId;

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate)   where.date.lte = new Date(new Date(endDate).setHours(23, 59, 59));
    }

    if (search && !customerId) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customerName:  { contains: search, mode: 'insensitive' } },
        { docNumber:     { contains: search, mode: 'insensitive' } },
      ];
    }

    const limitNum = limit && Number(limit) > 0 ? Number(limit) : 0;
    const skip     = (Number(page) - 1) * (limitNum || 0);

    const [invoices, total] = await Promise.all([
      prisma.saleInvoice.findMany({
        where,
        select: {
          id: true, docNumber: true, invoiceNumber: true, customerName: true,
          customerId: true, date: true, warehouse: true, totalAmount: true,
          paidAmount: true, status: true, paymentMethod: true, allowNegative: true,
          createdBy:  { select: { name: true } },
          approvedBy: { select: { name: true } },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        ...(limitNum ? { take: limitNum } : {}),
      }),
      prisma.saleInvoice.count({ where }),
    ]);

    res.json({ invoices: invoices.map(n), total, page: Number(page), limit: limitNum });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET by id ─────────────────────────────────────────────────────────────────
const getSaleInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const notDeleted = { deletedAt: null };

    let invoice = await prisma.saleInvoice.findFirst({ where: { id, ...notDeleted }, include: invoiceIncludes() }).catch(() => null);
    if (!invoice) invoice = await prisma.saleInvoice.findFirst({ where: { invoiceNumber: id, ...notDeleted }, include: invoiceIncludes() });
    if (!invoice) invoice = await prisma.saleInvoice.findFirst({ where: { docNumber: id, ...notDeleted }, include: invoiceIncludes(), orderBy: { createdAt: 'desc' } });
    if (!invoice) return res.status(404).json({ message: 'الفاتورة مش موجودة' });

    res.json(n(invoice));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── CHECK docNumber ───────────────────────────────────────────────────────────
const checkDocNumber = async (req, res) => {
  try {
    const { docNumber, excludeId, seasonId } = req.query;

    let targetSeason;
    if (seasonId) targetSeason = await prisma.season.findUnique({ where: { id: seasonId } });
    else          targetSeason = await prisma.season.findFirst({ where: { isActive: true } });

    const where = { docNumber, deletedAt: null };
    where.seasonId = targetSeason?.id ?? null;
    if (excludeId) where.id = { not: excludeId };

    const exists = await prisma.saleInvoice.findFirst({ where, select: { invoiceNumber: true, seasonId: true } });
    if (exists) return res.json({ exists: true, seasonName: targetSeason?.name || 'هذا الموسم', invoiceNumber: exists.invoiceNumber });
    res.json({ exists: false });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── SEARCH ────────────────────────────────────────────────────────────────────
const searchInvoice = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q?.trim()) return res.json([]);

    const invoices = await prisma.saleInvoice.findMany({
      where: {
        OR: [
          { invoiceNumber: { contains: q, mode: 'insensitive' } },
          { docNumber:     { contains: q, mode: 'insensitive' } },
          { customerName:  { contains: q, mode: 'insensitive' } },
        ],
      },
      include: invoiceIncludes(),
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    res.json(invoices.map(n));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── CREATE ────────────────────────────────────────────────────────────────────
const createSaleInvoice = async (req, res) => {
  try {
    const {
      docNumber, date, customerId, customerCode, customerName,
      warehouse, items, paidAmount, cashAmount, instapayAmount,
      paymentMethod, notes, allowNegative,
    } = req.body;

    const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });

    const docCheckWhere = { docNumber, deletedAt: null, seasonId: activeSeason?.id ?? null };
    const docExists = await prisma.saleInvoice.findFirst({ where: docCheckWhere });
    if (docExists)
      return res.status(400).json({ message: `رقم المستند "${docNumber}" موجود بالفعل في الموسم الحالي (${docExists.invoiceNumber})` });

    if (!items?.length) return res.status(400).json({ message: 'لازم تضيف صنف واحد على الأقل' });

    const isAdmin      = req.user?.role === 'admin';
    const permsArr     = req.user?.permissions || [];
    const negativeAllowed = isAdmin || permsArr.some(p => p.permission === 'sale_allow_negative' && p.granted === true);

    // Batch fetch — بدل N+1
    const itemIds = items.map(i => i.item);
    const [dbItems, stockBalances] = await Promise.all([
      prisma.item.findMany({ where: { id: { in: itemIds } } }),
      negativeAllowed ? [] : prisma.itemStock.findMany({
        where: { itemId: { in: itemIds }, warehouse, seasonId: activeSeason?.id ?? null },
      }),
    ]);

    const itemMap  = new Map(dbItems.map(i => [i.id, i]));
    const stockMap = new Map(stockBalances.map(s => [s.itemId, s]));

    for (const saleItem of items) {
      const dbItem = itemMap.get(saleItem.item);
      if (!dbItem) return res.status(404).json({ message: `الصنف ${saleItem.itemCode} مش موجود` });
      if (!negativeAllowed) {
        const stockQty = safeNum(stockMap.get(saleItem.item)?.quantity, 0);
        if (stockQty < saleItem.quantity)
          return res.status(400).json({ message: `المخزون مش كافي للصنف "${saleItem.itemName}" — متاح: ${stockQty} كرتون` });
      }
    }

    // ── حساب الأسطر بـ Decimal.js ────────────────────────────────────────────
    const recalcItems = items.map(i => ({
      ...i,
      _tw:   calcItemTotalWeight(i.quantity, i.weight, i.totalWeight ?? null),
      total: calcItemTotal(i.quantity, i.weight, i.price, i.totalWeight ?? null),
    }));
    const invoiceNumber = await nextNumber('SAL', 'SAL');
    const totalAmount   = sumAmounts(recalcItems.map(i => i.total));
    const totalWeight   = sumWeights(recalcItems.map(i => i._tw));

    const invoice = await prisma.saleInvoice.create({
      data: {
        invoiceNumber, docNumber,
        date:           date ? new Date(date) : new Date(),
        customerId, customerCode, customerName,
        warehouse, totalAmount, totalWeight,
        discountAmount:  0,
        netAmount:       totalAmount,
        paidAmount:      safeNum(paidAmount)     || 0,
        remainingAmount: totalAmount - (safeNum(paidAmount) || 0),
        cashAmount:      safeNum(cashAmount)     || 0,
        instapayAmount:  safeNum(instapayAmount) || 0,
        paymentMethod:   paymentMethod || 'credit',
        status:          'pending',
        seasonId:        activeSeason?.id ?? null,
        allowNegative:   negativeAllowed,
        notes,
        createdById: req.user.id,
        items: {
          create: recalcItems.map(i => ({
            itemId: i.item, itemCode: i.itemCode, itemName: i.itemName,
            quantity: safeNum(i.quantity), weight: safeNum(i.weight), price: safeNum(i.price), total: i.total,
          })),
        },
      },
      include: { items: true },
    });

    await audit(req.user, 'invoice_created', 'SaleInvoice', invoice.id, invoice.invoiceNumber, { customerName, totalAmount, paymentMethod: paymentMethod || 'credit' });
    res.status(201).json(n(invoice));
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ message: 'رقم المستند موجود بالفعل في هذا الموسم' });
    res.status(500).json({ message: err.message });
  }
};

// ── UPDATE ────────────────────────────────────────────────────────────────────
const updateSaleInvoice = async (req, res) => {
  try {
    const invoice = await prisma.saleInvoice.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!invoice)                     return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    if (invoice.status === 'cancelled') return res.status(400).json({ message: 'الفاتورة ملغية' });

    const wasApproved = invoice.status === 'approved';

    const { docNumber, date, items, paidAmount, cashAmount, instapayAmount, paymentMethod, notes } = req.body;

    if (docNumber && docNumber !== invoice.docNumber) {
      const docExists = await prisma.saleInvoice.findFirst({
        where: { docNumber, seasonId: invoice.seasonId ?? null, id: { not: invoice.id }, deletedAt: null },
      });
      if (docExists) return res.status(400).json({ message: 'رقم المستند موجود بالفعل في هذا الموسم' });
    }

    const isAdmin = req.user?.role === 'admin';
    const permsArr = req.user?.permissions || [];
    const negativeAllowed = isAdmin || permsArr.some(p => p.permission === 'sale_allow_negative' && p.granted === true);

    if (!negativeAllowed) {
      for (const saleItem of items) {
        const { quantity: stockQty } = await getStockQty(saleItem.item, invoice.warehouse, invoice.seasonId);
        if (stockQty < saleItem.quantity)
          return res.status(400).json({ message: `المخزون مش كافي للصنف "${saleItem.itemName}" — متاح: ${stockQty} كرتون` });
      }
    }

    const recalcItems = items.map(i => ({
      ...i,
      _tw:   calcItemTotalWeight(i.quantity, i.weight, i.totalWeight ?? null),
      total: calcItemTotal(i.quantity, i.weight, i.price, i.totalWeight ?? null),
    }));
    const totalAmount = sumAmounts(recalcItems.map(i => i.total));
    const totalWeight = sumWeights(recalcItems.map(i => i._tw));

    // ── Transaction: إرجاع المخزون القديم + تحديث الفاتورة ──────────────────
    const updated = await prisma.$transaction(async (tx) => {
      // لو كانت معتمدة → نرجع المخزون القديم أولاً
      if (wasApproved) {
        for (const item of invoice.items) {
          const tw = extractTotalWeight(item);
          await updateStock(item.itemId, invoice.warehouse, invoice.seasonId, { quantity: safeNum(item.quantity), weight: tw }, tx);
        }
        await tx.stockMovement.deleteMany({ where: { referenceId: invoice.id } });
        await deleteTreasuryEntries(invoice.id, 'SaleInvoice', tx);
      }

      await tx.saleInvoiceItem.deleteMany({ where: { invoiceId: invoice.id } });

      return tx.saleInvoice.update({
        where: { id: invoice.id },
        data: {
          docNumber:      docNumber || invoice.docNumber,
          date:           date ? new Date(date) : invoice.date,
          totalAmount, totalWeight,
          paidAmount:     safeNum(paidAmount)     || 0,
          cashAmount:     safeNum(cashAmount)     || 0,
          instapayAmount: safeNum(instapayAmount) || 0,
          paymentMethod:  paymentMethod || invoice.paymentMethod,
          notes,
          status:         'pending',
          approvedById:   null,
          approvedAt:     null,
          items: {
            create: recalcItems.map(i => ({
              itemId: i.item, itemCode: i.itemCode, itemName: i.itemName,
              quantity: safeNum(i.quantity), weight: safeNum(i.weight), price: safeNum(i.price), total: i.total,
            })),
          },
        },
        include: { items: true },
      });
    });

    res.json({ message: 'تم التعديل ✅', invoice: n(updated) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── FORCE EDIT ────────────────────────────────────────────────────────────────
const forceEditSaleInvoice = async (req, res) => {
  try {
    const invoice = await prisma.saleInvoice.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!invoice)                     return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    if (invoice.status === 'cancelled') return res.status(400).json({ message: 'الفاتورة ملغية' });

    const wasApproved = invoice.status === 'approved';
    const { docNumber, date, items, paidAmount, cashAmount, instapayAmount, paymentMethod, notes, editNotes } = req.body;

    if (docNumber && docNumber !== invoice.docNumber) {
      const docExists = await prisma.saleInvoice.findFirst({
        where: { docNumber, seasonId: invoice.seasonId ?? null, id: { not: invoice.id }, deletedAt: null },
      });
      if (docExists) return res.status(400).json({ message: 'رقم المستند موجود بالفعل في هذا الموسم' });
    }

    const recalcItems = items.map(i => ({
      ...i,
      _tw:   calcItemTotalWeight(i.quantity, i.weight, i.totalWeight ?? null),
      total: calcItemTotal(i.quantity, i.weight, i.price, i.totalWeight ?? null),
    }));
    const totalAmount = sumAmounts(recalcItems.map(i => i.total));
    const totalWeight = sumWeights(recalcItems.map(i => i._tw));

    // ── Transaction: كل شيء في خطوة واحدة أو لا شيء ─────────────────────────
    const updated = await prisma.$transaction(async (tx) => {
      if (wasApproved) {
        for (const item of invoice.items) {
          const tw = extractTotalWeight(item);
          await updateStock(item.itemId, invoice.warehouse, invoice.seasonId, { quantity: safeNum(item.quantity), weight: tw }, tx);
        }
        await tx.stockMovement.deleteMany({ where: { referenceId: invoice.id } });
        await deleteTreasuryEntries(invoice.id, 'SaleInvoice', tx);
      }

      await tx.saleInvoiceItem.deleteMany({ where: { invoiceId: invoice.id } });

      return tx.saleInvoice.update({
        where: { id: invoice.id },
        data: {
          docNumber:      docNumber || invoice.docNumber,
          date:           date ? new Date(date) : invoice.date,
          totalAmount, totalWeight,
          paidAmount:     safeNum(paidAmount)     || 0,
          cashAmount:     safeNum(cashAmount)     || 0,
          instapayAmount: safeNum(instapayAmount) || 0,
          paymentMethod:  paymentMethod || invoice.paymentMethod,
          notes:          notes ?? invoice.notes,
          status:         'pending',
          approvedById:   null,
          approvedAt:     null,
          editedById:     req.user.id,
          editedAt:       new Date(),
          editNotes:      editNotes || '',
          items: {
            create: recalcItems.map(i => ({
              itemId: i.item, itemCode: i.itemCode, itemName: i.itemName,
              quantity: safeNum(i.quantity), weight: safeNum(i.weight), price: safeNum(i.price), total: i.total,
            })),
          },
        },
        include: invoiceIncludes(),
      });
    });

    await audit(req.user, 'invoice_edited', 'SaleInvoice', updated.id, updated.invoiceNumber, { editNotes: editNotes || '', customerName: updated.customerName, totalAmount: updated.totalAmount });
    res.json({ message: 'تم التعديل بواسطة الأدمن ✅', invoice: n(updated) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── APPROVE ───────────────────────────────────────────────────────────────────
const approveSaleInvoice = async (req, res) => {
  try {
    const invoice = await prisma.saleInvoice.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!invoice)                     return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    if (invoice.status === 'approved')  return res.status(400).json({ message: 'اتوافق عليها قبل كده' });
    if (invoice.status === 'cancelled') return res.status(400).json({ message: 'الفاتورة ملغية' });

    // ── Transaction: خصم المخزون + تسجيل الحركات + اعتماد الفاتورة ─────────
    // لو أي خطوة فشلت → كل شيء يُرجع (Rollback)
    const approved = await prisma.$transaction(async (tx) => {
      for (const saleItem of invoice.items) {
        // استخلاص الوزن الكلي الدقيق من total ÷ price
        const tw = extractTotalWeight(saleItem);

        // خصم المخزون
        await updateStock(saleItem.itemId, invoice.warehouse, invoice.seasonId, {
          quantity: -safeNum(saleItem.quantity),
          weight:   -tw,
        }, tx);

        // تحديث آخر سعر بيع
        await tx.item.update({
          where: { id: saleItem.itemId },
          data:  { lastSalePrice: saleItem.price },
        });

        // تسجيل الحركة
        await createStockMovement({
          itemId: saleItem.itemId, itemCode: saleItem.itemCode, itemName: saleItem.itemName,
          type: 'sale_out', quantity: safeNum(saleItem.quantity), weight: tw, price: saleItem.price,
          warehouse: invoice.warehouse, reference: invoice.invoiceNumber,
          referenceModel: 'SaleInvoice', referenceId: invoice.id,
          seasonId: invoice.seasonId || null, createdById: req.user.id, date: invoice.date,
        }, tx);
      }

      // اعتماد الفاتورة
      const approvedInvoice = await tx.saleInvoice.update({
        where: { id: invoice.id },
        data:  { status: 'approved', approvedById: req.user.id, approvedAt: new Date() },
        include: { items: true },
      });

      // تسجيل قيود الخزينة داخل نفس الـ transaction
      await recordSaleInvoice(approvedInvoice, req.user, tx);

      return approvedInvoice;
    }, {
      // Serializable لمنع Race Condition عند الموافقة المتزامنة على فواتير لنفس الصنف
      isolationLevel: 'Serializable',
    });

    await audit(req.user, 'invoice_approved', 'SaleInvoice', approved.id, approved.invoiceNumber, { customerName: approved.customerName, totalAmount: approved.totalAmount });
    res.json({ message: 'تم الموافقة ✅', invoice: n(approved) });
  } catch (err) {
    // P2034 = serialization failure — يحدث نادراً عند التزامن الشديد
    if (err.code === 'P2034') {
      return res.status(409).json({ message: 'تعارض في العملية، يرجى المحاولة مرة أخرى' });
    }
    res.status(500).json({ message: err.message });
  }
};

// ── SUSPEND ───────────────────────────────────────────────────────────────────
const suspendSaleInvoice = async (req, res) => {
  try {
    const invoice = await prisma.saleInvoice.findUnique({ where: { id: req.params.id } });
    if (!invoice)                     return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    if (invoice.status === 'approved') return res.status(400).json({ message: 'مينفعش تعلق فاتورة موافق عليها' });

    const updated = await prisma.saleInvoice.update({
      where: { id: invoice.id },
      data:  { status: 'suspended', suspendReason: req.body.reason || '' },
    });
    await audit(req.user, 'invoice_suspended', 'SaleInvoice', invoice.id, invoice.invoiceNumber);
    res.json({ message: 'تم التعليق', invoice: n(updated) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── CANCEL ────────────────────────────────────────────────────────────────────
const cancelSaleInvoice = async (req, res) => {
  try {
    const invoice = await prisma.saleInvoice.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!invoice) return res.status(404).json({ message: 'الفاتورة مش موجودة' });

    const wasApproved = invoice.status === 'approved';

    // ── Transaction: إرجاع المخزون + حذف الحركات + حذف الفاتورة ─────────────
    await prisma.$transaction(async (tx) => {
      if (wasApproved) {
        for (const item of invoice.items) {
          const tw = extractTotalWeight(item);
          await updateStock(item.itemId, invoice.warehouse, invoice.seasonId, {
            quantity:  safeNum(item.quantity),
            weight:    tw,
          }, tx);
        }
        await tx.stockMovement.deleteMany({ where: { referenceId: invoice.id } });
        await deleteTreasuryEntries(invoice.id, 'SaleInvoice', tx);
      }

      await tx.saleInvoice.delete({ where: { id: invoice.id } });
    }, { isolationLevel: 'Serializable' });

    await audit(req.user, 'invoice_cancelled', 'SaleInvoice', invoice.id, invoice.invoiceNumber, {
      customerName: invoice.customerName,
      docNumber:    invoice.docNumber,
      totalAmount:  invoice.totalAmount,
      wasApproved,
    });
    res.json({ message: 'تم الحذف النهائي' });
  } catch (err) {
    if (err.code === 'P2034') return res.status(409).json({ message: 'تعارض في العملية، يرجى المحاولة مرة أخرى' });
    res.status(500).json({ message: err.message });
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const invoiceIncludes = () => ({
  items:      true,
  customer:   { select: { name: true, code: true, phone: true, type: true } },
  createdBy:  { select: { name: true } },
  approvedBy: { select: { name: true } },
  editedBy:   { select: { name: true } },
  season:     { select: { name: true } },
});

module.exports = {
  getSaleInvoices, getSaleInvoiceById,
  checkDocNumber, searchInvoice,
  createSaleInvoice, updateSaleInvoice,
  forceEditSaleInvoice,
  approveSaleInvoice, suspendSaleInvoice, cancelSaleInvoice,
};
