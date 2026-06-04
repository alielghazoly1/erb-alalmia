// ─── controllers/transferController.js ───────────────────────────────────────
// ✅ LOCK-DIR-001 : fromWarehouse/toWarehouse ثابتان بعد الإنشاء — لا يمكن عكسهما
//                  محمي في Backend بغض النظر عما يرسله الفرونت
// ✅ CRIT-RC-001  : createTransfer — stock check + docNumber داخل Serializable tx
// ✅ ARCH-001     : جميع فحوصات المخزون بالوزن (weight) لا الكمية
// ✅ PAGINATION   : cursor-based pagination بدل offset — يدعم 100,000+ تحويل
// ✅ DELETE       : deleteTransfer — يرفض المعتمد، يحذف pending/rejected
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const prisma         = require('../config/db');
const { safeNum, sumWeights, n, normalizeInvoiceItems } = require('../utils/decimalHelper');
const { audit }      = require('../utils/auditHelper');
const { nextNumber } = require('../utils/counterHelper');
const { updateStock, createStockMovement } = require('../utils/stockHelper');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getDirection = (from, to) =>
  from === 'ramses' && to === 'october' ? 'ramses_to_october' : 'october_to_ramses';

const mapDirection = (dir) => {
  if (!dir)          return undefined;
  if (dir === 'R2O') return 'ramses_to_october';
  if (dir === 'O2R') return 'october_to_ramses';
  return dir;
};

const transferIncludes = () => ({
  items:      { include: { item: { select: { code: true, name: true, defaultWeight: true } } } },
  createdBy:  { select: { name: true } },
  approvedBy: { select: { name: true } },
  season:     { select: { name: true } },
});

// ─── GET all — cursor-based pagination ───────────────────────────────────────
/**
 * ✅ PAGINATION: cursor-based بدل offset
 *   - ?limit=100 عدد السجلات (الافتراضي 100، الحد الأقصى 200)
 *   - ?cursor=<transferId>  يجلب ما بعد هذا الـ ID (تصازلي بالتاريخ ثم createdAt)
 *   - يُعيد { transfers, nextCursor, hasMore, total }
 *   - total فقط عند cursor=null (الصفحة الأولى) لتجنب COUNT في كل request
 */
const getTransfers = async (req, res) => {
  try {
    const {
      status, direction, fromWarehouse, toWarehouse,
      startDate, endDate, search,
      cursor, limit: limitRaw,
    } = req.query;

    const limit = Math.min(parseInt(limitRaw) || 100, 200);

    // ── بناء فلتر WHERE ──────────────────────────────────────────────────────
    const where = {};
    if (status)        where.status        = status;
    if (direction)     where.direction     = mapDirection(direction) || direction;
    if (fromWarehouse) where.fromWarehouse = fromWarehouse;
    if (toWarehouse)   where.toWarehouse   = toWarehouse;
    if (search)        where.OR = [
      { transferNumber: { contains: search, mode: 'insensitive' } },
      { docNumber:      { contains: search, mode: 'insensitive' } },
    ];
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate)   where.date.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    // ── Cursor: جلب سجل الـ cursor لاستخراج date + createdAt ─────────────────
    let cursorFilter = null;
    if (cursor) {
      const pivot = await prisma.transfer.findUnique({
        where:  { id: cursor },
        select: { date: true, createdAt: true },
      });
      if (pivot) {
        cursorFilter = {
          OR: [
            { date: { lt: pivot.date } },
            { date: pivot.date, createdAt: { lt: pivot.createdAt } },
          ],
        };
      }
    }

    const finalWhere = cursorFilter ? { AND: [where, cursorFilter] } : where;

    // ── Query: limit+1 لمعرفة hasMore ─────────────────────────────────────────
    const [transfers, total] = await Promise.all([
      prisma.transfer.findMany({
        where:   finalWhere,
        include: {
          createdBy:  { select: { name: true } },
          approvedBy: { select: { name: true } },
          _count:     { select: { items: true } },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take:    limit + 1,
      }),
      // COUNT فقط في الصفحة الأولى
      !cursor ? prisma.transfer.count({ where }) : Promise.resolve(null),
    ]);

    const hasMore    = transfers.length > limit;
    const page       = hasMore ? transfers.slice(0, limit) : transfers;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    res.json({
      transfers:  page.map(t => n({ ...t, itemsCount: t._count?.items ?? 0 })),
      nextCursor,
      hasMore,
      ...(total !== null ? { total } : {}),
    });
  } catch (err) {
    console.error('[getTransfers]', err);
    res.status(500).json({ message: err.message });
  }
};

// ── GET by ID ─────────────────────────────────────────────────────────────────
const getTransferById = async (req, res) => {
  try {
    const transfer = await prisma.transfer.findUnique({
      where:   { id: req.params.id },
      include: transferIncludes(),
    });
    if (!transfer) return res.status(404).json({ message: 'التحويل مش موجود' });
    res.json(n(transfer));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── CHECK docNumber ───────────────────────────────────────────────────────────
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
/**
 * ✅ CRIT-RC-001: stock check + docNumber + create — كلهم داخل Serializable tx
 * ✅ ARCH-001:    فحص المخزون بالوزن فقط
 */
const createTransfer = async (req, res) => {
  try {
    const { fromWarehouse, toWarehouse, items, notes, date, docNumber } = req.body;

    if (!docNumber?.trim())            return res.status(400).json({ message: 'أدخل رقم المستند' });
    if (fromWarehouse === toWarehouse)  return res.status(400).json({ message: 'المخزن المصدر والهدف لازم يكونوا مختلفين' });
    if (!items?.length)                return res.status(400).json({ message: 'لازم تضيف صنف واحد على الأقل' });

    const recalcItems   = normalizeInvoiceItems(items, { hasPrice: false });
    const totalWeight   = sumWeights(recalcItems.map(i => i.totalWeight));
    const totalQuantity = recalcItems.reduce((s, i) => s + safeNum(i.quantity), 0);

    const transfer = await prisma.$transaction(async (tx) => {
      const activeSeason = await tx.season.findFirst({ where: { isActive: true } });

      const docExists = await tx.transfer.findFirst({
        where: {
          docNumber: docNumber.trim(),
          direction: getDirection(fromWarehouse, toWarehouse),
          seasonId:  activeSeason?.id ?? null,
        },
        select: { transferNumber: true },
      });
      if (docExists)
        throw Object.assign(
          new Error(`رقم المستند "${docNumber}" موجود بالفعل (${docExists.transferNumber})`),
          { statusCode: 400, code: 'DOC_EXISTS' },
        );

      // ✅ ARCH-001: فحص بالوزن داخل الـ tx
      for (const trItem of recalcItems) {
        const stock = await tx.itemStock.findFirst({
          where: { itemId: trItem.item, warehouse: fromWarehouse, seasonId: activeSeason?.id ?? null },
        });
        const availWeight = safeNum(stock?.weight, 0);
        if (availWeight < trItem._tw)
          throw Object.assign(
            new Error(`المخزون مش كافي للصنف "${trItem.itemName}" — متاح: ${availWeight.toFixed(3)} ك، مطلوب: ${trItem._tw.toFixed(3)} ك`),
            { statusCode: 400, code: 'STOCK_INSUFF' },
          );
      }

      const direction      = getDirection(fromWarehouse, toWarehouse);
      const transferNumber = await nextNumber(`TRF_${direction}`, `TRF-${direction}`, tx);

      return tx.transfer.create({
        data: {
          transferNumber, direction, docNumber: docNumber.trim(),
          date:          date ? new Date(date) : new Date(),
          fromWarehouse, toWarehouse, totalWeight, totalQuantity,
          status:        'pending', notes,
          seasonId:      activeSeason?.id ?? null,
          createdById:   req.user.id,
          items: {
            create: recalcItems.map(i => ({
              itemId:      i.item,
              itemCode:    i.itemCode,
              itemName:    i.itemName,
              quantity:    safeNum(i.quantity),
              weight:      safeNum(i.weight),
              totalWeight: i.totalWeight,
            })),
          },
        },
        include: transferIncludes(),
      });
    }, { isolationLevel: 'Serializable' });

    await audit(req.user, 'transfer_created', 'Transfer', transfer.id, transfer.transferNumber, {
      direction: transfer.direction, totalWeight,
    });
    res.status(201).json(n(transfer));
  } catch (err) {
    if (err.code === 'P2034')  return res.status(409).json({ message: 'تعارض في العملية، يرجى المحاولة مرة أخرى' });
    if (err.statusCode)        return res.status(err.statusCode).json({ message: err.message });
    console.error('[createTransfer]', err);
    res.status(500).json({ message: err.message });
  }
};

// ── UPDATE ────────────────────────────────────────────────────────────────────
/**
 * ✅ LOCK-DIR-001: fromWarehouse و toWarehouse ثابتان — يُتجاهل أي تغيير من الفرونت
 *   المسموح بتعديله: items, notes, date, docNumber فقط
 *   لو حاول أحد يغير المخزن → يُرفض بـ 400 صريح
 */
const updateTransfer = async (req, res) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const transfer = await prisma.transfer.findUnique({
      where:   { id: req.params.id },
      include: { items: true },
    });
    if (!transfer) return res.status(404).json({ message: 'التحويل مش موجود' });

    if (transfer.status === 'approved' && !isAdmin)
      return res.status(403).json({ message: 'لا يمكن تعديل تحويل معتمد — فقط الأدمن' });
    if (transfer.status === 'rejected')
      return res.status(400).json({ message: 'لا يمكن تعديل تحويل مرفوض' });

    const { fromWarehouse, toWarehouse, items, notes, date, docNumber } = req.body;

    // ✅ LOCK-DIR-001: رفض أي محاولة لتغيير اتجاه التحويل
    if (fromWarehouse && fromWarehouse !== transfer.fromWarehouse)
      return res.status(400).json({
        message: `لا يمكن تغيير مخزن المصدر — الإذن ثابت على: ${transfer.fromWarehouse} → ${transfer.toWarehouse}`,
        code: 'WAREHOUSE_LOCKED',
      });
    if (toWarehouse && toWarehouse !== transfer.toWarehouse)
      return res.status(400).json({
        message: `لا يمكن تغيير مخزن الهدف — الإذن ثابت على: ${transfer.fromWarehouse} → ${transfer.toWarehouse}`,
        code: 'WAREHOUSE_LOCKED',
      });

    if (!items?.length) return res.status(400).json({ message: 'لازم تضيف صنف واحد على الأقل' });

    // الاتجاه ثابت دائماً
    const lockedFrom = transfer.fromWarehouse;
    const lockedTo   = transfer.toWarehouse;
    const newDoc     = docNumber?.trim() || transfer.docNumber;

    const recalcItems   = normalizeInvoiceItems(items, { hasPrice: false });
    const totalWeight   = sumWeights(recalcItems.map(i => i.totalWeight));
    const totalQuantity = recalcItems.reduce((s, i) => s + safeNum(i.quantity), 0);

    // ── معتمد: عكس القديم وتطبيق الجديد داخل Serializable tx ────────────────
    if (transfer.status === 'approved') {
      const updated = await prisma.$transaction(async (tx) => {

        // فحص docNumber داخل الـ tx
        if (newDoc !== transfer.docNumber) {
          const docExists = await tx.transfer.findFirst({
            where: {
              docNumber: newDoc,
              direction: transfer.direction,
              seasonId:  transfer.seasonId,
              id:        { not: transfer.id },
            },
            select: { transferNumber: true },
          });
          if (docExists)
            throw Object.assign(
              new Error(`رقم المستند "${newDoc}" موجود بالفعل (${docExists.transferNumber})`),
              { statusCode: 400 },
            );
        }

        // عكس المخزون القديم
        for (const old of transfer.items) {
          const tw = safeNum(old.totalWeight);
          await updateStock(old.itemId, lockedFrom, transfer.seasonId, { weight:  tw }, tx);
          await updateStock(old.itemId, lockedTo,   transfer.seasonId, { weight: -tw }, tx);
        }
        await tx.stockMovement.deleteMany({ where: { referenceId: transfer.id } });

        // تطبيق المخزون الجديد
        for (const ni of recalcItems) {
          const tw = safeNum(ni.totalWeight);
          await updateStock(ni.item, lockedFrom, transfer.seasonId, { weight: -tw }, tx);
          await updateStock(ni.item, lockedTo,   transfer.seasonId, { weight:  tw }, tx);
          await createStockMovement({
            itemId: ni.item, itemCode: ni.itemCode, itemName: ni.itemName,
            type: 'transfer_out', quantity: ni.quantity, weight: tw,
            warehouse: lockedFrom, reference: transfer.transferNumber,
            referenceModel: 'Transfer', referenceId: transfer.id,
            seasonId: transfer.seasonId, createdById: req.user.id, date: date || transfer.date,
          }, tx);
          await createStockMovement({
            itemId: ni.item, itemCode: ni.itemCode, itemName: ni.itemName,
            type: 'transfer_in', quantity: ni.quantity, weight: tw,
            warehouse: lockedTo, reference: transfer.transferNumber,
            referenceModel: 'Transfer', referenceId: transfer.id,
            seasonId: transfer.seasonId, createdById: req.user.id, date: date || transfer.date,
          }, tx);
        }

        await tx.transferItem.deleteMany({ where: { transferId: transfer.id } });
        return tx.transfer.update({
          where: { id: transfer.id },
          data: {
            docNumber: newDoc,
            // fromWarehouse و toWarehouse لا يتغيران أبداً
            date:           date ? new Date(date) : transfer.date,
            totalWeight,    totalQuantity,    notes,
            items: {
              create: recalcItems.map(i => ({
                itemId:      i.item,       itemCode:    i.itemCode,
                itemName:    i.itemName,   quantity:    safeNum(i.quantity),
                weight:      safeNum(i.weight),         totalWeight: i.totalWeight,
              })),
            },
          },
          include: transferIncludes(),
        });
      }, { isolationLevel: 'Serializable' });

      await audit(req.user, 'transfer_updated_approved', 'Transfer', updated.id, updated.transferNumber, { note: 'admin edit on approved' });
      return res.json({ message: 'تم تعديل التحويل المعتمد ✅ (المخزون اتحدّث)', transfer: n(updated) });
    }

    // ── pending: تعديل عادي بدون حركات مخزون ─────────────────────────────────
    const updated = await prisma.$transaction(async (tx) => {
      if (newDoc !== transfer.docNumber) {
        const docExists = await tx.transfer.findFirst({
          where: {
            docNumber: newDoc,
            direction: transfer.direction,
            seasonId:  transfer.seasonId,
            id:        { not: transfer.id },
          },
          select: { transferNumber: true },
        });
        if (docExists)
          throw Object.assign(
            new Error(`رقم المستند "${newDoc}" موجود بالفعل (${docExists.transferNumber})`),
            { statusCode: 400 },
          );
      }

      await tx.transferItem.deleteMany({ where: { transferId: transfer.id } });
      return tx.transfer.update({
        where: { id: transfer.id },
        data: {
          docNumber: newDoc,
          date:      date ? new Date(date) : transfer.date,
          totalWeight, totalQuantity, notes,
          items: {
            create: recalcItems.map(i => ({
              itemId:      i.item,       itemCode:    i.itemCode,
              itemName:    i.itemName,   quantity:    safeNum(i.quantity),
              weight:      safeNum(i.weight),         totalWeight: i.totalWeight,
            })),
          },
        },
        include: transferIncludes(),
      });
    }, { isolationLevel: 'Serializable' });

    await audit(req.user, 'transfer_updated', 'Transfer', updated.id, updated.transferNumber);
    res.json({ message: 'تم التعديل ✅', transfer: n(updated) });
  } catch (err) {
    if (err.code   === 'P2034')  return res.status(409).json({ message: 'تعارض في العملية، حاول مرة أخرى' });
    if (err.statusCode)          return res.status(err.statusCode).json({ message: err.message });
    console.error('[updateTransfer]', err);
    res.status(500).json({ message: err.message });
  }
};

// ── APPROVE ───────────────────────────────────────────────────────────────────
const approveTransfer = async (req, res) => {
  try {
    const transfer = await prisma.transfer.findUnique({
      where:   { id: req.params.id },
      include: { items: true },
    });
    if (!transfer)                      return res.status(404).json({ message: 'التحويل مش موجود' });
    if (transfer.status === 'approved') return res.status(400).json({ message: 'التحويل اتوافق عليه قبل كده' });

    const approved = await prisma.$transaction(async (tx) => {
      for (const trItem of transfer.items) {
        const tw = safeNum(trItem.totalWeight);
        await updateStock(trItem.itemId, transfer.fromWarehouse, transfer.seasonId, { weight: -tw }, tx);
        await updateStock(trItem.itemId, transfer.toWarehouse,   transfer.seasonId, { weight:  tw }, tx);
        await createStockMovement({
          itemId: trItem.itemId, itemCode: trItem.itemCode, itemName: trItem.itemName,
          type: 'transfer_out', quantity: trItem.quantity, weight: tw,
          warehouse: transfer.fromWarehouse, reference: transfer.transferNumber,
          referenceModel: 'Transfer', referenceId: transfer.id,
          seasonId: transfer.seasonId, createdById: req.user.id, date: transfer.date,
        }, tx);
        await createStockMovement({
          itemId: trItem.itemId, itemCode: trItem.itemCode, itemName: trItem.itemName,
          type: 'transfer_in', quantity: trItem.quantity, weight: tw,
          warehouse: transfer.toWarehouse, reference: transfer.transferNumber,
          referenceModel: 'Transfer', referenceId: transfer.id,
          seasonId: transfer.seasonId, createdById: req.user.id, date: transfer.date,
        }, tx);
      }
      return tx.transfer.update({
        where: { id: transfer.id },
        data:  { status: 'approved', approvedById: req.user.id, approvedAt: new Date() },
      });
    }, { isolationLevel: 'Serializable' });

    await audit(req.user, 'transfer_approved', 'Transfer', approved.id, approved.transferNumber, { totalWeight: approved.totalWeight });
    res.json({ message: 'تم التحويل بنجاح ✅', transfer: n(approved) });
  } catch (err) {
    if (err.code === 'P2034') return res.status(409).json({ message: 'تعارض في العملية، يرجى المحاولة مرة أخرى' });
    console.error('[approveTransfer]', err);
    res.status(500).json({ message: err.message });
  }
};

// ── REJECT ────────────────────────────────────────────────────────────────────
const rejectTransfer = async (req, res) => {
  try {
    const transfer = await prisma.transfer.findUnique({ where: { id: req.params.id } });
    if (!transfer)                      return res.status(404).json({ message: 'التحويل مش موجود' });
    if (transfer.status === 'approved') return res.status(400).json({ message: 'التحويل معتمد — لا يمكن رفضه' });
    const updated = await prisma.transfer.update({
      where: { id: transfer.id },
      data:  { status: 'rejected' },
    });
    await audit(req.user, 'transfer_rejected', 'Transfer', transfer.id, transfer.transferNumber);
    res.json({ message: 'تم الرفض', transfer: n(updated) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── DELETE ────────────────────────────────────────────────────────────────────
/**
 * ✅ DELETE: يحذف التحويل بشرطين:
 *   1. فقط pending أو rejected — المعتمد لا يُحذف (يؤثر على المخزون)
 *   2. الأدمن فقط يقدر يحذف
 */
const deleteTransfer = async (req, res) => {
  try {
    const transfer = await prisma.transfer.findUnique({
      where:   { id: req.params.id },
      include: { items: true },
    });
    if (!transfer) return res.status(404).json({ message: 'التحويل مش موجود' });

    if (transfer.status === 'approved')
      return res.status(400).json({
        message: 'لا يمكن حذف تحويل معتمد — يؤثر على المخزون. قم بعكسه أولاً أو تواصل مع المدير.',
        code: 'CANNOT_DELETE_APPROVED',
      });

    await prisma.$transaction(async (tx) => {
      await tx.transferItem.deleteMany({ where: { transferId: transfer.id } });
      await tx.transfer.delete({ where: { id: transfer.id } });
    });

    await audit(req.user, 'transfer_deleted', 'Transfer', transfer.id, transfer.transferNumber, {
      status: transfer.status,
    });
    res.json({ message: 'تم حذف التحويل ✅', id: transfer.id });
  } catch (err) {
    console.error('[deleteTransfer]', err);
    res.status(500).json({ message: err.message });
  }
};

// ── REVERSE & DELETE (approved only) ─────────────────────────────────────────
/**
 * ✅ REVERSE-DELETE:
 *   - يقبل فقط التحويلات ذات status = 'approved'
 *   - يعكس المخزون (يُرجع الـ fromWarehouse ويخصم الـ toWarehouse)
 *   - يحذف حركات المخزون المرتبطة
 *   - يحذف التحويل نهائياً
 *   - كل ده داخل Serializable tx لضمان التناسق
 *   - admin only
 */
const reverseAndDeleteTransfer = async (req, res) => {
  try {
    const transfer = await prisma.transfer.findUnique({
      where:   { id: req.params.id },
      include: { items: true },
    });
    if (!transfer) return res.status(404).json({ message: 'التحويل مش موجود' });

    if (transfer.status !== 'approved')
      return res.status(400).json({
        message: 'العملية دي بس للتحويلات المعتمدة — الحالة الحالية: ' + transfer.status,
        code: 'NOT_APPROVED',
      });

    await prisma.$transaction(async (tx) => {
      // عكس المخزون: نرجع الـ fromWarehouse ونخصم الـ toWarehouse
      for (const trItem of transfer.items) {
        const tw = safeNum(trItem.totalWeight);
        await updateStock(trItem.itemId, transfer.fromWarehouse, transfer.seasonId, { weight:  tw }, tx);
        await updateStock(trItem.itemId, transfer.toWarehouse,   transfer.seasonId, { weight: -tw }, tx);
      }

      // حذف حركات المخزون المرتبطة
      await tx.stockMovement.deleteMany({ where: { referenceId: transfer.id } });

      // حذف أصناف التحويل ثم التحويل نفسه
      await tx.transferItem.deleteMany({ where: { transferId: transfer.id } });
      await tx.transfer.delete({ where: { id: transfer.id } });
    }, { isolationLevel: 'Serializable' });

    await audit(req.user, 'transfer_reversed_deleted', 'Transfer', transfer.id, transfer.transferNumber, {
      direction:   transfer.direction,
      totalWeight: transfer.totalWeight,
      note:        'reversed stock and deleted by admin',
    });

    res.json({
      message: `تم عكس المخزون وحذف التحويل ${transfer.transferNumber} ✅`,
      id:      transfer.id,
    });
  } catch (err) {
    if (err.code === 'P2034') return res.status(409).json({ message: 'تعارض في العملية، حاول مرة أخرى' });
    console.error('[reverseAndDeleteTransfer]', err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getTransfers, getTransferById,
  checkDocNumber,
  createTransfer, updateTransfer,
  approveTransfer, rejectTransfer,
  deleteTransfer,
  reverseAndDeleteTransfer,
};
