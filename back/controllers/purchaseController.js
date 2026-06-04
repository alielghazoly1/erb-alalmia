// ─── controllers/purchaseController.js ───────────────────────────────────────
// ✅ CRIT-NEW-002: approvePurchaseInvoice داخل prisma.$transaction(Serializable)
// ✅ FLOAT-FIX: calcWeight + sumWeights من Decimal.js
// ✅ FIX-PURCHASE-002: forceEditPurchaseInvoice يعكس المخزون بـ extractTotalWeight (total÷price من DB)
//    أدق من calcWeight(qty,weight) عشان total المخزّن هو المصدر الحقيقي
// ✅ FIX-RACE-001: createPurchaseInvoice — docNumber check داخل Serializable tx
//    يمنع Race Condition لما جهازان يرسلوا نفس الـ docNumber في نفس اللحظة
//    + الـ DB @@unique([docNumber, seasonId]) يعمل كـ safety net إضافي (P2002)
// ✅ FIX-RACE-002: forceEditPurchaseInvoice — docNumber check داخل الـ tx نفسها
//    يمنع تكرار الـ docNumber عند التعديل المتزامن من جهازين
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const prisma = require('../config/db');
const { safeNum, round2, round3, calcWeight, calcTotal, sumWeights, sumAmounts, n, normalizeInvoiceItems } = require('../utils/decimalHelper');
const { updateStock, createStockMovement } = require('../utils/stockHelper');
const { nextNumber } = require('../utils/counterHelper');

// ── extractTotalWeight ────────────────────────────────────────────────────────
/**
 * ✅ الأولوية: totalWeight المخزّن صراحةً (الأدق دائماً)
 *              ثم qty × weight بـ Decimal
 *              أخيراً total ÷ price (fallback للبيانات القديمة)
 */
const extractTotalWeight = (item) => {
  if (item.totalWeight != null) return round3(safeNum(item.totalWeight));
  const tw = calcWeight(item.quantity, item.weight);
  if (tw > 0) return tw;
  const pr = safeNum(item.price);
  if (pr > 0) return round3(safeNum(item.total) / pr);
  return 0;
};

const PAGE_SIZE = 100;

const LIST_SELECT = {
  id: true, invoiceNumber: true, docNumber: true,
  supplierName: true, date: true, warehouse: true,
  totalAmount: true, totalWeight: true, status: true, createdAt: true,
  createdBy:  { select: { name: true } },
  approvedBy: { select: { name: true } },
  season:     { select: { name: true } },
};

const invoiceIncludes = () => ({
  items:      true,
  supplier:   { select: { name: true, code: true, phone: true } },
  createdBy:  { select: { name: true } },
  approvedBy: { select: { name: true } },
  editedBy:   { select: { name: true } },
  season:     { select: { name: true } },
});

// ── GET all ───────────────────────────────────────────────────────────────────
const getPurchaseInvoices = async (req, res) => {
  try {
    const { status, warehouse, startDate, endDate, search, seasonId, cursor, limit = PAGE_SIZE } = req.query;
    const take  = Math.min(parseInt(limit, 10) || PAGE_SIZE, 200);
    const where = {};
    if (status)    where.status    = status;
    if (warehouse) where.warehouse = warehouse;
    if (seasonId)  where.seasonId  = seasonId;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate)   where.date.lte = new Date(new Date(endDate).setHours(23, 59, 59));
    }
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { supplierName:  { contains: search, mode: 'insensitive' } },
        { docNumber:     { contains: search, mode: 'insensitive' } },
      ];
    }

    const cursorObj = cursor ? { createdAt: new Date(cursor) } : undefined;
    const [invoices, total] = await Promise.all([
      prisma.purchaseInvoice.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { createdAt: 'desc' },
        take: take + 1,
        ...(cursorObj ? { cursor: cursorObj, skip: 1 } : {}),
      }),
      cursor ? Promise.resolve(null) : prisma.purchaseInvoice.count({ where }),
    ]);

    const hasMore    = invoices.length > take;
    const data       = hasMore ? invoices.slice(0, take) : invoices;
    const nextCursor = hasMore ? data[data.length - 1].createdAt.toISOString() : null;

    res.json({ invoices: data.map(n), hasMore, nextCursor, total, pageSize: take });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET by id ─────────────────────────────────────────────────────────────────
const getPurchaseInvoiceById = async (req, res) => {
  try {
    const invoice = await prisma.purchaseInvoice.findUnique({ where: { id: req.params.id }, include: invoiceIncludes() });
    if (!invoice) return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    res.json(n(invoice));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── CHECK docNumber ───────────────────────────────────────────────────────────
const checkDocNumber = async (req, res) => {
  try {
    const { docNumber, excludeId, seasonId } = req.query;
    if (!docNumber?.trim()) return res.json({ exists: false });

    let targetSeason;
    if (seasonId) targetSeason = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!targetSeason) targetSeason = await prisma.season.findFirst({ where: { isActive: true } });

    const where = { docNumber };
    if (targetSeason?.id) where.seasonId = targetSeason.id;
    if (excludeId) where.id = { not: excludeId };

    const exists = await prisma.purchaseInvoice.findFirst({ where, select: { invoiceNumber: true } });
    res.json({ exists: !!exists, invoiceNumber: exists?.invoiceNumber });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── CREATE ────────────────────────────────────────────────────────────────────
/**
 * ✅ FIX-RACE-001: كل عملية الإنشاء داخل Serializable transaction واحدة
 *
 * المشكلة القديمة:
 *   1. findFirst (خارج tx) → جهازان يقرآن "مفيش تكرار"
 *   2. create    (خارج tx) → كلاهما ينجح → فاتورتان بنفس docNumber
 *
 * الحل:
 *   الـ findFirst والـ create داخل نفس الـ Serializable tx →
 *   PostgreSQL يحجز قفل على الصفوف المقروءة → الطلب الثاني ينتظر أو يفشل بـ P2034
 *   + الـ @@unique([docNumber, seasonId]) في DB يعمل safety net أخير (P2002)
 *
 * ملاحظة: nextNumber('PUR') تشتغل خارج الـ tx المتسلسلة عشان تكون لها tx Serializable
 *         خاصة بيها (مُعرَّفة في counterHelper) — لو دمجناها ستتعارض مع الـ tx الخارجية
 */
const createPurchaseInvoice = async (req, res) => {
  try {
    const { docNumber, date, supplierCode, supplierName, supplierId, warehouse, items, notes } = req.body;
    if (!items?.length) return res.status(400).json({ message: 'لازم تضيف صنف واحد على الأقل' });

    // ✅ تطبيع الأصناف: quantity = totalWeight ÷ unitWeight دائماً
    const recalcItems = normalizeInvoiceItems(items, { hasPrice: true });

    const totalAmount = sumAmounts(recalcItems.map(i => i.total));
    const totalWeight = sumWeights(recalcItems.map(i => i._tw));

    // ── جلب الموسم ورقم الفاتورة قبل الـ tx (عمليات آمنة للقراءة) ───────────
    const [activeSeason, invoiceNumber] = await Promise.all([
      prisma.season.findFirst({ where: { isActive: true } }),
      nextNumber('PUR', 'PUR'), // ← atomic في Serializable tx خاصة بيها
    ]);

    const seasonId = activeSeason?.id ?? null;

    // ── ✅ FIX-RACE-001: الإنشاء الكامل داخل Serializable tx ─────────────────
    const invoice = await prisma.$transaction(async (tx) => {

      // فحص docNumber داخل الـ tx — يمنع Race Condition مع 10 أجهزة
      if (docNumber?.trim()) {
        const docExists = await tx.purchaseInvoice.findFirst({
          where: { docNumber: docNumber.trim(), seasonId },
          select: { invoiceNumber: true },
        });
        if (docExists)
          throw Object.assign(
            new Error(`رقم المستند "${docNumber.trim()}" موجود بالفعل (${docExists.invoiceNumber})`),
            { code: 'DOC_DUP' },
          );
      }

      return tx.purchaseInvoice.create({
        data: {
          invoiceNumber,
          docNumber:       docNumber?.trim() || null,
          date:            date ? new Date(date) : new Date(),
          supplierCode,
          supplierName,
          supplierId:      supplierId || null,
          warehouse,
          totalAmount,
          totalWeight,
          discountAmount:  0,
          netAmount:       totalAmount,
          paidAmount:      0,
          remainingAmount: totalAmount,
          status:          'pending',
          seasonId,
          notes,
          createdById:     req.user.id,
          items: {
            create: recalcItems.map(i => ({
              itemId:      i.itemId || i.item,
              itemCode:    i.itemCode,
              itemName:    i.itemName,
              quantity:    safeNum(i.quantity),
              weight:      safeNum(i.weight),
              totalWeight: i._tw,
              price:       safeNum(i.price),
              total:       i.total,
            })),
          },
        },
        include: { items: true },
      });

    }, { isolationLevel: 'Serializable' });

    res.status(201).json(n(invoice));
  } catch (err) {
    if (err.code === 'DOC_DUP') return res.status(400).json({ message: err.message });
    // P2002 = DB unique violation (safety net لو الـ tx فشلت بطريقة غير متوقعة)
    if (err.code === 'P2002')   return res.status(400).json({ message: 'رقم المستند موجود بالفعل في هذا الموسم' });
    // P2034 = Serializable conflict — أرجع 409 عشان الفرونت يعيد المحاولة
    if (err.code === 'P2034')   return res.status(409).json({ message: 'تعارض في العملية، حاول مرة أخرى' });
    console.error('[createPurchaseInvoice]', err);
    res.status(500).json({ message: err.message });
  }
};

// ── FORCE EDIT ────────────────────────────────────────────────────────────────
/**
 * ✅ FIX-RACE-002: docNumber check داخل الـ tx نفسها
 *   المشكلة القديمة: الفحص كان خارج الـ tx → Race Condition عند التعديل المتزامن
 *   الحل: الفحص والتعديل في Serializable tx واحدة
 */
const forceEditPurchaseInvoice = async (req, res) => {
  try {
    const invoice = await prisma.purchaseInvoice.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!invoice)                       return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    if (invoice.status === 'cancelled') return res.status(400).json({ message: 'الفاتورة ملغية' });

    const wasApproved = invoice.status === 'approved';
    const { docNumber, date, items, notes } = req.body;

    // ✅ FIX-PUR-EDIT-001: استخدام normalizeInvoiceItems بدل الحساب اليدوي
    // منسجم مع createPurchaseInvoice ويضمن quantity = totalWeight ÷ unitWeight
    const recalcItems = normalizeInvoiceItems(items, { hasPrice: true });
    const totalAmount = sumAmounts(recalcItems.map(i => i.total));
    const totalWeight = sumWeights(recalcItems.map(i => i._tw));

    const newDocNumber = docNumber?.trim() || invoice.docNumber;

    const updated = await prisma.$transaction(async (tx) => {

      // ✅ FIX-RACE-002: فحص docNumber داخل الـ tx — يمنع Race Condition
      if (newDocNumber && newDocNumber !== invoice.docNumber) {
        const docExists = await tx.purchaseInvoice.findFirst({
          where: {
            docNumber: newDocNumber,
            seasonId:  invoice.seasonId ?? null,
            id:        { not: invoice.id },
          },
          select: { invoiceNumber: true },
        });
        if (docExists)
          throw Object.assign(
            new Error(`رقم المستند "${newDocNumber}" موجود بالفعل (${docExists.invoiceNumber})`),
            { code: 'DOC_DUP' },
          );
      }

      // ✅ FIX-PURCHASE-001: عكس المخزون باستخدام extractTotalWeight (total÷price من DB)
      // أدق من calcWeight(qty, weight) لأن total المخزّن هو المصدر الحقيقي للوزن
      if (wasApproved) {
        for (const item of invoice.items) {
          const tw = extractTotalWeight(item);
          // ✅ ARCH-001: العكس بالوزن فقط
          await updateStock(item.itemId, invoice.warehouse, invoice.seasonId, { weight: -tw }, tx);
        }
        await tx.stockMovement.deleteMany({ where: { referenceId: invoice.id } });
      }

      await tx.purchaseInvoiceItem.deleteMany({ where: { invoiceId: invoice.id } });

      return tx.purchaseInvoice.update({
        where: { id: invoice.id },
        data: {
          docNumber:       newDocNumber,
          date:            date ? new Date(date) : invoice.date,
          totalAmount,
          totalWeight,
          discountAmount:  0,
          netAmount:       totalAmount,
          paidAmount:      0,
          remainingAmount: totalAmount,
          notes,
          status:          'pending',
          approvedById:    null,
          approvedAt:      null,
          items: {
            create: recalcItems.map(i => ({
              itemId:      i.itemId || i.item,
              itemCode:    i.itemCode,
              itemName:    i.itemName,
              quantity:    safeNum(i.quantity),
              weight:      safeNum(i.weight),
              totalWeight: i._tw,
              price:       safeNum(i.price),
              total:       i.total,
            })),
          },
        },
        include: invoiceIncludes(),
      });

    }, { isolationLevel: 'Serializable' });

    res.json({ message: 'تم التعديل ✅', invoice: n(updated) });
  } catch (err) {
    if (err.code === 'DOC_DUP') return res.status(400).json({ message: err.message });
    if (err.code === 'P2002')   return res.status(400).json({ message: 'رقم المستند موجود بالفعل في هذا الموسم' });
    if (err.code === 'P2034')   return res.status(409).json({ message: 'تعارض في العملية، حاول مرة أخرى' });
    console.error('[forceEditPurchaseInvoice]', err);
    res.status(500).json({ message: err.message });
  }
};

// ── APPROVE ───────────────────────────────────────────────────────────────────
const approvePurchaseInvoice = async (req, res) => {
  try {
    const invoice = await prisma.purchaseInvoice.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!invoice)                     return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    if (invoice.status === 'approved')  return res.status(400).json({ message: 'اتوافق عليها قبل كده' });
    if (invoice.status === 'cancelled') return res.status(400).json({ message: 'الفاتورة ملغية' });

    // ── Transaction: إضافة المخزون + تسجيل الحركات + اعتماد الفاتورة ─────────
    const approved = await prisma.$transaction(async (tx) => {
      for (const inv of invoice.items) {
        // ✅ FIX-PUR-APPROVE-001: extractTotalWeight يُعطي الأولوية لـ totalWeight المخزّن
        // بدل calcWeight(qty, weight) الذي يتجاهله ويُحدث stock drift
        const tw = extractTotalWeight(inv);

        // ✅ ARCH-001: الإضافة بالوزن فقط — quantity تُحسب تلقائياً
        await updateStock(inv.itemId, invoice.warehouse, invoice.seasonId, {
          weight: tw,
        }, tx);

        await tx.item.update({
          where: { id: inv.itemId },
          data:  { lastPurchasePrice: inv.price },
        });

        await createStockMovement({
          itemId: inv.itemId, itemCode: inv.itemCode, itemName: inv.itemName,
          type: 'purchase_in', quantity: inv.quantity, weight: tw, price: inv.price,
          warehouse: invoice.warehouse, reference: invoice.invoiceNumber,
          referenceModel: 'PurchaseInvoice', referenceId: invoice.id,
          seasonId: invoice.seasonId || null, createdById: req.user.id, date: invoice.date,
        }, tx);
      }

      return tx.purchaseInvoice.update({
        where: { id: invoice.id },
        data:  { status: 'approved', approvedById: req.user.id, approvedAt: new Date() },
        include: { items: true },
      });
    }, { isolationLevel: 'Serializable' });

    res.json({ message: 'تم الموافقة وتحديث المخزن ✅', invoice: n(approved) });
  } catch (err) {
    if (err.code === 'P2034') return res.status(409).json({ message: 'تعارض في العملية، يرجى المحاولة مرة أخرى' });
    res.status(500).json({ message: err.message });
  }
};

// ── SUSPEND ───────────────────────────────────────────────────────────────────
const suspendPurchaseInvoice = async (req, res) => {
  try {
    const invoice = await prisma.purchaseInvoice.findUnique({ where: { id: req.params.id } });
    if (!invoice)                     return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    if (invoice.status === 'approved') return res.status(400).json({ message: 'مينفعش تعلق فاتورة موافق عليها' });

    const updated = await prisma.purchaseInvoice.update({
      where: { id: invoice.id },
      data:  { status: 'suspended', suspendReason: req.body.reason || '' },
    });
    res.json({ message: 'تم التعليق', invoice: n(updated) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── CANCEL ────────────────────────────────────────────────────────────────────
const cancelPurchaseInvoice = async (req, res) => {
  try {
    const invoice = await prisma.purchaseInvoice.findUnique({ where: { id: req.params.id } });
    if (!invoice)                     return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    if (invoice.status === 'approved') return res.status(400).json({ message: 'مينفعش تلغي فاتورة موافق عليها' });

    const updated = await prisma.purchaseInvoice.update({
      where: { id: invoice.id },
      data:  { status: 'cancelled' },
    });
    res.json({ message: 'تم الإلغاء', invoice: n(updated) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = {
  getPurchaseInvoices, getPurchaseInvoiceById,
  checkDocNumber,
  createPurchaseInvoice, forceEditPurchaseInvoice,
  approvePurchaseInvoice, suspendPurchaseInvoice, cancelPurchaseInvoice,
};