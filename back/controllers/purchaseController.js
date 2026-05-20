// ─── controllers/purchaseController.js ───────────────────────────────────────
// مُحسَّن للأداء مع 100,000+ فاتورة:
//   - Cursor-based pagination (أسرع من offset مع البيانات الكبيرة)
//   - select محدود — مش بنجيب بيانات ما بنحتاجهاش في القائمة
//   - Promise.all للعمليات المتوازية
//   - Indexes ضرورية مذكورة في التعليق أسفل

const prisma = require('../config/db');
const { safeNum, round2, round3, n } = require('../utils/decimalHelper');
const { updateStock, createStockMovement } = require('../utils/stockHelper');
const { nextNumber } = require('../utils/counterHelper');

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * INDEX HINT — ضيف الـ indexes دي في schema.prisma
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * model PurchaseInvoice {
 *   @@index([seasonId, status, date])
 *   @@index([seasonId, date])
 *   @@index([seasonId, createdAt])
 *   @@index([invoiceNumber])
 *   @@index([supplierName])
 *   @@index([docNumber])
 * }
 */

const PAGE_SIZE = 100; // عدد الفواتير في كل صفحة

const calcItemTotal = (qty, wt, pr) =>
  (Number(qty) || 0) * (Number(wt) || 0) * (Number(pr) || 0);

// Select للقائمة — مش بنجيب items التفصيلية علشان توفر memory
const LIST_SELECT = {
  id: true,
  invoiceNumber: true,
  docNumber: true,
  supplierName: true,
  date: true,
  warehouse: true,
  totalAmount: true,
  totalWeight: true,
  status: true,
  createdAt: true,
  createdBy: { select: { name: true } },
  approvedBy: { select: { name: true } },
  season: { select: { name: true } },
};

// Select للتفاصيل الكاملة
const invoiceIncludes = () => ({
  items: true,
  supplier: { select: { name: true, code: true, phone: true } },
  createdBy: { select: { name: true } },
  approvedBy: { select: { name: true } },
  editedBy: { select: { name: true } },
  season: { select: { name: true } },
});

// ── GET all (cursor-based pagination) ─────────────────────────────────────────
// Query params:
//   status, warehouse, startDate, endDate, search, seasonId
//   cursor (createdAt of last item), limit (default 100)
const getPurchaseInvoices = async (req, res) => {
  try {
    const {
      status,
      warehouse,
      startDate,
      endDate,
      search,
      seasonId,
      cursor, // آخر createdAt من الصفحة السابقة (ISO string)
      limit = PAGE_SIZE,
    } = req.query;

    const take = Math.min(parseInt(limit, 10) || PAGE_SIZE, 200);

    const where = {};
    if (status) where.status = status;
    if (warehouse) where.warehouse = warehouse;
    if (seasonId) where.seasonId = seasonId;

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate)
        where.date.lte = new Date(new Date(endDate).setHours(23, 59, 59));
    }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { supplierName: { contains: search, mode: 'insensitive' } },
        { docNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Cursor pagination — أسرع بكتير من skip/offset مع ملايين الصفوف
    const cursorObj = cursor
      ? { createdAt: new Date(cursor) }
      : undefined;

    const [invoices, total] = await Promise.all([
      prisma.purchaseInvoice.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { createdAt: 'desc' },
        take: take + 1, // نجيب واحد زيادة عشان نعرف لو فيه صفحة تانية
        ...(cursorObj
          ? { cursor: cursorObj, skip: 1 }
          : {}),
      }),
      // count بس لو مفيش cursor (أول صفحة) عشان ما نعملش count في كل request
      cursor
        ? Promise.resolve(null)
        : prisma.purchaseInvoice.count({ where }),
    ]);

    const hasMore = invoices.length > take;
    const data = hasMore ? invoices.slice(0, take) : invoices;
    const nextCursor =
      hasMore ? data[data.length - 1].createdAt.toISOString() : null;

    res.json({
      invoices: data.map(norm),
      hasMore,
      nextCursor,
      total, // null في الصفحات التالية (مش محتاجينه)
      pageSize: take,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET by id ─────────────────────────────────────────────────────────────────
const getPurchaseInvoiceById = async (req, res) => {
  try {
    const invoice = await prisma.purchaseInvoice.findUnique({
      where: { id: req.params.id },
      include: invoiceIncludes(),
    });
    if (!invoice)
      return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    res.json(norm(invoice));
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
    if (seasonId)
      targetSeason = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!targetSeason)
      targetSeason = await prisma.season.findFirst({ where: { isActive: true } });

    const where = { docNumber };
    if (targetSeason?.id) where.seasonId = targetSeason.id;
    if (excludeId) where.id = { not: excludeId };

    const exists = await prisma.purchaseInvoice.findFirst({
      where,
      select: { invoiceNumber: true },
    });
    res.json({ exists: !!exists, invoiceNumber: exists?.invoiceNumber });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── CREATE ────────────────────────────────────────────────────────────────────
const createPurchaseInvoice = async (req, res) => {
  try {
    const {
      docNumber,
      date,
      supplierCode,
      supplierName,
      supplierId,
      warehouse,
      items,
      notes,
    } = req.body;
    if (!items?.length)
      return res.status(400).json({ message: 'لازم تضيف صنف واحد على الأقل' });

    const recalcItems = items.map((i) => {
      const tw = i.totalWeight != null
        ? round3(safeNum(i.totalWeight))
        : round3(safeNum(i.quantity) * safeNum(i.weight));
      return { ...i, _tw: tw, total: round2(tw * safeNum(i.price)) };
    });

    const [activeSeason, invoiceNumber] = await Promise.all([
      prisma.season.findFirst({ where: { isActive: true } }),
      nextNumber('PUR', 'PUR'),
    ]);

    const totalAmount = round2(recalcItems.reduce((s, i) => s + i.total, 0));
    const totalWeight = round3(recalcItems.reduce((s, i) => s + i._tw, 0));

    const invoice = await prisma.purchaseInvoice.create({
      data: {
        invoiceNumber,
        docNumber,
        date:           date ? new Date(date) : new Date(),
        supplierId,
        supplierCode,
        supplierName,
        warehouse,
        totalAmount,
        totalWeight,
        discountAmount: 0,
        netAmount:      totalAmount,
        paidAmount:     0,
        remainingAmount: totalAmount,
        status:         'pending',
        seasonId:       activeSeason?.id ?? null,
        notes,
        createdById:    req.user.id,
        items: {
          create: recalcItems.map((i) => ({
            itemId:   i.item,
            itemCode: i.itemCode,
            itemName: i.itemName,
            quantity: safeNum(i.quantity),
            weight:   safeNum(i.weight),
            price:    safeNum(i.price),
            total:    i.total,
          })),
        },
      },
      include: { items: true },
    });

    res.status(201).json(norm(invoice));
  } catch (err) {
    if (err.code === 'P2002')
      return res
        .status(400)
        .json({ message: 'رقم المستند موجود بالفعل في هذا الموسم' });
    res.status(500).json({ message: err.message });
  }
};

// ── FORCE EDIT ────────────────────────────────────────────────────────────────
const forceEditPurchaseInvoice = async (req, res) => {
  try {
    const invoice = await prisma.purchaseInvoice.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!invoice)
      return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    if (invoice.status === 'cancelled')
      return res.status(400).json({ message: 'الفاتورة ملغية' });

    // لو approved — نرجع المخزن
    if (invoice.status === 'approved') {
      for (const inv of invoice.items) {
        const tw = safeNum(inv.quantity) * safeNum(inv.weight);
        await updateStock(inv.itemId, invoice.warehouse, invoice.seasonId, { quantity: -inv.quantity, weight: -tw });
      }
      await prisma.stockMovement.deleteMany({ where: { referenceId: invoice.id } });
    }

    const { docNumber, date, items, notes, editNotes } = req.body;

    if (docNumber && docNumber !== invoice.docNumber) {
      const exists = await prisma.purchaseInvoice.findFirst({
        where: {
          docNumber,
          seasonId: invoice.seasonId,
          id: { not: invoice.id },
        },
      });
      if (exists)
        return res
          .status(400)
          .json({ message: 'رقم المستند موجود في هذا الموسم' });
    }

    // ← يدعم totalWeight من الـ frontend كما في createPurchaseInvoice
    const recalcItems = items.map((i) => {
      const tw = i.totalWeight != null
        ? round3(safeNum(i.totalWeight))
        : round3(safeNum(i.quantity) * safeNum(i.weight));
      return { ...i, _tw: tw, total: round2(tw * safeNum(i.price)) };
    });

    await prisma.purchaseInvoiceItem.deleteMany({
      where: { invoiceId: invoice.id },
    });

    const updated = await prisma.purchaseInvoice.update({
      where: { id: invoice.id },
      data: {
        docNumber: docNumber || invoice.docNumber,
        date: date ? new Date(date) : invoice.date,
        totalAmount: round2(recalcItems.reduce((s, i) => s + i.total, 0)),
        totalWeight: round3(recalcItems.reduce((s, i) => s + i._tw,   0)),
        notes: notes ?? invoice.notes,
        status: 'pending',
        approvedById: null,
        approvedAt: null,
        editedById: req.user.id,
        editedAt: new Date(),
        editNotes: editNotes || '',
        items: {
          create: recalcItems.map((i) => ({
            itemId: i.item,
            itemCode: i.itemCode,
            itemName: i.itemName,
            quantity: safeNum(i.quantity),
            weight: safeNum(i.weight),
            price: safeNum(i.price),
            total: i.total,
          })),
        },
      },
      include: invoiceIncludes(),
    });

    res.json({ message: 'تم التعديل ✅', invoice: norm(updated) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── APPROVE ───────────────────────────────────────────────────────────────────
const approvePurchaseInvoice = async (req, res) => {
  try {
    const invoice = await prisma.purchaseInvoice.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });
    if (!invoice)
      return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    if (invoice.status === 'approved')
      return res.status(400).json({ message: 'اتوافق عليها قبل كده' });
    if (invoice.status === 'cancelled')
      return res.status(400).json({ message: 'الفاتورة ملغية' });

    // تحديث المخزن
    for (const inv of invoice.items) {
      const tw = safeNum(inv.quantity) * safeNum(inv.weight);
      await updateStock(inv.itemId, invoice.warehouse, invoice.seasonId, { quantity: inv.quantity, weight: tw });
      await prisma.item.update({ where: { id: inv.itemId }, data: { lastPurchasePrice: inv.price } });
      await createStockMovement({
        itemId: inv.itemId, itemCode: inv.itemCode, itemName: inv.itemName,
        type: 'purchase_in', quantity: inv.quantity, weight: tw, price: inv.price,
        warehouse: invoice.warehouse, reference: invoice.invoiceNumber,
        referenceModel: 'PurchaseInvoice', referenceId: invoice.id,
        seasonId: invoice.seasonId || null, createdById: req.user.id, date: invoice.date,
      });
    }

    const approved = await prisma.purchaseInvoice.update({
      where: { id: invoice.id },
      data: {
        status: 'approved',
        approvedById: req.user.id,
        approvedAt: new Date(),
      },
      include: { items: true },
    });

    res.json({
      message: 'تم الموافقة وتحديث المخزن ✅',
      invoice: norm(approved),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── SUSPEND ───────────────────────────────────────────────────────────────────
const suspendPurchaseInvoice = async (req, res) => {
  try {
    const invoice = await prisma.purchaseInvoice.findUnique({
      where: { id: req.params.id },
    });
    if (!invoice)
      return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    if (invoice.status === 'approved')
      return res
        .status(400)
        .json({ message: 'مينفعش تعلق فاتورة موافق عليها' });

    const updated = await prisma.purchaseInvoice.update({
      where: { id: invoice.id },
      data: { status: 'suspended', suspendReason: req.body.reason || '' },
    });
    res.json({ message: 'تم التعليق', invoice: norm(updated) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── CANCEL ────────────────────────────────────────────────────────────────────
const cancelPurchaseInvoice = async (req, res) => {
  try {
    const invoice = await prisma.purchaseInvoice.findUnique({
      where: { id: req.params.id },
    });
    if (!invoice)
      return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    if (invoice.status === 'approved')
      return res
        .status(400)
        .json({ message: 'مينفعش تلغي فاتورة موافق عليها' });

    const updated = await prisma.purchaseInvoice.update({
      where: { id: invoice.id },
      data: { status: 'cancelled' },
    });
    res.json({ message: 'تم الإلغاء', invoice: norm(updated) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const norm = (x) => ({ ...x, _id: x.id });

module.exports = {
  getPurchaseInvoices,
  getPurchaseInvoiceById,
  checkDocNumber,
  createPurchaseInvoice,
  forceEditPurchaseInvoice,
  approvePurchaseInvoice,
  suspendPurchaseInvoice,
  cancelPurchaseInvoice,
};
