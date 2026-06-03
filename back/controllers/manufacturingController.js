// ─── controllers/manufacturingController.js ───────────────────────────────────
// ✅ REFACTOR: حُذف updateStockTx و createStockMovementTx المكررين
//              واستُبدلا بـ stockHelper.updateStock + stockHelper.createStockMovement
//              لضمان سلوك موحَّد مع باقي الـ controllers (ARCH-001 compliant)
//
// ✅ FIX-MFG-CREATE-001: فحص المخزون في createOrder يعتمد على weight الآن
//                        (بدل quantity) — منسجم مع ARCH-001
//
// ✅ FIX-MFG-CREATE-002: extractItemId يُطبَّق قبل فحص المخزون في createOrder
//                        لتجنب إرسال object بدل UUID string لـ Prisma
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const prisma = require('../config/db');
const { safeNum, n, normalizeInvoiceItems } = require('../utils/decimalHelper');
const { updateStock, createStockMovement }   = require('../utils/stockHelper');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MFG_PREFIX = 'MFG';

const generateOrderNumber = async (seasonId, seasonCode) => {
  const counter = await prisma.seasonCounter.upsert({
    where:  { seasonId_prefix: { seasonId, prefix: MFG_PREFIX } },
    create: { seasonId, prefix: MFG_PREFIX, value: 1, startFrom: 1 },
    update: { value: { increment: 1 } },
  });
  const num = counter.startFrom + counter.value - 1;
  return `MFG-${seasonCode}-${String(num).padStart(5, '0')}`;
};

/** يُعيد حساب totalWeight لكل صف — weight هو المصدر (ARCH-001) */
const recalcWeights = (items) =>
  normalizeInvoiceItems(items, { hasPrice: false });

/** الـ include الموحد لكل queries الأوامر الكاملة */
const orderIncludes = () => ({
  createdBy:      { select: { name: true } },
  approvedBy:     { select: { name: true } },
  worker:         { select: { name: true, code: true, scope: true } },
  season:         { select: { name: true, isActive: true } },
  rawMaterials:   { include: { item: { select: { name: true, code: true } } } },
  outputProducts: { include: { item: { select: { name: true, code: true } } } },
});

/** يستخرج UUID من أي شكل ممكن للـ item (string أو object) */
const extractItemId = (val) => {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'object') return val._id || val.id || null;
  return null;
};

/** ينظف قائمة الأصناف — يضمن أن item و itemId كلاهما UUID string */
const sanitizeItems = (items) =>
  items.map((i) => {
    const resolvedId = extractItemId(i.item) || extractItemId(i.itemId);
    return { ...i, item: resolvedId, itemId: resolvedId };
  });

// ─── GET /api/manufacturing ───────────────────────────────────────────────────

const getOrders = async (req, res) => {
  try {
    const { status, warehouse, workerId, seasonId, page = 1, limit = 30, search } = req.query;

    const where = {};
    if (status)    where.status    = status;
    if (warehouse) where.warehouse = warehouse;
    if (workerId)  where.workerId  = workerId;
    if (search)    where.orderNumber = { contains: search.trim(), mode: 'insensitive' };

    if (seasonId) {
      where.seasonId = seasonId;
    } else {
      const active = await prisma.season.findFirst({ where: { isActive: true }, select: { id: true } });
      if (active) where.seasonId = active.id;
    }

    const skip     = (Number(page) - 1) * Number(limit);
    const limitNum = Number(limit);

    const [total, orders] = await Promise.all([
      prisma.manufacturingOrder.count({ where }),
      prisma.manufacturingOrder.findMany({
        where,
        include: {
          createdBy:      { select: { name: true } },
          approvedBy:     { select: { name: true } },
          worker:         { select: { name: true, code: true, scope: true } },
          season:         { select: { name: true, isActive: true } },
          rawMaterials:   { select: { itemName: true, totalWeight: true, quantity: true } },
          outputProducts: { select: { itemName: true, totalWeight: true, quantity: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
    ]);

    return res.json({ orders: orders.map(n), total, page: Number(page), totalPages: Math.ceil(total / limitNum) });
  } catch (err) {
    console.error('[getOrders]', err);
    return res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/manufacturing/:id ───────────────────────────────────────────────

const getOrderById = async (req, res) => {
  try {
    const order = await prisma.manufacturingOrder.findUnique({
      where:   { id: req.params.id },
      include: orderIncludes(),
    });
    if (!order) return res.status(404).json({ message: 'الأمر مش موجود' });
    return res.json(n(order));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─── POST /api/manufacturing ──────────────────────────────────────────────────

const createOrder = async (req, res) => {
  try {
    const { warehouse, workerId, rawMaterials, outputProducts, notes, date, docNumber, seasonId } = req.body;

    if (!warehouse)              return res.status(400).json({ message: 'حدد العنبر' });
    if (!rawMaterials?.length)   return res.status(400).json({ message: 'أضف خامة واحدة على الأقل' });
    if (!outputProducts?.length) return res.status(400).json({ message: 'أضف منتج واحد على الأقل' });

    const season = seasonId
      ? await prisma.season.findUnique({ where: { id: seasonId }, select: { id: true, name: true } })
      : await prisma.season.findFirst({ where: { isActive: true }, select: { id: true, name: true } });
    if (!season) return res.status(400).json({ message: 'مفيش موسم نشط — فعّل موسم أو حدد موسم' });

    // ✅ FIX-MFG-CREATE-002: sanitize items أولاً قبل أي استخدام
    const sanitizedRaw = sanitizeItems(rawMaterials);
    const sanitizedOut = sanitizeItems(outputProducts);

    // تحقق مبكر من وجود ID لكل صنف
    const nullRaw = sanitizedRaw.find((r) => !r.item);
    const nullOut = sanitizedOut.find((p) => !p.item);
    if (nullRaw) return res.status(400).json({ message: `خامة "${nullRaw.itemName || '؟'}" مش عندها ID — أعد اختيار الصنف` });
    if (nullOut) return res.status(400).json({ message: `منتج "${nullOut.itemName || '؟'}" مش عنده ID — أعد اختيار الصنف` });

    // ✅ FIX-MFG-CREATE-001: فحص المخزون بالوزن (ARCH-001) بدل الكمية
    for (const raw of sanitizedRaw) {
      const stockRec    = await prisma.itemStock.findFirst({
        where: { itemId: raw.item, warehouse, seasonId: season.id },
      });
      const availWeight = safeNum(stockRec?.weight, 0);
      const reqWeight   = safeNum(raw.totalWeight) || safeNum(raw.weight) * safeNum(raw.quantity);
      if (availWeight < reqWeight) {
        return res.status(400).json({
          message: `"${raw.itemName}" مش كافية — متاح: ${availWeight.toFixed(3)} ك، مطلوب: ${reqWeight.toFixed(3)} ك`,
        });
      }
    }

    // sanitize workerId
    const safeWorkerIdCreate = workerId
      ? (typeof workerId === 'object' ? (workerId._id || workerId.id || String(workerId)) : String(workerId))
      : null;

    let workerName = '';
    if (safeWorkerIdCreate) {
      const w = await prisma.worker.findUnique({ where: { id: safeWorkerIdCreate }, select: { name: true } });
      if (!w) return res.status(404).json({ message: 'المعلم مش موجود' });
      workerName = w.name;
    }

    const seasonCode  = season.name.replace(/\s+/g, '').slice(0, 6);
    const orderNumber = await generateOrderNumber(season.id, seasonCode);
    const calcRaw     = recalcWeights(sanitizedRaw);
    const calcOut     = recalcWeights(sanitizedOut);

    const order = await prisma.manufacturingOrder.create({
      data: {
        orderNumber,
        docNumber:      docNumber?.trim() || '',
        date:           date ? new Date(date) : new Date(),
        warehouse,
        workerId:       safeWorkerIdCreate || null,
        workerName:     workerName || null,
        notes,
        status:         'pending',
        seasonId:       season.id,
        createdById:    req.user.id,
        rawMaterials:   { create: calcRaw.map((r) => ({ itemId: r.item, itemCode: r.itemCode, itemName: r.itemName, quantity: safeNum(r.quantity), weight: safeNum(r.weight), totalWeight: r.totalWeight })) },
        outputProducts: { create: calcOut.map((p) => ({ itemId: p.item, itemCode: p.itemCode, itemName: p.itemName, quantity: safeNum(p.quantity), weight: safeNum(p.weight), totalWeight: p.totalWeight })) },
      },
      include: orderIncludes(),
    });

    return res.status(201).json(n(order));
  } catch (err) {
    console.error('[createOrder]', err);
    return res.status(500).json({ message: err.message });
  }
};

// ─── PUT /api/manufacturing/:id ───────────────────────────────────────────────

const updateOrder = async (req, res) => {
  try {
    const order = await prisma.manufacturingOrder.findUnique({
      where:   { id: req.params.id },
      include: { rawMaterials: true, outputProducts: true },
    });
    if (!order) return res.status(404).json({ message: 'الأمر مش موجود' });

    const isAdmin = req.user?.role === 'admin';
    if (order.status === 'approved' && !isAdmin) return res.status(403).json({ message: 'فقط الأدمن يعدل أمر معتمد' });
    if (order.status === 'rejected')              return res.status(400).json({ message: 'مش ممكن تعدل أمر مرفوض' });

    const { warehouse, workerId, rawMaterials, outputProducts, notes, date, docNumber } = req.body;
    if (!rawMaterials?.length)   return res.status(400).json({ message: 'أضف خامة واحدة على الأقل' });
    if (!outputProducts?.length) return res.status(400).json({ message: 'أضف منتج واحد على الأقل' });

    // sanitize workerId
    const safeWorkerId = workerId
      ? (typeof workerId === 'object' ? (workerId._id || workerId.id || String(workerId)) : String(workerId))
      : null;

    let workerName = order.workerName || '';
    if (safeWorkerId && safeWorkerId !== order.workerId) {
      const w = await prisma.worker.findUnique({ where: { id: safeWorkerId }, select: { name: true } });
      if (!w) return res.status(404).json({ message: 'المعلم مش موجود' });
      workerName = w.name;
    }

    const usedWarehouse = warehouse || order.warehouse;
    const calcRaw       = recalcWeights(sanitizeItems(rawMaterials));
    const calcOut       = recalcWeights(sanitizeItems(outputProducts));

    // تحقق مبكر من وجود ID
    const nullRaw = calcRaw.find((r) => !r.item);
    const nullOut = calcOut.find((p) => !p.item);
    if (nullRaw) return res.status(400).json({ message: `خامة "${nullRaw.itemName || '؟'}" مش عندها ID — أعد اختيار الصنف` });
    if (nullOut) return res.status(400).json({ message: `منتج "${nullOut.itemName || '؟'}" مش عنده ID — أعد اختيار الصنف` });

    // ✅ REFACTOR: يستخدم stockHelper.updateStock + createStockMovement
    const updated = await prisma.$transaction(async (tx) => {
      if (order.status === 'approved') {
        // عكس المخزون القديم
        for (const r of order.rawMaterials) {
          await updateStock(r.itemId, order.warehouse, order.seasonId, { weight: +safeNum(r.totalWeight) }, tx);
        }
        for (const p of order.outputProducts) {
          await updateStock(p.itemId, order.warehouse, order.seasonId, { weight: -safeNum(p.totalWeight) }, tx);
        }

        await tx.stockMovement.deleteMany({ where: { referenceId: order.id } });

        // تطبيق المخزون الجديد
        for (const r of calcRaw) {
          await updateStock(r.item, usedWarehouse, order.seasonId, { weight: -r.totalWeight }, tx);
          await createStockMovement({
            itemId: r.item, itemCode: r.itemCode, itemName: r.itemName,
            type: 'manufacturing_out',
            quantity: safeNum(r.quantity), weight: r.totalWeight,
            warehouse: usedWarehouse, reference: order.orderNumber,
            referenceModel: 'ManufacturingOrder', referenceId: order.id,
            seasonId: order.seasonId, createdById: req.user.id, date: order.date,
          }, tx);
        }
        for (const p of calcOut) {
          await updateStock(p.item, usedWarehouse, order.seasonId, { weight: +p.totalWeight }, tx);
          await createStockMovement({
            itemId: p.item, itemCode: p.itemCode, itemName: p.itemName,
            type: 'manufacturing_in',
            quantity: safeNum(p.quantity), weight: p.totalWeight,
            warehouse: usedWarehouse, reference: order.orderNumber,
            referenceModel: 'ManufacturingOrder', referenceId: order.id,
            seasonId: order.seasonId, createdById: req.user.id, date: order.date,
          }, tx);
        }
      }

      await tx.manufacturingRawMaterial.deleteMany({ where: { orderId: order.id } });
      await tx.manufacturingOutput.deleteMany({ where: { orderId: order.id } });

      return tx.manufacturingOrder.update({
        where: { id: order.id },
        data:  {
          docNumber:      docNumber?.trim() ?? order.docNumber,
          date:           date ? new Date(date) : order.date,
          warehouse:      usedWarehouse,
          workerId:       safeWorkerId || order.workerId,
          workerName:     workerName   || order.workerName,
          notes:          notes        ?? order.notes,
          rawMaterials:   { create: calcRaw.map((r) => ({ itemId: r.item, itemCode: r.itemCode, itemName: r.itemName, quantity: safeNum(r.quantity), weight: safeNum(r.weight), totalWeight: r.totalWeight })) },
          outputProducts: { create: calcOut.map((p) => ({ itemId: p.item, itemCode: p.itemCode, itemName: p.itemName, quantity: safeNum(p.quantity), weight: safeNum(p.weight), totalWeight: p.totalWeight })) },
        },
        include: orderIncludes(),
      });
    }, { timeout: 30000 });

    return res.json({ message: 'تم التعديل ✅', order: n(updated) });
  } catch (err) {
    console.error('[updateOrder]', err);
    return res.status(500).json({ message: err.message });
  }
};

// ─── PUT /api/manufacturing/:id/approve ──────────────────────────────────────

const approveOrder = async (req, res) => {
  try {
    const order = await prisma.manufacturingOrder.findUnique({
      where:   { id: req.params.id },
      include: { rawMaterials: true, outputProducts: true },
    });
    if (!order)                      return res.status(404).json({ message: 'الأمر مش موجود' });
    if (order.status === 'approved') return res.status(400).json({ message: 'الأمر اتوافق عليه قبل كده' });

    const wh = order.warehouse;

    // ✅ REFACTOR: يستخدم stockHelper.updateStock + createStockMovement
    const approved = await prisma.$transaction(async (tx) => {
      for (const r of order.rawMaterials) {
        await updateStock(r.itemId, wh, order.seasonId, { weight: -safeNum(r.totalWeight) }, tx);
        await createStockMovement({
          itemId: r.itemId, itemCode: r.itemCode, itemName: r.itemName,
          type: 'manufacturing_out',
          quantity: safeNum(r.quantity), weight: safeNum(r.totalWeight),
          warehouse: wh, reference: order.orderNumber,
          referenceModel: 'ManufacturingOrder', referenceId: order.id,
          seasonId: order.seasonId, createdById: req.user.id, date: order.date,
        }, tx);
      }

      for (const p of order.outputProducts) {
        await updateStock(p.itemId, wh, order.seasonId, { weight: +safeNum(p.totalWeight) }, tx);
        await createStockMovement({
          itemId: p.itemId, itemCode: p.itemCode, itemName: p.itemName,
          type: 'manufacturing_in',
          quantity: safeNum(p.quantity), weight: safeNum(p.totalWeight),
          warehouse: wh, reference: order.orderNumber,
          referenceModel: 'ManufacturingOrder', referenceId: order.id,
          seasonId: order.seasonId, createdById: req.user.id, date: order.date,
        }, tx);
      }

      return tx.manufacturingOrder.update({
        where:   { id: order.id },
        data:    { status: 'approved', approvedById: req.user.id, approvedAt: new Date() },
        include: orderIncludes(),
      });
    }, { timeout: 30000 });

    return res.json({ message: 'تم الموافقة ✅', order: n(approved) });
  } catch (err) {
    console.error('[approveOrder]', err);
    return res.status(500).json({ message: err.message });
  }
};

// ─── PUT /api/manufacturing/:id/reject ───────────────────────────────────────

const rejectOrder = async (req, res) => {
  try {
    const order = await prisma.manufacturingOrder.findUnique({ where: { id: req.params.id } });
    if (!order)                      return res.status(404).json({ message: 'الأمر مش موجود' });
    if (order.status === 'approved') return res.status(400).json({ message: 'مش ممكن ترفض أمر اتوافق' });
    const updated = await prisma.manufacturingOrder.update({ where: { id: order.id }, data: { status: 'rejected' } });
    return res.json({ message: 'تم الرفض', order: n(updated) });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/manufacturing/workers ──────────────────────────────────────────

const getWorkers = async (req, res) => {
  try {
    const { warehouse } = req.query;
    const where = { isActive: true };
    if (warehouse) where.warehouse = warehouse;
    const workers = await prisma.worker.findMany({ where, orderBy: { name: 'asc' } });
    return res.json(workers.map(n));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/manufacturing/worker/:workerId ──────────────────────────────────

const getWorkerReport = async (req, res) => {
  try {
    const { workerId } = req.params;
    const { startDate, endDate, seasonId } = req.query;

    const worker = await prisma.worker.findUnique({ where: { id: workerId }, select: { name: true, code: true, warehouse: true } });
    if (!worker) return res.status(404).json({ message: 'المعلم مش موجود' });

    const where = { workerId };
    if (seasonId) where.seasonId = seasonId;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate)   where.date.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    const orders = await prisma.manufacturingOrder.findMany({
      where,
      include: { season: { select: { name: true } }, rawMaterials: true, outputProducts: true },
      orderBy: { date: 'desc' },
    });

    const approved          = orders.filter((o) => o.status === 'approved');
    const totalRawWeight    = approved.reduce((s, o) => s + o.rawMaterials.reduce((a, r)  => a + safeNum(r.totalWeight),  0), 0);
    const totalOutputWeight = approved.reduce((s, o) => s + o.outputProducts.reduce((a, p) => a + safeNum(p.totalWeight), 0), 0);

    const productMap = {};
    const rawMap     = {};
    approved.forEach((o) => {
      o.outputProducts.forEach((p) => {
        if (!productMap[p.itemCode]) productMap[p.itemCode] = { itemCode: p.itemCode, itemName: p.itemName, totalQty: 0, totalWeight: 0 };
        productMap[p.itemCode].totalQty    += safeNum(p.quantity);
        productMap[p.itemCode].totalWeight += safeNum(p.totalWeight);
      });
      o.rawMaterials.forEach((r) => {
        if (!rawMap[r.itemCode]) rawMap[r.itemCode] = { itemCode: r.itemCode, itemName: r.itemName, totalQty: 0, totalWeight: 0 };
        rawMap[r.itemCode].totalQty    += safeNum(r.quantity);
        rawMap[r.itemCode].totalWeight += safeNum(r.totalWeight);
      });
    });

    return res.json({
      worker,
      orders: orders.map(n),
      summary: {
        totalOrders: approved.length, totalRawWeight, totalOutputWeight,
        wasteWeight: totalRawWeight - totalOutputWeight,
        products:     Object.values(productMap).sort((a, b) => b.totalWeight - a.totalWeight),
        rawMaterials: Object.values(rawMap).sort((a, b)     => b.totalWeight - a.totalWeight),
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/manufacturing/seasons ──────────────────────────────────────────

const getSeasons = async (req, res) => {
  try {
    const seasons = await prisma.season.findMany({
      orderBy: { startDate: 'desc' },
      select:  { id: true, name: true, isActive: true, startDate: true, endDate: true },
    });

    const [counts, approvedCounts] = await Promise.all([
      prisma.manufacturingOrder.groupBy({ by: ['seasonId'], _count: { id: true } }),
      prisma.manufacturingOrder.groupBy({ by: ['seasonId'], where: { status: 'approved' }, _count: { id: true } }),
    ]);

    const countMap    = new Map(counts.map((c) => [c.seasonId, c._count.id]));
    const approvedMap = new Map(approvedCounts.map((c) => [c.seasonId, c._count.id]));

    return res.json(seasons.map((s) => ({
      ...s, _id: s.id,
      orderCount:    countMap.get(s.id)    || 0,
      approvedCount: approvedMap.get(s.id) || 0,
    })));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─── PUT /api/manufacturing/seasons/:seasonId/counter ─────────────────────────

const setSeasonStartNumber = async (req, res) => {
  try {
    const { seasonId } = req.params;
    const { startFrom } = req.body;
    if (!startFrom || Number(startFrom) < 1) return res.status(400).json({ message: 'رقم البداية لازم يكون 1 أو أكبر' });

    const existing = await prisma.manufacturingOrder.count({ where: { seasonId } });
    if (existing > 0) return res.status(400).json({ message: 'مش ممكن تغير رقم البداية بعد إنشاء أوامر في هذا الموسم' });

    await prisma.seasonCounter.upsert({
      where:  { seasonId_prefix: { seasonId, prefix: MFG_PREFIX } },
      create: { seasonId, prefix: MFG_PREFIX, startFrom: Number(startFrom), value: 0 },
      update: { startFrom: Number(startFrom), value: 0 },
    });

    return res.json({ message: `رقم البداية اتحدد: ${startFrom}` });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  getOrders, getOrderById,
  createOrder, updateOrder,
  approveOrder, rejectOrder,
  getWorkers, getWorkerReport,
  getSeasons, setSeasonStartNumber,
};
