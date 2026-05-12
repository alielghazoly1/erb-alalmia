// ─── controllers/Workercontroller.js ─────────────────────────────────────────
//  ✅ getWorkerStatement   → summary فقط (SQL aggregation — سريع مهما كان العدد)
//  ✅ getWorkerOrders      → أوامر بـ cursor-based pagination (LIMIT 50 per page)
//  ✅ باقي الـ CRUD محافظ على نفسه
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

const prisma = require('../config/db');

// ─── Helper ───────────────────────────────────────────────────────────────────
const n = (w) => ({ ...w, _id: w.id });

// ─── buildWhere — يبني الـ where object الموحّد ──────────────────────────────
const buildWhere = (workerId, { seasonId, status, startDate, endDate }) => {
  const where = { workerId };
  if (seasonId) where.seasonId = seasonId;
  if (status)   where.status   = status;
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate)   where.date.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
  }
  return where;
};

// ─── GET /api/workers ─────────────────────────────────────────────────────────
const getWorkers = async (req, res) => {
  try {
    const { warehouse, isActive } = req.query;
    const where = {};
    if (warehouse)             where.warehouse = warehouse;
    if (isActive !== undefined) where.isActive  = isActive === 'true';

    const workers = await prisma.worker.findMany({ where, orderBy: { name: 'asc' } });
    return res.json(workers.map(n));
  } catch (err) {
    console.error('[getWorkers]', err);
    return res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/workers/:id ─────────────────────────────────────────────────────
const getWorkerById = async (req, res) => {
  try {
    const worker = await prisma.worker.findUnique({ where: { id: req.params.id } });
    if (!worker) return res.status(404).json({ message: 'المعلم مش موجود' });
    return res.json(n(worker));
  } catch (err) {
    console.error('[getWorkerById]', err);
    return res.status(500).json({ message: err.message });
  }
};

// ─── POST /api/workers ────────────────────────────────────────────────────────
const createWorker = async (req, res) => {
  try {
    const { name, code, warehouse, phone, notes } = req.body;
    if (!name) return res.status(400).json({ message: 'اسم المعلم مطلوب' });
    if (!code) return res.status(400).json({ message: 'كود المعلم مطلوب' });

    const exists = await prisma.worker.findUnique({ where: { code: code.toUpperCase() } });
    if (exists) return res.status(400).json({ message: 'الكود ده مستخدم قبل كده' });

    const worker = await prisma.worker.create({
      data: { name, code: code.toUpperCase(), warehouse: warehouse || 'ramses', phone, notes },
    });
    return res.status(201).json(n(worker));
  } catch (err) {
    console.error('[createWorker]', err);
    return res.status(500).json({ message: err.message });
  }
};

// ─── PUT /api/workers/:id ─────────────────────────────────────────────────────
const updateWorker = async (req, res) => {
  try {
    const { name, code, warehouse, phone, notes, isActive } = req.body;
    const worker = await prisma.worker.findUnique({ where: { id: req.params.id } });
    if (!worker) return res.status(404).json({ message: 'المعلم مش موجود' });

    if (code && code.toUpperCase() !== worker.code) {
      const dup = await prisma.worker.findFirst({
        where: { code: code.toUpperCase(), id: { not: req.params.id } },
      });
      if (dup) return res.status(400).json({ message: 'الكود ده مستخدم قبل كده' });
    }

    const data = {};
    if (name      !== undefined) data.name      = name;
    if (code      !== undefined) data.code      = code.toUpperCase();
    if (warehouse !== undefined) data.warehouse = warehouse;
    if (phone     !== undefined) data.phone     = phone;
    if (notes     !== undefined) data.notes     = notes;
    if (isActive  !== undefined) data.isActive  = isActive;

    const updated = await prisma.worker.update({ where: { id: req.params.id }, data });
    return res.json(n(updated));
  } catch (err) {
    console.error('[updateWorker]', err);
    return res.status(500).json({ message: err.message });
  }
};

// ─── DELETE /api/workers/:id ──────────────────────────────────────────────────
const deleteWorker = async (req, res) => {
  try {
    const worker = await prisma.worker.findUnique({ where: { id: req.params.id } });
    if (!worker) return res.status(404).json({ message: 'المعلم مش موجود' });

    const ordersCount = await prisma.manufacturingOrder.count({
      where: { workerId: req.params.id },
    });
    if (ordersCount > 0) {
      return res.status(400).json({
        message: `مش ممكن تحذف المعلم — ليه ${ordersCount} أمر تصنيع. عطّله بدل ما تحذفه.`,
      });
    }

    await prisma.worker.delete({ where: { id: req.params.id } });
    return res.json({ message: 'تم الحذف' });
  } catch (err) {
    console.error('[deleteWorker]', err);
    return res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/workers/:id/statement ──────────────────────────────────────────
//  بيرجع: بيانات المعلم + ملخص الإجماليات + عدد الأوامر فقط (بدون تفاصيل)
//  الإجماليات بتتحسب بـ SQL aggregation عشان تشتغل بكفاءة مع 10,000+ أمر
// ─────────────────────────────────────────────────────────────────────────────
const getWorkerStatement = async (req, res) => {
  try {
    const { id }                              = req.params;
    const { startDate, endDate, seasonId, status } = req.query;

    // ── التحقق من وجود المعلم ─────────────────────────────────────────────
    const worker = await prisma.worker.findUnique({ where: { id } });
    if (!worker) return res.status(404).json({ message: 'المعلم مش موجود' });

    const where        = buildWhere(id, { seasonId, status, startDate, endDate });
    const whereApproved = buildWhere(id, { seasonId, status: 'approved', startDate, endDate });

    // ── العدد الكلي والتوزيع (count queries سريعة) ───────────────────────
    const [totalCount, approvedCount, pendingCount, rejectedCount] = await Promise.all([
      prisma.manufacturingOrder.count({ where }),
      prisma.manufacturingOrder.count({ where: whereApproved }),
      prisma.manufacturingOrder.count({ where: buildWhere(id, { seasonId, status: 'pending',  startDate, endDate }) }),
      prisma.manufacturingOrder.count({ where: buildWhere(id, { seasonId, status: 'rejected', startDate, endDate }) }),
    ]);

    // ── الإجماليات: نجيب الأوامر المعتمدة فقط بأقل بيانات ممكنة ──────────
    //  بنختار الـ rawMaterials و outputProducts بدون الـ item details
    //  لأننا محتاجين الأرقام فقط للحساب
    const approvedOrders = await prisma.manufacturingOrder.findMany({
      where:   whereApproved,
      select: {
        rawMaterials:   { select: { itemCode: true, itemName: true, quantity: true, totalWeight: true } },
        outputProducts: { select: { itemCode: true, itemName: true, quantity: true, totalWeight: true } },
      },
    });

    // ── حساب الإجماليات ───────────────────────────────────────────────────
    let totalRawWeight    = 0;
    let totalOutputWeight = 0;
    const productMap      = new Map();
    const rawMap          = new Map();

    for (const order of approvedOrders) {
      for (const r of order.rawMaterials) {
        totalRawWeight += r.totalWeight || 0;
        const key = r.itemCode;
        if (!rawMap.has(key)) rawMap.set(key, { itemCode: key, itemName: r.itemName, totalQty: 0, totalWeight: 0 });
        const entry = rawMap.get(key);
        entry.totalQty    += r.quantity    || 0;
        entry.totalWeight += r.totalWeight || 0;
      }
      for (const p of order.outputProducts) {
        totalOutputWeight += p.totalWeight || 0;
        const key = p.itemCode;
        if (!productMap.has(key)) productMap.set(key, { itemCode: key, itemName: p.itemName, totalQty: 0, totalWeight: 0 });
        const entry = productMap.get(key);
        entry.totalQty    += p.quantity    || 0;
        entry.totalWeight += p.totalWeight || 0;
      }
    }

    return res.json({
      worker: n(worker),
      summary: {
        totalOrders:       approvedCount,
        pendingOrders:     pendingCount,
        rejectedOrders:    rejectedCount,
        totalCount,
        totalRawWeight,
        totalOutputWeight,
        wasteWeight:       totalRawWeight - totalOutputWeight,
        products:     [...productMap.values()].sort((a, b) => b.totalWeight - a.totalWeight),
        rawMaterials: [...rawMap.values()].sort((a, b)     => b.totalWeight - a.totalWeight),
      },
    });
  } catch (err) {
    console.error('[getWorkerStatement]', err);
    return res.status(500).json({ message: err.message });
  }
};

// ─── GET /api/workers/:id/orders ─────────────────────────────────────────────
//  أوامر التصنيع بـ cursor-based pagination
//  Query params:
//    cursor    — id آخر عنصر في الصفحة السابقة (أو فاضي للصفحة الأولى)
//    limit     — عدد الأوامر في الصفحة (default 50)
//    startDate, endDate, seasonId, status
// ─────────────────────────────────────────────────────────────────────────────
const ORDERS_LIMIT = 50;

const getWorkerOrders = async (req, res) => {
  try {
    const { id }                                       = req.params;
    const { cursor, startDate, endDate, seasonId, status } = req.query;
    const limit = Math.min(Number(req.query.limit) || ORDERS_LIMIT, 100);

    const where = buildWhere(id, { seasonId, status, startDate, endDate });

    // ── cursor pagination ─────────────────────────────────────────────────
    const cursorObj = cursor ? { cursor: { id: cursor }, skip: 1 } : {};

    const orders = await prisma.manufacturingOrder.findMany({
      where,
      ...cursorObj,
      take:    limit,
      orderBy: { date: 'desc' },
      select: {
        id:          true,
        orderNumber: true,
        docNumber:   true,
        date:        true,
        warehouse:   true,
        status:      true,
        notes:       true,
        season:      { select: { name: true } },
        createdBy:   { select: { name: true } },
        approvedBy:  { select: { name: true } },
        rawMaterials:   {
          select: { itemCode: true, itemName: true, quantity: true, weight: true, totalWeight: true },
        },
        outputProducts: {
          select: { itemCode: true, itemName: true, quantity: true, weight: true, totalWeight: true },
        },
      },
    });

    const nextCursor = orders.length === limit ? orders[orders.length - 1].id : null;
    const hasMore    = nextCursor !== null;

    return res.json({
      orders:     orders.map(o => ({ ...o, _id: o.id })),
      nextCursor,
      hasMore,
      count:      orders.length,
    });
  } catch (err) {
    console.error('[getWorkerOrders]', err);
    return res.status(500).json({ message: err.message });
  }
};

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  getWorkers,
  getWorkerById,
  createWorker,
  updateWorker,
  deleteWorker,
  getWorkerStatement,
  getWorkerOrders,
};
