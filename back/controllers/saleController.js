// ─── controllers/saleController.js ───────────────────────────────────────────
const prisma                = require('../config/db');
const { safeNum, round2, round3, n } = require('../utils/decimalHelper');
const { recordSaleInvoice, deleteTreasuryEntries } = require('../utils/treasuryHelper');
const { getStockQty, updateStock, createStockMovement } = require('../utils/stockHelper');
const { audit }             = require('../utils/auditHelper');
const { nextNumber }        = require('../utils/counterHelper');

const calcItemTotal       = (qty, wt, pr) => round2(safeNum(qty) * safeNum(wt) * safeNum(pr));
const calcItemTotalWeight = (qty, wt)     => round3(safeNum(qty) * safeNum(wt));

// ── GET all ───────────────────────────────────────────────────────────────────
const getSaleInvoices = async (req, res) => {
  try {
    const { status, warehouse, startDate, endDate, search, customerId, seasonId, page = 1, limit } = req.query;

    const where = { deletedAt: null };
    if (status)     where.status    = status;
    if (warehouse)  where.warehouse = warehouse;
    if (customerId) where.customerId= customerId;
    if (seasonId)   where.seasonId  = seasonId;

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

    // بنحاول نجيب بـ id أو invoiceNumber أو docNumber
    let invoice = await prisma.saleInvoice.findFirst({
      where: { id, ...notDeleted },
      include: invoiceIncludes(),
    }).catch(() => null);

    if (!invoice) {
      invoice = await prisma.saleInvoice.findFirst({
        where: { invoiceNumber: id, ...notDeleted },
        include: invoiceIncludes(),
      });
    }
    if (!invoice) {
      invoice = await prisma.saleInvoice.findFirst({
        where: { docNumber: id, ...notDeleted },
        include: invoiceIncludes(),
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!invoice) return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    res.json(n(invoice));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── CHECK docNumber ───────────────────────────────────────────────────────────
const checkDocNumber = async (req, res) => {
  try {
    const { docNumber, excludeId, seasonId } = req.query;

    let targetSeason;
    if (seasonId) {
      targetSeason = await prisma.season.findUnique({ where: { id: seasonId } });
    } else {
      targetSeason = await prisma.season.findFirst({ where: { isActive: true } });
    }

    const where = { docNumber, deletedAt: null };
    if (targetSeason) where.seasonId = targetSeason.id;
    if (excludeId)    where.id = { not: excludeId };

    const exists = await prisma.saleInvoice.findFirst({ where, select: { invoiceNumber: true, seasonId: true } });

    if (exists) {
      const seasonName = targetSeason?.name || 'هذا الموسم';
      return res.json({ exists: true, seasonName, invoiceNumber: exists.invoiceNumber });
    }
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

    const docExists = await prisma.saleInvoice.findFirst({
      where: { docNumber, seasonId: activeSeason?.id, deletedAt: null },
    });
    if (docExists)
      return res.status(400).json({ message: `رقم المستند "${docNumber}" موجود بالفعل في الموسم الحالي (${docExists.invoiceNumber})` });

    if (!items?.length) return res.status(400).json({ message: 'لازم تضيف صنف واحد على الأقل' });

    // التحقق من صلاحية البيع بالسالب — role=admin دايماً مسموح
    const isAdmin = req.user?.role === 'admin';
    const permsArr = req.user?.permissions || [];
    const negativeAllowed = isAdmin || permsArr.some(p => p.permission === 'sale_allow_negative' && p.granted === true);

    // فحص المخزون
    for (const saleItem of items) {
      const dbItem = await prisma.item.findUnique({ where: { id: saleItem.item } });
      if (!dbItem) return res.status(404).json({ message: `الصنف ${saleItem.itemCode} مش موجود` });
      if (!negativeAllowed) {
        const { quantity: stockQty } = await getStockQty(saleItem.item, warehouse, activeSeason?.id);
        if (stockQty < saleItem.quantity)
          return res.status(400).json({ message: `المخزون مش كافي للصنف "${saleItem.itemName}" — متاح: ${stockQty} كرتون` });
      }
    }

    const recalcItems   = items.map(i => ({ ...i, total: calcItemTotal(i.quantity, i.weight, i.price) }));
    const invoiceNumber = await nextNumber('SAL', 'SAL');
    const totalAmount   = recalcItems.reduce((s, i) => s + i.total, 0);
    const totalWeight   = recalcItems.reduce((s, i) => s + calcItemTotalWeight(i.quantity, i.weight), 0);

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
        createdById:     req.user.id,
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

// ── UPDATE (pending فقط) ──────────────────────────────────────────────────────
const updateSaleInvoice = async (req, res) => {
  try {
    const invoice = await prisma.saleInvoice.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!invoice)                  return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    if (invoice.status === 'cancelled') return res.status(400).json({ message: 'الفاتورة ملغية' });

    const wasApproved = invoice.status === 'approved';
    if (wasApproved) {
      // نرجع المخزون قبل التعديل
      for (const item of invoice.items) {
        const tw = calcItemTotalWeight(item.quantity, item.weight);
        await updateStock(item.itemId, invoice.warehouse, invoice.seasonId, { quantity: item.quantity, weight: tw });
      }
      await prisma.stockMovement.deleteMany({ where: { referenceId: invoice.id } });
      await deleteTreasuryEntries(invoice.id, 'SaleInvoice');
    }

    const { docNumber, date, items, paidAmount, cashAmount, instapayAmount, paymentMethod, notes } = req.body;

    if (docNumber && docNumber !== invoice.docNumber) {
      const docExists = await prisma.saleInvoice.findFirst({
        where: { docNumber, seasonId: invoice.seasonId, id: { not: invoice.id }, deletedAt: null },
      });
      if (docExists) return res.status(400).json({ message: 'رقم المستند موجود بالفعل في هذا الموسم' });
    }

    const recalcItems = items.map(i => ({ ...i, total: calcItemTotal(i.quantity, i.weight, i.price) }));
    const totalAmount = round2(recalcItems.reduce((s, i) => s + safeNum(i.total), 0));
    const totalWeight = round3(recalcItems.reduce((s, i) => s + calcItemTotalWeight(i.quantity, i.weight), 0));

    // حذف الأصناف القديمة وإضافة الجديدة
    await prisma.saleInvoiceItem.deleteMany({ where: { invoiceId: invoice.id } });

    const updated = await prisma.saleInvoice.update({
      where: { id: invoice.id },
      data: {
        docNumber:      docNumber || invoice.docNumber,
        date:           date ? new Date(date) : invoice.date,
        totalAmount, totalWeight,
        paidAmount:     safeNum(paidAmount)     || 0,
        cashAmount:     safeNum(cashAmount)     || 0,
        instapayAmount: safeNum(instapayAmount) || 0,
        paymentMethod:  paymentMethod || invoice.paymentMethod,
        notes, status: 'pending',
        approvedById:   null, approvedAt: null,
        items: { create: recalcItems.map(i => ({ itemId: i.item, itemCode: i.itemCode, itemName: i.itemName, quantity: safeNum(i.quantity), weight: safeNum(i.weight), price: safeNum(i.price), total: i.total })) },
      },
      include: { items: true },
    });
    res.json({ message: 'تم التعديل ✅', invoice: n(updated) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── FORCE EDIT للأدمن ─────────────────────────────────────────────────────────
const forceEditSaleInvoice = async (req, res) => {
  try {
    const invoice = await prisma.saleInvoice.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!invoice)                  return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    if (invoice.status === 'cancelled') return res.status(400).json({ message: 'الفاتورة ملغية' });

    if (invoice.status === 'approved') {
      for (const item of invoice.items) {
        const dbItem = await prisma.item.findUnique({ where: { id: item.itemId } });
        if (!dbItem) continue;
        const tw = calcItemTotalWeight(item.quantity, item.weight);
        await updateStock(item.itemId, invoice.warehouse, invoice.seasonId, { quantity: item.quantity, weight: tw });
      }
      await prisma.stockMovement.deleteMany({ where: { referenceId: invoice.id } });
      await deleteTreasuryEntries(invoice.id, 'SaleInvoice');
    }

    const { docNumber, date, items, paidAmount, cashAmount, instapayAmount, paymentMethod, notes, editNotes } = req.body;

    if (docNumber && docNumber !== invoice.docNumber) {
      const docExists = await prisma.saleInvoice.findFirst({
        where: { docNumber, seasonId: invoice.seasonId, id: { not: invoice.id }, deletedAt: null },
      });
      if (docExists) return res.status(400).json({ message: 'رقم المستند موجود بالفعل في هذا الموسم' });
    }

    const recalcItems = items.map(i => ({ ...i, total: calcItemTotal(i.quantity, i.weight, i.price) }));
    const totalAmount = round2(recalcItems.reduce((s, i) => s + safeNum(i.total), 0));
    const totalWeight = round3(recalcItems.reduce((s, i) => s + calcItemTotalWeight(i.quantity, i.weight), 0));

    await prisma.saleInvoiceItem.deleteMany({ where: { invoiceId: invoice.id } });

    const updated = await prisma.saleInvoice.update({
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
        approvedById:   null, approvedAt: null,
        editedById:     req.user.id, editedAt: new Date(), editNotes: editNotes || '',
        items: { create: recalcItems.map(i => ({ itemId: i.item, itemCode: i.itemCode, itemName: i.itemName, quantity: safeNum(i.quantity), weight: safeNum(i.weight), price: safeNum(i.price), total: i.total })) },
      },
      include: invoiceIncludes(),
    });

    await audit(req.user, 'invoice_edited', 'SaleInvoice', updated.id, updated.invoiceNumber, { editNotes: editNotes || '', customerName: updated.customerName, totalAmount: updated.totalAmount });
    res.json({ message: 'تم التعديل بواسطة الأدمن ✅', invoice: n(updated) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── APPROVE ───────────────────────────────────────────────────────────────────
const approveSaleInvoice = async (req, res) => {
  try {
    const invoice = await prisma.saleInvoice.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!invoice)               return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    if (invoice.status === 'approved')  return res.status(400).json({ message: 'اتوافق عليها قبل كده' });
    if (invoice.status === 'cancelled') return res.status(400).json({ message: 'الفاتورة ملغية' });

    for (const saleItem of invoice.items) {
      const tw = calcItemTotalWeight(saleItem.quantity, saleItem.weight);
      await updateStock(saleItem.itemId, invoice.warehouse, invoice.seasonId, { quantity: -saleItem.quantity, weight: -tw });
      await prisma.item.update({ where: { id: saleItem.itemId }, data: { lastSalePrice: saleItem.price } });
      await createStockMovement({
        itemId: saleItem.itemId, itemCode: saleItem.itemCode, itemName: saleItem.itemName,
        type: 'sale_out', quantity: saleItem.quantity, weight: tw, price: saleItem.price,
        warehouse: invoice.warehouse, reference: invoice.invoiceNumber,
        referenceModel: 'SaleInvoice', referenceId: invoice.id,
        seasonId: invoice.seasonId || null, createdById: req.user.id, date: invoice.date,
      });
    }

    const approved = await prisma.saleInvoice.update({
      where: { id: invoice.id },
      data:  { status: 'approved', approvedById: req.user.id, approvedAt: new Date() },
      include: { items: true },
    });

    await recordSaleInvoice(approved, req.user);
    await audit(req.user, 'invoice_approved', 'SaleInvoice', approved.id, approved.invoiceNumber, { customerName: approved.customerName, totalAmount: approved.totalAmount });
    res.json({ message: 'تم الموافقة ✅', invoice: n(approved) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── SUSPEND ───────────────────────────────────────────────────────────────────
const suspendSaleInvoice = async (req, res) => {
  try {
    const invoice = await prisma.saleInvoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    if (invoice.status === 'approved') return res.status(400).json({ message: 'مينفعش تعلق فاتورة موافق عليها' });

    const updated = await prisma.saleInvoice.update({
      where: { id: invoice.id },
      data:  { status: 'suspended', suspendReason: req.body.reason || '' },
    });
    await audit(req.user, 'invoice_suspended', 'SaleInvoice', invoice.id, invoice.invoiceNumber);
    res.json({ message: 'تم التعليق', invoice: n(updated) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── CANCEL (Hard Delete) ──────────────────────────────────────────────────────
const cancelSaleInvoice = async (req, res) => {
  try {
    const invoice = await prisma.saleInvoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) return res.status(404).json({ message: 'الفاتورة مش موجودة' });
    if (invoice.status === 'approved') return res.status(400).json({ message: 'مينفعش تلغي فاتورة موافق عليها — عدّلها الأول' });

    await audit(req.user, 'invoice_cancelled', 'SaleInvoice', invoice.id, invoice.invoiceNumber, { customerName: invoice.customerName, docNumber: invoice.docNumber, totalAmount: invoice.totalAmount });
    await prisma.saleInvoice.delete({ where: { id: invoice.id } });
    res.json({ message: 'تم الحذف النهائي' });
  } catch (err) { res.status(500).json({ message: err.message }); }
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
