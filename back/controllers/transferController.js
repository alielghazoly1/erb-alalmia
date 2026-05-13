// ─── controllers/transferController.js ───────────────────────────────────────
const prisma         = require('../config/db');
const { audit }      = require('../utils/auditHelper');
const { nextNumber } = require('../utils/counterHelper');
const { getStockQty, updateStock, createStockMovement } = require('../utils/stockHelper');

const getDirection = (from, to) =>
  from === 'ramses' && to === 'october' ? 'ramses_to_october' : 'october_to_ramses';

const transferIncludes = () => ({
  items:      { include: { item: { select: { code: true, name: true, defaultWeight: true } } } },
  createdBy:  { select: { name: true } },
  approvedBy: { select: { name: true } },
  season:     { select: { name: true } },
});

// ── GET all ───────────────────────────────────────────────────────────────────
const getTransfers = async (req, res) => {
  try {
    const { status, direction, fromWarehouse, toWarehouse, startDate, endDate, search } = req.query;
    const where = {};
    if (status)        where.status        = status;
    if (direction)     where.direction     = direction;
    if (fromWarehouse) where.fromWarehouse = fromWarehouse;
    if (toWarehouse)   where.toWarehouse   = toWarehouse;
    if (search)        where.transferNumber = { contains: search, mode: 'insensitive' };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate)   where.date.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }
    const transfers = await prisma.transfer.findMany({
      where,
      include: { createdBy: { select: { name: true } }, approvedBy: { select: { name: true } } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(transfers.map(n));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET by ID ─────────────────────────────────────────────────────────────────
const getTransferById = async (req, res) => {
  try {
    const transfer = await prisma.transfer.findUnique({ where: { id: req.params.id }, include: transferIncludes() });
    if (!transfer) return res.status(404).json({ message: 'التحويل مش موجود' });
    res.json(n(transfer));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── CHECK docNumber ───────────────────────────────────────────────────────────
// Map frontend short codes to DB enum values
const mapDirection = (dir) => {
  if (!dir) return undefined;
  if (dir === 'R2O') return 'ramses_to_october';
  if (dir === 'O2R') return 'october_to_ramses';
  return dir; // already full name
};

const checkDocNumber = async (req, res) => {
  try {
    const { docNumber, direction, seasonId, excludeId } = req.query;
    if (!docNumber?.trim()) return res.json({ exists: false });
    const mappedDir = mapDirection(direction);
    const where = { docNumber: docNumber.trim() };
    if (mappedDir) where.direction = mappedDir;
    if (seasonId)  where.seasonId  = seasonId;
    if (excludeId) where.id        = { not: excludeId };
    const exists = await prisma.transfer.findFirst({ where, select: { transferNumber: true } });
    res.json({ exists: !!exists, transferNumber: exists?.transferNumber || null });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── CREATE ────────────────────────────────────────────────────────────────────
const createTransfer = async (req, res) => {
  try {
    const { fromWarehouse, toWarehouse, items, notes, date, docNumber } = req.body;

    if (!docNumber?.trim())           return res.status(400).json({ message: 'أدخل رقم المستند' });
    if (fromWarehouse === toWarehouse) return res.status(400).json({ message: 'المخزن المصدر والهدف لازم يكونوا مختلفين' });
    if (!items?.length)               return res.status(400).json({ message: 'لازم تضيف صنف واحد على الأقل' });

    const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });

    // التحقق من المخزون
    for (const trItem of items) {
      const { quantity: availQty, weight: availWeight } = await getStockQty(trItem.item, fromWarehouse, activeSeason?.id);
      const neededWeight = Number(trItem.quantity) * Number(trItem.weight);
      if (availQty < Number(trItem.quantity))
        return res.status(400).json({ message: `العدد مش كافي للصنف "${trItem.itemName}" — متاح: ${availQty}` });
      if (availWeight < neededWeight)
        return res.status(400).json({ message: `الوزن مش كافي للصنف "${trItem.itemName}" — متاح: ${availWeight.toFixed(2)} ك` });
    }

    const direction      = getDirection(fromWarehouse, toWarehouse);
    const transferNumber = await nextNumber(`TRF_${direction}`, `TRF-${direction}`);

    const docExists = await prisma.transfer.findFirst({
      where: { docNumber: docNumber.trim(), direction: getDirection(fromWarehouse, toWarehouse), seasonId: activeSeason?.id },
      select: { transferNumber: true },
    });
    if (docExists)
      return res.status(400).json({ message: `رقم المستند "${docNumber}" موجود بالفعل (${docExists.transferNumber})` });

    const recalcItems   = items.map(i => ({ ...i, totalWeight: Number(i.quantity) * Number(i.weight) }));
    const totalWeight   = recalcItems.reduce((s, i) => s + i.totalWeight, 0);
    const totalQuantity = recalcItems.reduce((s, i) => s + Number(i.quantity), 0);

    const transfer = await prisma.transfer.create({
      data: {
        transferNumber, direction, docNumber: docNumber.trim(),
        date: date ? new Date(date) : new Date(),
        fromWarehouse, toWarehouse, totalWeight, totalQuantity,
        status: 'pending', notes,
        seasonId: activeSeason?.id ?? null, createdById: req.user.id,
        items: {
          create: recalcItems.map(i => ({
            itemId: i.item, itemCode: i.itemCode, itemName: i.itemName,
            quantity: Number(i.quantity), weight: Number(i.weight), totalWeight: i.totalWeight,
          })),
        },
      },
      include: transferIncludes(),
    });

    await audit(req.user, 'transfer_created', 'Transfer', transfer.id, transfer.transferNumber, { direction, totalWeight });
    res.status(201).json(n(transfer));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── UPDATE ────────────────────────────────────────────────────────────────────
const updateTransfer = async (req, res) => {
  try {
    const transfer = await prisma.transfer.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!transfer) return res.status(404).json({ message: 'التحويل مش موجود' });
    if (transfer.status === 'rejected') return res.status(400).json({ message: 'لا يمكن تعديل تحويل مرفوض' });

    const { fromWarehouse, toWarehouse, items, notes, date, docNumber } = req.body;
    if (!items?.length) return res.status(400).json({ message: 'لازم تضيف صنف واحد على الأقل' });

    const newFrom      = fromWarehouse || transfer.fromWarehouse;
    const newTo        = toWarehouse   || transfer.toWarehouse;
    const newDoc       = docNumber?.trim() || transfer.docNumber;
    const newDirection = getDirection(newFrom, newTo);

    if (newFrom === newTo) return res.status(400).json({ message: 'المخزن المصدر والهدف لازم يكونوا مختلفين' });

    if (newDoc !== transfer.docNumber || newDirection !== transfer.direction) {
      const docExists = await prisma.transfer.findFirst({
        where: { docNumber: newDoc, direction: newDirection, seasonId: transfer.seasonId, id: { not: transfer.id } },
        select: { transferNumber: true },
      });
      if (docExists)
        return res.status(400).json({ message: `رقم المستند "${newDoc}" موجود بالفعل (${docExists.transferNumber})` });
    }

    const wasApproved = transfer.status === 'approved';

    // عكس المخزن القديم
    if (wasApproved) {
      for (const oldItem of transfer.items) {
        await updateStock(oldItem.itemId, transfer.fromWarehouse, transfer.seasonId, { quantity: oldItem.quantity,  weight: oldItem.totalWeight  });
        await updateStock(oldItem.itemId, transfer.toWarehouse,   transfer.seasonId, { quantity: -oldItem.quantity, weight: -oldItem.totalWeight });
      }
      await prisma.stockMovement.deleteMany({ where: { referenceModel: 'Transfer', referenceId: transfer.id } });
    }

    // التحقق من المخزون الجديد
    for (const trItem of items) {
      const { quantity: availQty, weight: availWeight } = await getStockQty(trItem.item, newFrom, transfer.seasonId);
      const neededWeight = Number(trItem.quantity) * Number(trItem.weight);
      if (availQty < Number(trItem.quantity))
        return res.status(400).json({ message: `العدد مش كافي للصنف "${trItem.itemName}" — متاح: ${availQty}` });
      if (availWeight < neededWeight)
        return res.status(400).json({ message: `الوزن مش كافي للصنف "${trItem.itemName}" — متاح: ${availWeight.toFixed(2)} ك` });
    }

    const recalcItems   = items.map(i => ({ ...i, totalWeight: Number(i.quantity) * Number(i.weight) }));
    const totalWeight   = recalcItems.reduce((s, i) => s + i.totalWeight, 0);
    const totalQuantity = recalcItems.reduce((s, i) => s + Number(i.quantity), 0);

    await prisma.transferItem.deleteMany({ where: { transferId: transfer.id } });

    const updated = await prisma.transfer.update({
      where: { id: transfer.id },
      data: {
        fromWarehouse: newFrom, toWarehouse: newTo, direction: newDirection,
        docNumber: newDoc, totalWeight, totalQuantity,
        notes: notes ?? transfer.notes,
        date:  date ? new Date(date) : transfer.date,
        items: { create: recalcItems.map(i => ({ itemId: i.item, itemCode: i.itemCode, itemName: i.itemName, quantity: Number(i.quantity), weight: Number(i.weight), totalWeight: i.totalWeight })) },
      },
      include: transferIncludes(),
    });

    // إعادة تطبيق المخزن الجديد لو كان معتمد
    if (wasApproved) {
      for (const newItem of updated.items) {
        await updateStock(newItem.itemId, newFrom, updated.seasonId, { quantity: -newItem.quantity, weight: -newItem.totalWeight });
        await updateStock(newItem.itemId, newTo,   updated.seasonId, { quantity:  newItem.quantity, weight:  newItem.totalWeight  });
        await createStockMovement({ itemId: newItem.itemId, itemCode: newItem.itemCode, itemName: newItem.itemName, type: 'transfer_out', quantity: newItem.quantity, weight: newItem.totalWeight, warehouse: newFrom, reference: updated.transferNumber, referenceModel: 'Transfer', referenceId: updated.id, seasonId: updated.seasonId, createdById: req.user.id, date: updated.date });
        await createStockMovement({ itemId: newItem.itemId, itemCode: newItem.itemCode, itemName: newItem.itemName, type: 'transfer_in',  quantity: newItem.quantity, weight: newItem.totalWeight, warehouse: newTo,   reference: updated.transferNumber, referenceModel: 'Transfer', referenceId: updated.id, seasonId: updated.seasonId, createdById: req.user.id, date: updated.date });
      }
    }

    await audit(req.user, 'transfer_updated', 'Transfer', updated.id, updated.transferNumber, { wasApproved, totalWeight });
    res.json({ message: 'تم تعديل التحويل ✅', transfer: n(updated) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── APPROVE ───────────────────────────────────────────────────────────────────
const approveTransfer = async (req, res) => {
  try {
    const transfer = await prisma.transfer.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!transfer) return res.status(404).json({ message: 'التحويل مش موجود' });
    if (transfer.status === 'approved') return res.status(400).json({ message: 'التحويل اتوافق عليه قبل كده' });

    for (const trItem of transfer.items) {
      await updateStock(trItem.itemId, transfer.fromWarehouse, transfer.seasonId, { quantity: -trItem.quantity, weight: -trItem.totalWeight });
      await updateStock(trItem.itemId, transfer.toWarehouse,   transfer.seasonId, { quantity:  trItem.quantity, weight:  trItem.totalWeight  });
      await createStockMovement({ itemId: trItem.itemId, itemCode: trItem.itemCode, itemName: trItem.itemName, type: 'transfer_out', quantity: trItem.quantity, weight: trItem.totalWeight, warehouse: transfer.fromWarehouse, reference: transfer.transferNumber, referenceModel: 'Transfer', referenceId: transfer.id, seasonId: transfer.seasonId, createdById: req.user.id, date: transfer.date });
      await createStockMovement({ itemId: trItem.itemId, itemCode: trItem.itemCode, itemName: trItem.itemName, type: 'transfer_in',  quantity: trItem.quantity, weight: trItem.totalWeight, warehouse: transfer.toWarehouse,   reference: transfer.transferNumber, referenceModel: 'Transfer', referenceId: transfer.id, seasonId: transfer.seasonId, createdById: req.user.id, date: transfer.date });
    }

    const approved = await prisma.transfer.update({
      where: { id: transfer.id },
      data:  { status: 'approved', approvedById: req.user.id, approvedAt: new Date() },
    });

    await audit(req.user, 'transfer_approved', 'Transfer', approved.id, approved.transferNumber, { totalWeight: approved.totalWeight });
    res.json({ message: 'تم التحويل بنجاح ✅', transfer: n(approved) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── REJECT ────────────────────────────────────────────────────────────────────
const rejectTransfer = async (req, res) => {
  try {
    const transfer = await prisma.transfer.findUnique({ where: { id: req.params.id } });
    if (!transfer) return res.status(404).json({ message: 'التحويل مش موجود' });
    if (transfer.status === 'approved') return res.status(400).json({ message: 'التحويل معتمد — لا يمكن رفضه' });
    const updated = await prisma.transfer.update({ where: { id: transfer.id }, data: { status: 'rejected' } });
    await audit(req.user, 'transfer_rejected', 'Transfer', transfer.id, transfer.transferNumber);
    res.json({ message: 'تم الرفض', transfer: n(updated) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

const n = (x) => ({ ...x, _id: x.id });

module.exports = { getTransfers, getTransferById, checkDocNumber, createTransfer, updateTransfer, approveTransfer, rejectTransfer };
