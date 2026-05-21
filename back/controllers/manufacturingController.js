// ─── controllers/manufacturingController.js ───────────────────────────────────
// ✅ FIXED: approveOrder — updateStock و createStockMovement يستخدمان tx بدل prisma
//           ليضمنوا أنهم ضمن نفس الـ transaction وليس خارجها
// ✅ FIXED: updateOrder — نفس الإصلاح
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const prisma = require('../config/db');
const { safeNum, round2, round3, n } = require('../utils/decimalHelper');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** يولّد رقم الأمر (MFG-SEASON-00001) */
const generateOrderNumber = async (seasonId, seasonCode) => {
  const counter = await prisma.seasonCounter.upsert({
    where:  { seasonId },
    create: { seasonId, value: 1, startFrom: 1 },
    update: { value: { increment: 1 } },
  });
  const num = counter.startFrom + counter.value - 1;
  return `MFG-${seasonCode}-${String(num).padStart(5, '0')}`;
};

/** يُعيد حساب totalWeight لكل صف */
const recalcWeights = (items) =>
  items.map(r => ({
    ...r,
    totalWeight: r.totalWeight != null
      ? safeNum(r.totalWeight)
      : safeNum(r.quantity) * safeNum(r.weight),
  }));

/** الـ include الموحد لكل queries الأوامر الكاملة */
const orderIncludes = () => ({
  createdBy:      { select: { name: true } },
  approvedBy:     { select: { name: true } },
  worker:         { select: { name: true, code: true, scope: true } },
  season:         { select: { name: true, isActive: true } },
  rawMaterials:   { include: { item: { select: { name: true, code: true } } } },
  outputProducts: { include: { item: { select: { name: true, code: true } } } },
});

// ✅ FIXED: updateStock داخل transaction يستخدم tx بدل prisma
// ✅ FIX-MFG-001: updateStockTx الآن يستخدم GREATEST لمنع القيم السالبة
//               ويضيف خطوة NORMALIZE لتصفير القيم الوهمية (مثل -0.001)
//               متوافق مع stockHelper.updateStock
const updateStockTx = async (tx, itemId, warehouse, seasonId, delta) => {
  const dQty = round3(safeNum(delta.quantity));
  const dWt  = round3(safeNum(delta.weight));

  if (seasonId) {
    const updated = await tx.$executeRaw`
      UPDATE item_stocks
      SET quantity = ROUND(
            GREATEST(ROUND(CAST(quantity + ${dQty} AS numeric), 3), 0),
            3
          ),
          weight   = ROUND(
            GREATEST(ROUND(CAST(weight + ${dWt} AS numeric), 3), -0.001),
            3
          ),
          "updatedAt" = NOW()
      WHERE "itemId" = ${itemId}::uuid AND warehouse = ${warehouse}::"Warehouse" AND "seasonId" = ${seasonId}::uuid
    `;
    if (updated === 0) {
      await tx.$executeRaw`
        INSERT INTO item_stocks (id, "itemId", warehouse, "seasonId", quantity, weight, "updatedAt")
        VALUES (
          gen_random_uuid(),
          ${itemId}::uuid,
          ${warehouse}::"Warehouse",
          ${seasonId}::uuid,
          ${Math.max(0, dQty)},
          ${Math.max(0, dWt)},
          NOW()
        )
        ON CONFLICT ("itemId", warehouse, "seasonId") DO UPDATE
          SET quantity = ROUND(GREATEST(item_stocks.quantity + ${dQty}, 0), 3),
              weight   = ROUND(GREATEST(item_stocks.weight   + ${dWt}, -0.001), 3),
              "updatedAt" = NOW()
      `;
    }
  } else {
    const updated = await tx.$executeRaw`
      UPDATE item_stocks
      SET quantity = ROUND(GREATEST(ROUND(CAST(quantity + ${dQty} AS numeric), 3), 0), 3),
          weight   = ROUND(GREATEST(ROUND(CAST(weight + ${dWt} AS numeric), 3), -0.001), 3),
          "updatedAt" = NOW()
      WHERE "itemId" = ${itemId}::uuid AND warehouse = ${warehouse}::"Warehouse" AND "seasonId" IS NULL
    `;
    if (updated === 0) {
      await tx.$executeRaw`
        INSERT INTO item_stocks (id, "itemId", warehouse, "seasonId", quantity, weight, "updatedAt")
        VALUES (
          gen_random_uuid(),
          ${itemId}::uuid,
          ${warehouse}::"Warehouse",
          NULL,
          ${Math.max(0, dQty)},
          ${Math.max(0, dWt)},
          NOW()
        )
        ON CONFLICT ("itemId", warehouse, "seasonId") DO UPDATE
          SET quantity = ROUND(GREATEST(item_stocks.quantity + ${dQty}, 0), 3),
              weight   = ROUND(GREATEST(item_stocks.weight   + ${dWt}, -0.001), 3),
              "updatedAt" = NOW()
      `;
    }
  }

  // ✅ NORMALIZE: تصفير القيم الوهمية بعد التحديث (مثل -0.001 بعد عملية صحيحة)
  if (seasonId) {
    await tx.$executeRaw`
      UPDATE item_stocks
      SET
        quantity = CASE WHEN ABS(quantity) < 0.0005 THEN 0 ELSE quantity END,
        weight   = CASE WHEN ABS(weight)   < 0.0005 THEN 0 ELSE weight   END,
        "updatedAt" = NOW()
      WHERE "itemId"   = ${itemId}::uuid
        AND warehouse  = ${warehouse}::"Warehouse"
        AND "seasonId" = ${seasonId}::uuid
        AND (ABS(quantity) < 0.0005 OR ABS(weight) < 0.0005)
    `;
  } else {
    await tx.$executeRaw`
      UPDATE item_stocks
      SET
        quantity = CASE WHEN ABS(quantity) < 0.0005 THEN 0 ELSE quantity END,
        weight   = CASE WHEN ABS(weight)   < 0.0005 THEN 0 ELSE weight   END,
        "updatedAt" = NOW()
      WHERE "itemId"  = ${itemId}::uuid
        AND warehouse = ${warehouse}::"Warehouse"
        AND "seasonId" IS NULL
        AND (ABS(quantity) < 0.0005 OR ABS(weight) < 0.0005)
    `;
  }
};

// ✅ FIXED: createStockMovement داخل transaction يستخدم tx
const createStockMovementTx = async (tx, {
  itemId, itemCode, itemName, type,
  quantity, weight,
  warehouse, reference, referenceModel, referenceId,
  seasonId, createdById, date,
}) => {
  // قراءة الرصيد الحالي بعد updateStockTx
  const stock = seasonId
    ? await tx.itemStock.findFirst({ where: { itemId, warehouse, seasonId } })
    : await tx.itemStock.findFirst({ where: { itemId, warehouse, seasonId: null } });

  const OUT_TYPES = new Set(['manufacturing_out']);
  const isOut = OUT_TYPES.has(type);
  const qty   = safeNum(quantity);
  const wt    = safeNum(weight);

  return tx.stockMovement.create({
    data: {
      itemId, itemCode, itemName, type,
      quantityIn:    isOut ? 0   : qty,
      quantityOut:   isOut ? qty : 0,
      weightIn:      isOut ? 0   : wt,
      weightOut:     isOut ? wt  : 0,
      price:         0,
      warehouse,
      balanceQty:    safeNum(stock?.quantity, 0),
      balanceWeight: safeNum(stock?.weight,   0),
      reference,
      referenceModel,
      referenceId,
      seasonId,
      createdById,
      date: date ? new Date(date) : new Date(),
    },
  });
};

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
          createdBy:     { select: { name: true } },
          approvedBy:    { select: { name: true } },
          worker:        { select: { name: true, code: true, scope: true } },
          season:        { select: { name: true, isActive: true } },
          rawMaterials:  { select: { itemName: true, totalWeight: true, quantity: true } },
          outputProducts:{ select: { itemName: true, totalWeight: true, quantity: true } },
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

    // فحص المخزون للخامات
    for (const raw of rawMaterials) {
      const stockRec = await prisma.itemStock.findFirst({
        where: { itemId: raw.item, warehouse, seasonId: season.id },
      });
      const avail = safeNum(stockRec?.quantity, 0);
      if (avail < safeNum(raw.quantity)) {
        return res.status(400).json({
          message: `"${raw.itemName}" مش كافية — متاح: ${avail} كرتون، مطلوب: ${raw.quantity}`,
        });
      }
    }

    let workerName = '';
    if (workerId) {
      const w = await prisma.worker.findUnique({ where: { id: workerId }, select: { name: true } });
      if (!w) return res.status(404).json({ message: 'المعلم مش موجود' });
      workerName = w.name;
    }

    const seasonCode  = season.name.replace(/\s+/g, '').slice(0, 6);
    const orderNumber = await generateOrderNumber(season.id, seasonCode);
    const calcRaw     = recalcWeights(rawMaterials);
    const calcOut     = recalcWeights(outputProducts);

    const order = await prisma.manufacturingOrder.create({
      data: {
        orderNumber,
        docNumber:   docNumber?.trim() || '',
        date:        date ? new Date(date) : new Date(),
        warehouse, workerId: workerId || null, workerName: workerName || null,
        notes, status: 'pending', seasonId: season.id, createdById: req.user.id,
        rawMaterials:   { create: calcRaw.map(r => ({ itemId: r.item, itemCode: r.itemCode, itemName: r.itemName, quantity: safeNum(r.quantity), weight: safeNum(r.weight), totalWeight: r.totalWeight })) },
        outputProducts: { create: calcOut.map(p => ({ itemId: p.item, itemCode: p.itemCode, itemName: p.itemName, quantity: safeNum(p.quantity), weight: safeNum(p.weight), totalWeight: p.totalWeight })) },
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

    let workerName = order.workerName || '';
    if (workerId && workerId !== order.workerId) {
      const w = await prisma.worker.findUnique({ where: { id: workerId }, select: { name: true } });
      if (!w) return res.status(404).json({ message: 'المعلم مش موجود' });
      workerName = w.name;
    }

    const usedWarehouse = warehouse || order.warehouse;
    const calcRaw = recalcWeights(rawMaterials);
    const calcOut = recalcWeights(outputProducts);

    // ✅ FIXED: كل العمليات داخل نفس الـ tx
    const updated = await prisma.$transaction(async (tx) => {
      if (order.status === 'approved') {
        // عكس المخزون القديم
        for (const r of order.rawMaterials)
          await updateStockTx(tx, r.itemId, order.warehouse, order.seasonId, { quantity: +r.quantity, weight: +r.totalWeight });
        for (const p of order.outputProducts)
          await updateStockTx(tx, p.itemId, order.warehouse, order.seasonId, { quantity: -p.quantity, weight: -p.totalWeight });

        await tx.stockMovement.deleteMany({ where: { referenceId: order.id } });

        // تطبيق المخزون الجديد
        for (const r of calcRaw)
          await updateStockTx(tx, r.item, usedWarehouse, order.seasonId, { quantity: -safeNum(r.quantity), weight: -r.totalWeight });
        for (const p of calcOut)
          await updateStockTx(tx, p.item, usedWarehouse, order.seasonId, { quantity: +safeNum(p.quantity), weight: +p.totalWeight });

        for (const r of calcRaw)
          await createStockMovementTx(tx, { itemId: r.item, itemCode: r.itemCode, itemName: r.itemName, type: 'manufacturing_out', quantity: safeNum(r.quantity), weight: r.totalWeight, warehouse: usedWarehouse, reference: order.orderNumber, referenceModel: 'ManufacturingOrder', referenceId: order.id, seasonId: order.seasonId, createdById: req.user.id, date: order.date });
        for (const p of calcOut)
          await createStockMovementTx(tx, { itemId: p.item, itemCode: p.itemCode, itemName: p.itemName, type: 'manufacturing_in', quantity: safeNum(p.quantity), weight: p.totalWeight, warehouse: usedWarehouse, reference: order.orderNumber, referenceModel: 'ManufacturingOrder', referenceId: order.id, seasonId: order.seasonId, createdById: req.user.id, date: order.date });
      }

      await tx.manufacturingRawMaterial.deleteMany({ where: { orderId: order.id } });
      await tx.manufacturingOutput.deleteMany({ where: { orderId: order.id } });

      return tx.manufacturingOrder.update({
        where: { id: order.id },
        data:  {
          docNumber:   docNumber?.trim() ?? order.docNumber,
          date:        date ? new Date(date) : order.date,
          warehouse:   usedWarehouse,
          workerId:    workerId   || order.workerId,
          workerName:  workerName || order.workerName,
          notes:       notes      ?? order.notes,
          rawMaterials:   { create: calcRaw.map(r => ({ itemId: r.item, itemCode: r.itemCode, itemName: r.itemName, quantity: safeNum(r.quantity), weight: safeNum(r.weight), totalWeight: r.totalWeight })) },
          outputProducts: { create: calcOut.map(p => ({ itemId: p.item, itemCode: p.itemCode, itemName: p.itemName, quantity: safeNum(p.quantity), weight: safeNum(p.weight), totalWeight: p.totalWeight })) },
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

    // ✅ FIXED: كل العمليات تستخدم tx (نفس الـ transaction) — prisma.$transaction الحقيقي
    const approved = await prisma.$transaction(async (tx) => {
      // نقص المخزون للخامات
      for (const r of order.rawMaterials) {
        await updateStockTx(tx, r.itemId, wh, order.seasonId, {
          quantity: -safeNum(r.quantity),
          weight:   -safeNum(r.totalWeight),
        });
        await createStockMovementTx(tx, {
          itemId: r.itemId, itemCode: r.itemCode, itemName: r.itemName,
          type: 'manufacturing_out',
          quantity: r.quantity, weight: r.totalWeight,
          warehouse: wh, reference: order.orderNumber,
          referenceModel: 'ManufacturingOrder', referenceId: order.id,
          seasonId: order.seasonId, createdById: req.user.id, date: order.date,
        });
      }

      // زيادة المخزون للمنتجات
      for (const p of order.outputProducts) {
        await updateStockTx(tx, p.itemId, wh, order.seasonId, {
          quantity: +safeNum(p.quantity),
          weight:   +safeNum(p.totalWeight),
        });
        await createStockMovementTx(tx, {
          itemId: p.itemId, itemCode: p.itemCode, itemName: p.itemName,
          type: 'manufacturing_in',
          quantity: p.quantity, weight: p.totalWeight,
          warehouse: wh, reference: order.orderNumber,
          referenceModel: 'ManufacturingOrder', referenceId: order.id,
          seasonId: order.seasonId, createdById: req.user.id, date: order.date,
        });
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

    const approved          = orders.filter(o => o.status === 'approved');
    const totalRawWeight    = approved.reduce((s, o) => s + o.rawMaterials.reduce((a, r)  => a + (r.totalWeight  || 0), 0), 0);
    const totalOutputWeight = approved.reduce((s, o) => s + o.outputProducts.reduce((a, p) => a + (p.totalWeight || 0), 0), 0);

    const productMap = {};
    const rawMap     = {};
    approved.forEach(o => {
      o.outputProducts.forEach(p => {
        if (!productMap[p.itemCode]) productMap[p.itemCode] = { itemCode: p.itemCode, itemName: p.itemName, totalQty: 0, totalWeight: 0 };
        productMap[p.itemCode].totalQty    += p.quantity    || 0;
        productMap[p.itemCode].totalWeight += p.totalWeight || 0;
      });
      o.rawMaterials.forEach(r => {
        if (!rawMap[r.itemCode]) rawMap[r.itemCode] = { itemCode: r.itemCode, itemName: r.itemName, totalQty: 0, totalWeight: 0 };
        rawMap[r.itemCode].totalQty    += r.quantity    || 0;
        rawMap[r.itemCode].totalWeight += r.totalWeight || 0;
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

    const countMap    = new Map(counts.map(c => [c.seasonId, c._count.id]));
    const approvedMap = new Map(approvedCounts.map(c => [c.seasonId, c._count.id]));

    return res.json(seasons.map(s => ({
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
      where:  { seasonId },
      create: { seasonId, startFrom: Number(startFrom), value: 0 },
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
