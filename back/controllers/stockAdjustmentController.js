// ─── controllers/stockAdjustmentController.js ────────────────────────────────
// تسوية المخزون (جرد) — كل حركة تُسجَّل في stock_movements
// ✅ UPDATED: StockAdjustmentLine qty fields now use Decimal
// ─────────────────────────────────────────────────────────────────────────────

const prisma = require('../config/db');
const { safeNum, round2, round3, n } = require('../utils/decimalHelper');
const { getActiveSeason } = require('../utils/seasonHelper');
const { recordStockMovement } = require('../utils/stockHelper');

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

// ── POST /api/stock-adjustments ─────────────────────────────────────────────────
const createAdjustment = async (req, res) => {
  try {
    const { warehouse, notes, lines } = req.body;
    if (!warehouse || !lines?.length) {
      return res.status(400).json({ message: 'المخزن وخطوط التسوية مطلوبة' });
    }
    const season = await getActiveSeason();
    if (!season) return res.status(400).json({ message: 'لا يوجد موسم نشط' });

    // ── Generate refNumber ───────────────────────────────────────────────────
    const prefix = 'ADJ';
    const counter = await prisma.seasonCounter.upsert({
      where: { seasonId_prefix: { seasonId: season.id, prefix } },
      update: { value: { increment: 1 } },
      create: { seasonId: season.id, prefix, value: 1, startFrom: 1 },
    });
    const refNumber = `${prefix}-${season.code}-${String(counter.value).padStart(5, '0')}`;

    // ── Build lines with Decimal-safe calculations ──────────────────────────
    const adjustmentLines = [];
    for (const line of lines) {
      const item = await prisma.item.findUnique({ where: { id: line.itemId } });
      if (!item) throw new Error(`الصنف ${line.itemId} مش موجود`);

      const stock = await prisma.itemStock.findFirst({
        where: { itemId: item.id, warehouse, seasonId: season.id },
      });

      // ✅ Decimal-safe: use safeNum() for qty fields
      const systemQty = safeNum(stock?.quantity || 0);
      const systemWeight = safeNum(stock?.weight || 0);
      const actualQty = safeNum(line.actualQty);
      const actualWeight = safeNum(line.actualWeight);
      const diffQty = round3(actualQty - systemQty);
      const diffWeight = round3(actualWeight - systemWeight);

      adjustmentLines.push({
        itemId: item.id,
        itemCode: item.code,
        itemName: item.name,
        systemQty,        // ✅ Decimal
        systemWeight,     // ✅ Decimal
        actualQty,        // ✅ Decimal
        actualWeight,     // ✅ Decimal
        diffQty,          // ✅ Decimal
        diffWeight,       // ✅ Decimal
        notes: line.notes,
      });
    }

    const adjustment = await prisma.stockAdjustment.create({
      data: {
        refNumber,
        warehouse,
        notes,
        seasonId: season.id,
        createdById: req.user.id,
        lines: { create: adjustmentLines },
      },
      include: {
        lines: {
          include: { item: { select: { id: true, code: true, name: true, unit: true } } },
        },
        season: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(adjustment);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── POST /api/stock-adjustments/:id/approve ───────────────────────────────────
const approveAdjustment = async (req, res) => {
  try {
    const adjustment = await prisma.stockAdjustment.findUnique({
      where: { id: req.params.id },
      include: {
        lines: {
          include: { item: { select: { id: true, code: true, name: true, unit: true, defaultWeight: true } } },
        },
      },
    });
    if (!adjustment) return res.status(404).json({ message: 'التسوية مش موجودة' });
    if (adjustment.approvedAt) return res.status(400).json({ message: 'التسوية معتمدة بالفعل' });

    const season = await getActiveSeason();
    if (!season) return res.status(400).json({ message: 'لا يوجد موسم نشط' });

    // ── Apply stock changes ────────────────────────────────────────────────────
    for (const line of adjustment.lines) {
      const diffQty = safeNum(line.diffQty);
      const diffWeight = safeNum(line.diffWeight);

      if (diffQty !== 0 || diffWeight !== 0) {
        const type = diffQty > 0 ? 'adjustment_add' : 'adjustment_sub';
        await recordStockMovement({
          itemId: line.itemId,
          itemCode: line.itemCode,
          itemName: line.itemName,
          type,
          quantityIn: diffQty > 0 ? diffQty : 0,
          quantityOut: diffQty < 0 ? Math.abs(diffQty) : 0,
          weightIn: diffWeight > 0 ? diffWeight : 0,
          weightOut: diffWeight < 0 ? Math.abs(diffWeight) : 0,
          price: 0,
          warehouse: adjustment.warehouse,
          reference: adjustment.refNumber,
          referenceModel: 'StockAdjustment',
          referenceId: adjustment.id,
          seasonId: season.id,
          userId: req.user.id,
        });
      }
    }

    const updated = await prisma.stockAdjustment.update({
      where: { id: adjustment.id },
      data: { approvedAt: new Date() },
      include: {
        lines: {
          include: { item: { select: { id: true, code: true, name: true, unit: true } } },
        },
        season: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    res.json(updated);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── DELETE /api/stock-adjustments/:id ─────────────────────────────────────────
const deleteAdjustment = async (req, res) => {
  try {
    const adj = await prisma.stockAdjustment.findUnique({
      where: { id: req.params.id },
      include: { lines: true },
    });
    if (!adj) return res.status(404).json({ message: 'التسوية مش موجودة' });
    if (adj.approvedAt) return res.status(400).json({ message: 'لا يمكن حذف تسوية معتمدة' });

    await prisma.stockAdjustmentLine.deleteMany({ where: { adjustmentId: adj.id } });
    await prisma.stockAdjustment.delete({ where: { id: adj.id } });
    res.json({ message: 'تم الحذف' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getAdjustments, getAdjustmentById, createAdjustment, approveAdjustment, deleteAdjustment };
