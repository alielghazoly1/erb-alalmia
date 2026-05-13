// ─── controllers/returnController.js ─────────────────────────────────────────
const prisma           = require('../config/db');
const { audit }        = require('../utils/auditHelper');
const { recordReturn, deleteTreasuryEntries } = require('../utils/treasuryHelper');
const { updateStock, createStockMovement } = require('../utils/stockHelper');
const { nextNumber }   = require('../utils/counterHelper');

const calcItemTotal = (qty, wt, pr) => (Number(qty)||0) * (Number(wt)||0) * (Number(pr)||0);

const invoiceIncludes = () => ({
  items:      { include: { item: { select: { code: true, name: true, defaultWeight: true } } } },
  createdBy:  { select: { name: true } },
  approvedBy: { select: { name: true } },
  customer:   { select: { name: true, code: true } },
  supplier:   { select: { name: true, code: true } },
  season:     { select: { name: true } },
});

// ── GET by ID ─────────────────────────────────────────────────────────────────
const getReturnById = async (req, res) => {
  try {
    const returnInv = await prisma.returnInvoice.findUnique({
      where: { id: req.params.id },
      include: invoiceIncludes(),
    });
    if (!returnInv) return res.status(404).json({ message: 'المرتجع مش موجود' });
    res.json(n(returnInv));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET all ───────────────────────────────────────────────────────────────────
const getReturns = async (req, res) => {
  try {
    const { type, status, search } = req.query;
    const where = {};
    if (type)   where.type   = type;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customerName:  { contains: search, mode: 'insensitive' } },
        { supplierName:  { contains: search, mode: 'insensitive' } },
      ];
    }

    const returns = await prisma.returnInvoice.findMany({
      where,
      include: { createdBy: { select: { name: true } }, approvedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(returns.map(n));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── CREATE ────────────────────────────────────────────────────────────────────
const createReturn = async (req, res) => {
  try {
    const {
      type, docNumber, date,
      customerId, customerCode, customerName,
      supplierId, supplierCode, supplierName,
      warehouse, items, notes,
      originalInvoiceRef,
      refundMethod = 'none',
      refundCashAmount = 0,
      refundBankAmount = 0,
    } = req.body;

    if (!items?.length) return res.status(400).json({ message: 'لازم تضيف صنف واحد على الأقل' });

    const recalcItems   = items.map(i => ({ ...i, total: calcItemTotal(i.quantity, i.weight, i.price) }));
    const activeSeason  = await prisma.season.findFirst({ where: { isActive: true } });
    const invoiceNumber = await nextNumber('RET', 'RET');
    const totalAmount   = recalcItems.reduce((s, i) => s + i.total, 0);
    const totalWeight   = recalcItems.reduce((s, i) => s + Number(i.quantity) * Number(i.weight), 0);

    const returnInv = await prisma.returnInvoice.create({
      data: {
        invoiceNumber, docNumber,
        date:             date ? new Date(date) : new Date(),
        type, warehouse,
        customerId:       customerId || null,
        customerCode:     customerCode || null,
        customerName:     customerName || null,
        supplierId:       supplierId || null,
        supplierCode:     supplierCode || null,
        supplierName:     supplierName || null,
        totalAmount, totalWeight,
        status:           'pending',
        notes, originalInvoiceRef: originalInvoiceRef || null,
        refundMethod,
        refundCashAmount: Number(refundCashAmount) || 0,
        refundBankAmount: Number(refundBankAmount) || 0,
        seasonId:         activeSeason?.id ?? null,
        createdById:      req.user.id,
        items: {
          create: recalcItems.map(i => ({
            itemId: i.item, itemCode: i.itemCode, itemName: i.itemName,
            quantity: Number(i.quantity), weight: Number(i.weight), price: Number(i.price), total: i.total,
          })),
        },
      },
      include: invoiceIncludes(),
    });

    await audit(req.user, 'return_created', 'ReturnInvoice', returnInv.id, returnInv.invoiceNumber, { type, totalAmount });
    res.status(201).json(n(returnInv));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── UPDATE (حتى بعد الموافقة — بيعكس الأثر القديم ثم يطبق الجديد) ─────────────
const updateReturn = async (req, res) => {
  try {
    const returnInv = await prisma.returnInvoice.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!returnInv) return res.status(404).json({ message: 'المرتجع مش موجود' });
    if (returnInv.status === 'rejected') return res.status(400).json({ message: 'لا يمكن تعديل مرتجع مرفوض' });

    const {
      docNumber, date, customerId, customerCode, customerName,
      supplierId, supplierCode, supplierName, warehouse, items, notes, originalInvoiceRef,
      refundMethod = returnInv.refundMethod,
      refundCashAmount = returnInv.refundCashAmount,
      refundBankAmount = returnInv.refundBankAmount,
    } = req.body;

    if (!items?.length) return res.status(400).json({ message: 'لازم تضيف صنف واحد على الأقل' });

    const wasApproved = returnInv.status === 'approved';

    // ── عكس أثر المخزن القديم لو كان معتمد ──────────────────────────────────
    if (wasApproved) {
      for (const oldItem of returnInv.items) {
        const oldTW = Number(oldItem.quantity) * Number(oldItem.weight);
        if (returnInv.type === 'customer_return') {
          await updateStock(oldItem.itemId, returnInv.warehouse, returnInv.seasonId, { quantity: -oldItem.quantity, weight: -oldTW });
        } else {
          await updateStock(oldItem.itemId, returnInv.warehouse, returnInv.seasonId, { quantity: oldItem.quantity, weight: oldTW });
        }
      }
      await prisma.stockMovement.deleteMany({ where: { referenceModel: 'ReturnInvoice', referenceId: returnInv.id } });
      await deleteTreasuryEntries(returnInv.id, 'ReturnInvoice');
    }

    const recalcItems = items.map(i => ({ ...i, total: calcItemTotal(i.quantity, i.weight, i.price) }));
    const totalAmount = recalcItems.reduce((s, i) => s + i.total, 0);
    const totalWeight = recalcItems.reduce((s, i) => s + Number(i.quantity) * Number(i.weight), 0);
    const newWarehouse = warehouse || returnInv.warehouse;

    // ── حذف الأصناف القديمة وإضافة الجديدة ─────────────────────────────────
    await prisma.returnInvoiceItem.deleteMany({ where: { invoiceId: returnInv.id } });

    const updated = await prisma.returnInvoice.update({
      where: { id: returnInv.id },
      data: {
        docNumber:        docNumber      ?? returnInv.docNumber,
        date:             date ? new Date(date) : returnInv.date,
        customerCode:     customerCode   ?? returnInv.customerCode,
        customerName:     customerName   ?? returnInv.customerName,
        supplierCode:     supplierCode   ?? returnInv.supplierCode,
        supplierName:     supplierName   ?? returnInv.supplierName,
        customerId:       customerId     ?? returnInv.customerId,
        supplierId:       supplierId     ?? returnInv.supplierId,
        warehouse:        newWarehouse,
        totalAmount, totalWeight,
        notes:            notes          ?? returnInv.notes,
        originalInvoiceRef: originalInvoiceRef ?? returnInv.originalInvoiceRef,
        refundMethod,
        refundCashAmount: Number(refundCashAmount) || 0,
        refundBankAmount: Number(refundBankAmount) || 0,
        items: {
          create: recalcItems.map(i => ({
            itemId: i.item, itemCode: i.itemCode, itemName: i.itemName,
            quantity: Number(i.quantity), weight: Number(i.weight), price: Number(i.price), total: i.total,
          })),
        },
      },
      include: invoiceIncludes(),
    });

    // ── إعادة تطبيق أثر المخزن لو كان معتمد ─────────────────────────────────
    if (wasApproved) {
      for (const newItem of updated.items) {
        const newTW  = Number(newItem.quantity) * Number(newItem.weight);
        const mvType = updated.type === 'customer_return' ? 'return_in' : 'return_out';
        const delta  = updated.type === 'customer_return'
          ? { quantity: newItem.quantity, weight: newTW }
          : { quantity: -newItem.quantity, weight: -newTW };
        await updateStock(newItem.itemId, newWarehouse, updated.seasonId, delta);
        await createStockMovement({
          itemId: newItem.itemId, itemCode: newItem.itemCode, itemName: newItem.itemName,
          type: mvType, quantity: newItem.quantity, weight: newTW, price: newItem.price,
          warehouse: newWarehouse, reference: updated.invoiceNumber,
          referenceModel: 'ReturnInvoice', referenceId: updated.id,
          seasonId: updated.seasonId || null, createdById: req.user.id, date: updated.date,
        });
      }
      await recordReturn(updated, req.user);
    }

    await audit(req.user, 'return_updated', 'ReturnInvoice', updated.id, updated.invoiceNumber, { wasApproved, totalAmount: updated.totalAmount });
    res.json({ message: 'تم تعديل المرتجع ✅', returnInv: n(updated) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── APPROVE ───────────────────────────────────────────────────────────────────
const approveReturn = async (req, res) => {
  try {
    const returnInv = await prisma.returnInvoice.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!returnInv) return res.status(404).json({ message: 'المرتجع مش موجود' });
    if (returnInv.status === 'approved') return res.status(400).json({ message: 'المرتجع اتوافق عليه قبل كده' });

    for (const retItem of returnInv.items) {
      const tw     = Number(retItem.quantity) * Number(retItem.weight);
      const mvType = returnInv.type === 'customer_return' ? 'return_in' : 'return_out';
      const delta  = returnInv.type === 'customer_return'
        ? { quantity: retItem.quantity, weight: tw }
        : { quantity: -retItem.quantity, weight: -tw };
      await updateStock(retItem.itemId, returnInv.warehouse, returnInv.seasonId, delta);
      await createStockMovement({
        itemId: retItem.itemId, itemCode: retItem.itemCode, itemName: retItem.itemName,
        type: mvType, quantity: retItem.quantity, weight: tw, price: retItem.price,
        warehouse: returnInv.warehouse, reference: returnInv.invoiceNumber,
        referenceModel: 'ReturnInvoice', referenceId: returnInv.id,
        seasonId: returnInv.seasonId || null, createdById: req.user.id, date: returnInv.date,
      });
    }

    await deleteTreasuryEntries(returnInv.id, 'ReturnInvoice');
    await recordReturn(returnInv, req.user);

    const approved = await prisma.returnInvoice.update({
      where: { id: returnInv.id },
      data:  { status: 'approved', approvedById: req.user.id, approvedAt: new Date() },
    });

    await audit(req.user, 'return_approved', 'ReturnInvoice', approved.id, approved.invoiceNumber, { totalAmount: approved.totalAmount });
    res.json({ message: 'تم الموافقة على المرتجع ✅', returnInv: n(approved) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── REJECT ────────────────────────────────────────────────────────────────────
const rejectReturn = async (req, res) => {
  try {
    const returnInv = await prisma.returnInvoice.findUnique({ where: { id: req.params.id } });
    if (!returnInv) return res.status(404).json({ message: 'المرتجع مش موجود' });

    const updated = await prisma.returnInvoice.update({ where: { id: returnInv.id }, data: { status: 'rejected' } });
    await audit(req.user, 'return_rejected', 'ReturnInvoice', returnInv.id, returnInv.invoiceNumber);
    res.json({ message: 'تم الرفض', returnInv: n(updated) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const n = (x) => ({ ...x, _id: x.id });

module.exports = { getReturns, createReturn, updateReturn, approveReturn, rejectReturn, getReturnById };