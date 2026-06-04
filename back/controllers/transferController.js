// ─── controllers/transferController.js ───────────────────────────────────────
// ✅ CRIT-NEW-002: approveTransfer داخل prisma.$transaction(Serializable)
// ✅ FLOAT-FIX:    calcWeight من Decimal.js
// ✅ CRIT-RC-001:  createTransfer — فحص المخزون بالوزن (ARCH-001) داخل
//                 Serializable transaction لإغلاق نافذة الـ Race Condition
//                 تماماً. الكود القديم كان يفحص خارج الـ tx، ما يُتيح لطلبين
//                 متزامنين اجتياز الفحص وكلاهما يُنشئ تحويلاً ويسبب مخزوناً سالباً.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const prisma         = require('../config/db');
const { safeNum, round2, round3, calcWeight, sumWeights, n, normalizeInvoiceItems } = require('../utils/decimalHelper');
const { audit }      = require('../utils/auditHelper');
const { nextNumber } = require('../utils/counterHelper');
const { getStockQty, updateStock, createStockMovement } = require('../utils/stockHelper');

const getDirection = (from, to) =>
  from === 'ramses' && to === 'october' ? 'ramses_to_october' : 'october_to_ramses';

const mapDirection = (dir) => {
  if (!dir)        return undefined;
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
// ✅ CRIT-RC-001: فحص المخزون + الإنشاء كلهم داخل Serializable transaction واحدة
//   • يمنع Race Condition: لا يمكن لطلبين متزامنين اجتياز الفحص معاً
//   • الفحص بالوزن (ARCH-001) بدل الكمية — متسق مع باقي الكود
//   • nextNumber يعمل داخل نفس الـ tx لضمان الأتومية الكاملة
//   • لو Serializable conflict حصل (P2034) → 409 مع رسالة واضحة للـ client
const createTransfer = async (req, res) => {
  try {
    const { fromWarehouse, toWarehouse, items, notes, date, docNumber } = req.body;

    // ── Validation مبكرة (قبل الـ DB) ──────────────────────────────────────
    if (!docNumber?.trim())           return res.status(400).json({ message: 'أدخل رقم المستند' });
    if (fromWarehouse === toWarehouse) return res.status(400).json({ message: 'المخزن المصدر والهدف لازم يكونوا مختلفين' });
    if (!items?.length)               return res.status(400).json({ message: 'لازم تضيف صنف واحد على الأقل' });

    // ── تطبيع الأوزان بـ Decimal.js قبل الـ tx (لا يحتاج DB) ───────────────
    const recalcItems   = normalizeInvoiceItems(items, { hasPrice: false });
    const totalWeight   = sumWeights(recalcItems.map(i => i.totalWeight));
    const totalQuantity = recalcItems.reduce((s, i) => s + safeNum(i.quantity), 0);

    // ── ✅ CRIT-RC-001: كل عمليات DB داخل Serializable transaction ───────────
    const transfer = await prisma.$transaction(async (tx) => {

      // 1️⃣ جلب الموسم النشط داخل الـ tx (consistent snapshot)
      const activeSeason = await tx.season.findFirst({ where: { isActive: true } });

      // 2️⃣ التحقق من تكرار رقم المستند داخل الـ tx
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

      // 3️⃣ ✅ ARCH-001: فحص المخزون بالوزن داخل الـ tx — يمنع الـ Race Condition
      for (const trItem of recalcItems) {
        const stock = await tx.itemStock.findFirst({
          where: {
            itemId:    trItem.item,
            warehouse: fromWarehouse,
            seasonId:  activeSeason?.id ?? null,
          },
        });
        const availWeight = safeNum(stock?.weight, 0);
        if (availWeight < trItem._tw)
          throw Object.assign(
            new Error(`المخزون مش كافي للصنف "${trItem.itemName}" — متاح: ${availWeight.toFixed(3)} ك، مطلوب: ${trItem._tw.toFixed(3)} ك`),
            { statusCode: 400, code: 'STOCK_INSUFF' },
          );
      }

      // 4️⃣ توليد رقم التحويل داخل الـ tx (atomic مع باقي العمليات)
      const direction      = getDirection(fromWarehouse, toWarehouse);
      const transferNumber = await nextNumber(`TRF_${direction}`, `TRF-${direction}`, tx);

      // 5️⃣ إنشاء التحويل
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
    // ─────────────────────────────────────────────────────────────────────────

    await audit(req.user, 'transfer_created', 'Transfer', transfer.id, transfer.transferNumber, {
      direction: transfer.direction, totalWeight,
    });
    res.status(201).json(n(transfer));

  } catch (err) {
    // ✅ Serializable conflict → أعد المحاولة من الـ client
    if (err.code === 'P2034')
      return res.status(409).json({ message: 'تعارض في العملية، يرجى المحاولة مرة أخرى' });
    // خطأ فحص المخزون أو تكرار المستند
    if (err.statusCode)
      return res.status(err.statusCode).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ── UPDATE ────────────────────────────────────────────────────────────────────
const updateTransfer = async (req, res) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const transfer = await prisma.transfer.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!transfer) return res.status(404).json({ message: 'التحويل مش موجود' });

    // الأدمن يقدر يعدل معتمد — غير الأدمن لأ
    if (transfer.status === 'approved' && !isAdmin)
      return res.status(400).json({ message: 'لا يمكن تعديل تحويل معتمد — فقط الأدمن' });
    if (transfer.status === 'rejected')
      return res.status(400).json({ message: 'لا يمكن تعديل تحويل مرفوض' });

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

    // ✅ تطبيع الأصناف: quantity = totalWeight ÷ unitWeight دائماً
    const recalcItems   = normalizeInvoiceItems(items, { hasPrice: false });
    const totalWeight   = sumWeights(recalcItems.map(i => i.totalWeight));
    const totalQuantity = recalcItems.reduce((s, i) => s + safeNum(i.quantity), 0);

    // ── لو معتمد: عكس الحركات القديمة ثم طبّق الجديدة داخل transaction ───────
    if (transfer.status === 'approved') {
      const updated = await prisma.$transaction(async (tx) => {
        // 1️⃣ عكس حركات المخزون القديمة
        for (const old of transfer.items) {
          const tw = safeNum(old.totalWeight);
          // رجّع للمصدر
          await updateStock(old.itemId, transfer.fromWarehouse, transfer.seasonId, { weight: tw },  tx);
          // اخصم من الهدف
          await updateStock(old.itemId, transfer.toWarehouse,   transfer.seasonId, { weight: -tw }, tx);
        }

        // 2️⃣ طبّق حركات المخزون الجديدة
        for (const ni of recalcItems) {
          const tw = safeNum(ni.totalWeight);
          await updateStock(ni.item, newFrom, transfer.seasonId, { weight: -tw }, tx);
          await updateStock(ni.item, newTo,   transfer.seasonId, { weight:  tw }, tx);

          await createStockMovement({
            itemId: ni.item, itemCode: ni.itemCode, itemName: ni.itemName,
            type: 'transfer_out', quantity: ni.quantity, weight: tw,
            warehouse: newFrom, reference: transfer.transferNumber,
            referenceModel: 'Transfer', referenceId: transfer.id,
            seasonId: transfer.seasonId, createdById: req.user.id, date: date || transfer.date,
          }, tx);
          await createStockMovement({
            itemId: ni.item, itemCode: ni.itemCode, itemName: ni.itemName,
            type: 'transfer_in', quantity: ni.quantity, weight: tw,
            warehouse: newTo, reference: transfer.transferNumber,
            referenceModel: 'Transfer', referenceId: transfer.id,
            seasonId: transfer.seasonId, createdById: req.user.id, date: date || transfer.date,
          }, tx);
        }

        // 3️⃣ حدّث البيانات
        await tx.transferItem.deleteMany({ where: { transferId: transfer.id } });
        return tx.transfer.update({
          where: { id: transfer.id },
          data: {
            docNumber: newDoc, direction: newDirection,
            fromWarehouse: newFrom, toWarehouse: newTo,
            date: date ? new Date(date) : transfer.date,
            totalWeight, totalQuantity, notes,
            items: {
              create: recalcItems.map(i => ({
                itemId: i.item, itemCode: i.itemCode, itemName: i.itemName,
                quantity: safeNum(i.quantity), weight: safeNum(i.weight), totalWeight: i.totalWeight,
              })),
            },
          },
          include: transferIncludes(),
        });
      }, { isolationLevel: 'Serializable' });

      await audit(req.user, 'transfer_updated_approved', 'Transfer', updated.id, updated.transferNumber, { note: 'admin edit on approved' });
      return res.json({ message: 'تم تعديل التحويل المعتمد ✅ (المخزون اتحدّث)', transfer: n(updated) });
    }

    // ── تحويل pending: تعديل عادي بدون حركات مخزون ───────────────────────────
    await prisma.transferItem.deleteMany({ where: { transferId: transfer.id } });

    const updated = await prisma.transfer.update({
      where: { id: transfer.id },
      data: {
        docNumber: newDoc, direction: newDirection,
        fromWarehouse: newFrom, toWarehouse: newTo,
        date: date ? new Date(date) : transfer.date,
        totalWeight, totalQuantity, notes,
        items: {
          create: recalcItems.map(i => ({
            itemId: i.item, itemCode: i.itemCode, itemName: i.itemName,
            quantity: safeNum(i.quantity), weight: safeNum(i.weight), totalWeight: i.totalWeight,
          })),
        },
      },
      include: transferIncludes(),
    });

    await audit(req.user, 'transfer_updated', 'Transfer', updated.id, updated.transferNumber);
    res.json({ message: 'تم التعديل ✅', transfer: n(updated) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── APPROVE ───────────────────────────────────────────────────────────────────
const approveTransfer = async (req, res) => {
  try {
    const transfer = await prisma.transfer.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!transfer)                      return res.status(404).json({ message: 'التحويل مش موجود' });
    if (transfer.status === 'approved') return res.status(400).json({ message: 'التحويل اتوافق عليه قبل كده' });

    // ── Transaction: خصم من المصدر + إضافة للهدف + تسجيل الحركات ─────────────
    const approved = await prisma.$transaction(async (tx) => {
      for (const trItem of transfer.items) {
        // الوزن المخزّن في السطر هو calcWeight مسبقاً — نستخدمه مباشرة
        const tw = safeNum(trItem.totalWeight);

        // خصم من المخزن المصدر
        // ✅ ARCH-001: التحديث بالوزن فقط
        await updateStock(trItem.itemId, transfer.fromWarehouse, transfer.seasonId, { weight: -tw,
         }, tx);

        // إضافة للمخزن الهدف
        // ✅ ARCH-001: التحديث بالوزن فقط
        await updateStock(trItem.itemId, transfer.toWarehouse, transfer.seasonId, { weight: tw,
         }, tx);

        // حركة خروج
        await createStockMovement({
          itemId: trItem.itemId, itemCode: trItem.itemCode, itemName: trItem.itemName,
          type: 'transfer_out', quantity: trItem.quantity, weight: tw,
          warehouse: transfer.fromWarehouse, reference: transfer.transferNumber,
          referenceModel: 'Transfer', referenceId: transfer.id,
          seasonId: transfer.seasonId, createdById: req.user.id, date: transfer.date,
        }, tx);

        // حركة دخول
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
    res.status(500).json({ message: err.message });
  }
};

// ── REJECT ────────────────────────────────────────────────────────────────────
const rejectTransfer = async (req, res) => {
  try {
    const transfer = await prisma.transfer.findUnique({ where: { id: req.params.id } });
    if (!transfer)                      return res.status(404).json({ message: 'التحويل مش موجود' });
    if (transfer.status === 'approved') return res.status(400).json({ message: 'التحويل معتمد — لا يمكن رفضه' });
    const updated = await prisma.transfer.update({ where: { id: transfer.id }, data: { status: 'rejected' } });
    await audit(req.user, 'transfer_rejected', 'Transfer', transfer.id, transfer.transferNumber);
    res.json({ message: 'تم الرفض', transfer: n(updated) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = {
  getTransfers, getTransferById,
  checkDocNumber,
  createTransfer, updateTransfer,
  approveTransfer, rejectTransfer,
};