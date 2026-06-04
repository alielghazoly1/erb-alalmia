// controllers/stockAdjustmentController.js
// تسوية المخزون (جرد) — كل حركة تُسجَّل في stock_movements
// ✅ UPDATED    : StockAdjustmentLine qty fields now use Decimal
//
// ✅ FIX-ADJ-001: createAdjustment — counter (ADJ) داخل Serializable tx
//                الكود القديم كان يعمل upsert بدون tx → race condition →
//                جهازان ممكن يولّدان نفس refNumber في نفس الثانية
//
// ✅ FIX-ADJ-002: approveAdjustment — كل recordStockMovement + update status
//                داخل Serializable tx واحدة. الكود القديم كان يُطبّق الـ loop
//                بدون tx — خطأ في الصف الثالث يترك الأولين محدَّثين والباقي لأ،
//                والـ status يبقى pending → إعادة المحاولة تُضاعف التعديلات
//
// ✅ FIX-ADJ-003: approveAdjustment — فحص المخزون السالب قبل تطبيق adjustment_sub
//                الكود القديم لم يكن يتحقق — طرح أكثر من المتاح كان مسموحاً
'use strict';

const prisma = require('../config/db');
const { safeNum, round2, round3, n } = require('../utils/decimalHelper');
const { getActiveSeason } = require('../utils/seasonHelper');
const { recordStockMovement, getStockBalance } = require('../utils/stockHelper');

const PAGE_SIZE = 50;

// ── GET /api/stock-adjustments ────────────────────────────────────────────────
const getAdjustments = async (req, res) => {
  try {
    const { warehouse, page = 1 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const skip = (pageNum - 1) * PAGE_SIZE;
    const where = {};
    if (warehouse) where.warehouse = warehouse;
    const [adjustments, total] = await Promise.all([
      prisma.stockAdjustment.findMany({
        where,
        skip,
        take: PAGE_SIZE,
        orderBy: { date: 'desc' },
        include: {
          lines: {
            include: { item: { select: { id: true, code: true, name: true, unit: true } } },
          },
          season: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true } },
        },
      }),
      prisma.stockAdjustment.count({ where }),
    ]);
    res.json({ adjustments, total, page: pageNum, pageSize: PAGE_SIZE });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET /api/stock-adjustments/:id ────────────────────────────────────────────
const getAdjustmentById = async (req, res) => {
  try {
    const adj = await prisma.stockAdjustment.findUnique({
      where: { id: req.params.id },
      include: {
        lines: {
          include: { item: { select: { id: true, code: true, name: true, unit: true, defaultWeight: true } } },
        },
        season: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!adj) return res.status(404).json({ message: 'التسوية مش موجودة' });
    res.json(adj);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── POST /api/stock-adjustments ──────────────────────────────────────────────
// ✅ FIX-ADJ-001: counter + create داخل Serializable tx واحدة
//   • يمنع race condition على refNumber
//   • snapshot ثابت للمخزون داخل الـ tx
const createAdjustment = async (req, res) => {
  try {
    const { warehouse, notes, lines } = req.body;
    if (!warehouse || !lines?.length)
      return res.status(400).json({ message: 'المخزن وخطوط التسوية مطلوبة' });

    const season = await getActiveSeason();
    if (!season) return res.status(400).json({ message: 'لا يوجد موسم نشط' });

    // ── Serializable tx: counter + بناء الـ lines + الإنشاء atomic ───────────
    const adjustment = await prisma.$transaction(async (tx) => {
      const prefix = 'ADJ';

      // 1️⃣ ✅ FIX-ADJ-001: توليد refNumber داخل الـ tx — atomic
      const counter = await tx.seasonCounter.upsert({
        where:  { seasonId_prefix: { seasonId: season.id, prefix } },
        update: { value: { increment: 1 } },
        create: { seasonId: season.id, prefix, value: 1, startFrom: 1 },
      });
      const refNumber = `${prefix}-${season.code}-${String(counter.value).padStart(5, '0')}`;

      // 2️⃣ بناء الـ lines مع قراءة المخزون الحالي داخل الـ tx (consistent snapshot)
      const adjustmentLines = [];
      for (const line of lines) {
        const item = await tx.item.findUnique({ where: { id: line.itemId } });
        if (!item)
          throw Object.assign(new Error(`الصنف ${line.itemId} مش موجود`), { statusCode: 404 });

        const stock = await tx.itemStock.findFirst({
          where: { itemId: item.id, warehouse, seasonId: season.id },
        });

        const systemQty    = safeNum(stock?.quantity || 0);
        const systemWeight = safeNum(stock?.weight   || 0);
        const actualQty    = safeNum(line.actualQty);
        const actualWeight = safeNum(line.actualWeight);

        adjustmentLines.push({
          itemId:       item.id,
          itemCode:     item.code,
          itemName:     item.name,
          systemQty,
          systemWeight,
          actualQty,
          actualWeight,
          diffQty:    round3(actualQty    - systemQty),
          diffWeight: round3(actualWeight - systemWeight),
          notes:      line.notes,
        });
      }

      // 3️⃣ إنشاء التسوية
      return tx.stockAdjustment.create({
        data: {
          refNumber,
          warehouse,
          notes,
          seasonId:    season.id,
          createdById: req.user.id,
          lines:       { create: adjustmentLines },
        },
        include: {
          lines:     { include: { item: { select: { id: true, code: true, name: true, unit: true } } } },
          season:    { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });

    }, { isolationLevel: 'Serializable' });
    // ─────────────────────────────────────────────────────────────────────────

    res.status(201).json(adjustment);

  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    if (err.code === 'P2034') return res.status(409).json({ message: 'تعارض في العملية، حاول مرة أخرى' });
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/stock-adjustments/:id/approve ──────────────────────────────────
// ✅ FIX-ADJ-002: كل حركات المخزون + تحديث الـ status داخل Serializable tx
//   • لو فشل أي صف — كل شيء يُلغى، المخزون لا يتلف، الـ status يبقى pending
//   • إعادة المحاولة آمنة 100% — لا تضاعف
// ✅ FIX-ADJ-003: فحص المخزون السالب قبل تطبيق أي adjustment_sub
//   • لو الفرق سالب وأكبر من المتاح → رفض مبكر بمسمى الصنف المشكل
const approveAdjustment = async (req, res) => {
  try {
    const adjustment = await prisma.stockAdjustment.findUnique({
      where:   { id: req.params.id },
      include: {
        lines: {
          include: { item: { select: { id: true, code: true, name: true, unit: true, defaultWeight: true } } },
        },
      },
    });
    if (!adjustment)        return res.status(404).json({ message: 'التسوية مش موجودة' });
    if (adjustment.approvedAt) return res.status(400).json({ message: 'التسوية معتمدة بالفعل' });

    const season = await getActiveSeason();
    if (!season) return res.status(400).json({ message: 'لا يوجد موسم نشط' });

    // ── Serializable tx: فحص + تطبيق + تحديث الـ status atomic ──────────────
    const updated = await prisma.$transaction(async (tx) => {

      // ✅ FIX-ADJ-003: فحص المخزون السالب على كل صف قبل أي تعديل
      for (const line of adjustment.lines) {
        const diffWeight = safeNum(line.diffWeight);
        if (diffWeight < 0) {
          const balance = await getStockBalance(
            line.itemId, adjustment.warehouse, season.id, tx,
          );
          if (balance.weight + diffWeight < 0)
            throw Object.assign(
              new Error(
                `"${line.itemName}" — الوزن المتاح ${balance.weight.toFixed(3)} ك` +
                ` أقل من المطلوب طرحه ${Math.abs(diffWeight).toFixed(3)} ك`,
              ),
              { statusCode: 400 },
            );
        }
      }

      // ✅ FIX-ADJ-002: تطبيق حركات المخزون كلها داخل الـ tx
      for (const line of adjustment.lines) {
        const diffQty    = safeNum(line.diffQty);
        const diffWeight = safeNum(line.diffWeight);

        if (diffQty !== 0 || diffWeight !== 0) {
          const type = diffWeight >= 0 ? 'adjustment_add' : 'adjustment_sub';
          await recordStockMovement({
            itemId:         line.itemId,
            itemCode:       line.itemCode,
            itemName:       line.itemName,
            type,
            quantityIn:     diffQty    > 0 ? diffQty            : 0,
            quantityOut:    diffQty    < 0 ? Math.abs(diffQty)  : 0,
            weightIn:       diffWeight > 0 ? diffWeight         : 0,
            weightOut:      diffWeight < 0 ? Math.abs(diffWeight) : 0,
            price:          0,
            warehouse:      adjustment.warehouse,
            reference:      adjustment.refNumber,
            referenceModel: 'StockAdjustment',
            referenceId:    adjustment.id,
            seasonId:       season.id,
            userId:         req.user.id,
          }, tx);  // ← tx مُمرَّر — الحركة atomic مع باقي الـ loop
        }
      }

      // تحديث الـ status — داخل نفس الـ tx
      return tx.stockAdjustment.update({
        where:   { id: adjustment.id },
        data:    { approvedAt: new Date() },
        include: {
          lines:     { include: { item: { select: { id: true, code: true, name: true, unit: true } } } },
          season:    { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true } },
        },
      });

    }, { isolationLevel: 'Serializable', timeout: 30000 });
    // ─────────────────────────────────────────────────────────────────────────

    res.json(updated);

  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ message: err.message });
    if (err.code === 'P2034') return res.status(409).json({ message: 'تعارض في العملية، حاول مرة أخرى' });
    res.status(500).json({ message: err.message });
  }
};

// ── DELETE /api/stock-adjustments/:id ─────────────────────────────────────────
const deleteAdjustment = async (req, res) => {
  try {
    const adj = await prisma.stockAdjustment.findUnique({
      where:   { id: req.params.id },
      include: { lines: true },
    });
    if (!adj)         return res.status(404).json({ message: 'التسوية مش موجودة' });
    if (adj.approvedAt) return res.status(400).json({ message: 'لا يمكن حذف تسوية معتمدة' });

    await prisma.stockAdjustmentLine.deleteMany({ where: { adjustmentId: adj.id } });
    await prisma.stockAdjustment.delete({ where: { id: adj.id } });
    res.json({ message: 'تم الحذف' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getAdjustments, getAdjustmentById, createAdjustment, approveAdjustment, deleteAdjustment };