// ─── controllers/itemController.js ───────────────────────────────────────────
// الأصناف — بيرجع stock من ItemStock table مباشرة في كل response
// ✅ UPDATED: All Float fields now use Decimal — handled via safeNum()
// ─────────────────────────────────────────────────────────────────────────────

const prisma = require('../config/db');
const { safeNum, round2, round3, n } = require('../utils/decimalHelper');

const PAGE_SIZE = 100;

// ✅ PERF-ITEMS-001: كاش للموسم النشط — يتغير نادراً جداً
// بدل 3 queries للـ season في كل طلب بحث
let _activeSeasonCache = null;
let _activeSeasonExp   = 0;
const SEASON_TTL       = 30 * 1000; // 30 ثانية

const getActiveSeason = async () => {
  if (_activeSeasonCache && Date.now() < _activeSeasonExp) return _activeSeasonCache;
  _activeSeasonCache = await prisma.season.findFirst({ where: { isActive: true }, select: { id: true } });
  _activeSeasonExp   = Date.now() + SEASON_TTL;
  return _activeSeasonCache;
};

/** يُستدعى بعد تغيير الموسم النشط */
const invalidateSeasonCache = () => { _activeSeasonCache = null; _activeSeasonExp = 0; };

// ── enrichWithStock — يضيف stock map لكل صنف ─────────────────────────────────
const enrichWithStock = async (items, seasonId = null) => {
  if (!items.length) return items;
  const ids = items.map(i => i.id);
  // ✅ FIX: فلتر بالموسم النشط عشان نجيب رصيد الموسم الصح
  const stockWhere = { itemId: { in: ids } };
  if (seasonId) stockWhere.seasonId = seasonId;
  else stockWhere.seasonId = null; // بدون موسم افتراضياً
  const stocks = await prisma.itemStock.findMany({
    where: stockWhere,
    select: { itemId: true, warehouse: true, quantity: true, weight: true, seasonId: true },
  });
  const stockMap = {};
  for (const s of stocks) {
    if (!stockMap[s.itemId]) stockMap[s.itemId] = {};
    stockMap[s.itemId][s.warehouse] = { quantity: s.quantity, weight: s.weight };
  }
  return items.map(item => ({
    ...item,
    _id: item.id,
    stock: {
      ramses: stockMap[item.id]?.ramses ?? { quantity: 0, weight: 0 },
      october: stockMap[item.id]?.october ?? { quantity: 0, weight: 0 },
    },
  }));
};

// ── GET /api/items?page=1&search=...&isRawMaterial=... ────────────────────────
const getItems = async (req, res) => {
  try {
    const { search, isRawMaterial, page = 1 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10));
    const skip = (pageNum - 1) * PAGE_SIZE;
    const s = search?.trim() || '';
    const isNum = /^\d+$/.test(s);

    const conditions = ['"isActive" = true'];
    const params = [];
    let pi = 1;

    if (s) {
      if (isNum) {
        conditions.push(`("code" LIKE $${pi} OR "name" ILIKE $${pi + 1})`);
        params.push(s + '%', '%' + s + '%');
      } else {
        conditions.push(`("code" ILIKE $${pi} OR "name" ILIKE $${pi + 1})`);
        params.push('%' + s + '%', '%' + s + '%');
      }
      pi += 2;
    }
    if (isRawMaterial === 'true' || isRawMaterial === 'false') {
      conditions.push(`"isRawMaterial" = $${pi}`);
      params.push(isRawMaterial === 'true');
      pi++;
    }

    const whereClause = conditions.join(' AND ');
    const orderClause = `
      CASE WHEN "code" ~ '^[0-9]+$' THEN 0 ELSE 1 END ASC,
      CASE WHEN "code" ~ '^[0-9]+$' THEN CAST("code" AS BIGINT) END ASC NULLS LAST,
      "code" ASC`;

    const [countResult, rawItems] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT COUNT(*) FROM "items" WHERE ${whereClause}`, ...params),
      prisma.$queryRawUnsafe(
        `SELECT * FROM "items" WHERE ${whereClause} ORDER BY ${orderClause} LIMIT $${pi} OFFSET $${pi + 1}`,
        ...params, PAGE_SIZE, skip
      ),
    ]);

    // ✅ نجيب الموسم النشط لفلترة المخزون
    const activeSeason = await getActiveSeason();
    const items = await enrichWithStock(rawItems, activeSeason?.id ?? null);
    const total = parseInt(countResult[0].count, 10);
    res.json({ items, total, page: pageNum, pageSize: PAGE_SIZE, hasMore: skip + items.length < total });
  } catch (err) {
    console.error('[getItems]', err);
    res.status(500).json({ message: err.message });
  }
};

// ── GET /api/items/:id ────────────────────────────────────────────────────────
const getItemById = async (req, res) => {
  try {
    const item = await prisma.item.findUnique({ where: { id: req.params.id } });
    if (!item || !item.isActive) return res.status(404).json({ message: 'الصنف مش موجود' });
    const activeSeason = await getActiveSeason();
    const [enriched] = await enrichWithStock([item], activeSeason?.id ?? null);
    res.json(enriched);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET /api/items/code/:code ─────────────────────────────────────────────────
const getItemByCode = async (req, res) => {
  try {
    const item = await prisma.item.findFirst({ where: { code: req.params.code, isActive: true } });
    if (!item) return res.status(404).json({ message: 'الصنف مش موجود' });
    const activeSeason = await getActiveSeason();
    const [enriched] = await enrichWithStock([item], activeSeason?.id ?? null);
    res.json(enriched);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── POST /api/items ───────────────────────────────────────────────────────────
const createItem = async (req, res) => {
  try {
    const exists = await prisma.item.findUnique({ where: { code: req.body.code } });
    if (exists) return res.status(400).json({ message: 'كود الصنف موجود بالفعل' });

    // ✅ Decimal-safe: use safeNum() for all numeric inputs
    const item = await prisma.item.create({
      data: {
        code: req.body.code,
        name: req.body.name,
        category: req.body.category,
        unit: req.body.unit || 'كرتون',
        defaultWeight: safeNum(req.body.defaultWeight),
        lastPurchasePrice: safeNum(req.body.lastPurchasePrice),
        lastSalePrice: safeNum(req.body.lastSalePrice),
        minStockQty: safeNum(req.body.minStockQty),  // ✅ Now Decimal
        isRawMaterial: req.body.isRawMaterial || false,
        notes: req.body.notes,
      },
    });
    const activeSeason = await getActiveSeason();
    const [enriched] = await enrichWithStock([item], activeSeason?.id ?? null);
    res.status(201).json(enriched);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── PUT /api/items/:id ────────────────────────────────────────────────────────
const updateItem = async (req, res) => {
  try {
    const allowed = ['code','name','category','unit','defaultWeight',
      'lastPurchasePrice','lastSalePrice','minStockQty','isRawMaterial','isActive','notes'];
    const data = {};
    allowed.forEach(k => { 
      if (req.body[k] !== undefined) {
        // ✅ Decimal-safe: numeric fields use safeNum()
        if (['defaultWeight','lastPurchasePrice','lastSalePrice','minStockQty'].includes(k)) {
          data[k] = safeNum(req.body[k]);
        } else {
          data[k] = req.body[k];
        }
      }
    });
    const item = await prisma.item.update({ where: { id: req.params.id }, data });
    const activeSeason = await getActiveSeason();
    const [enriched] = await enrichWithStock([item], activeSeason?.id ?? null);
    res.json(enriched);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'الصنف مش موجود' });
    res.status(500).json({ message: err.message });
  }
};

// ── DELETE /api/items/:id (soft delete) ───────────────────────────────────────
const deleteItem = async (req, res) => {
  try {
    await prisma.item.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'تم الحذف' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET /api/items/:id/stock ──────────────────────────────────────────────────
const getItemStock = async (req, res) => {
  try {
    const item = await prisma.item.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ message: 'الصنف مش موجود' });
    // ✅ FIX: دعم seasonId في query param (أو الموسم النشط كـ fallback)
    let { seasonId } = req.query;
    if (!seasonId) {
      const activeSeason = await getActiveSeason();
      seasonId = activeSeason?.id ?? null;
    }
    const stockWhere = { itemId: item.id };
    if (seasonId) stockWhere.seasonId = seasonId;
    else stockWhere.seasonId = null;
    const stocks = await prisma.itemStock.findMany({ where: stockWhere });
    const stockMap = {};
    for (const s of stocks) stockMap[s.warehouse] = {
      quantity: safeNum(s.quantity),
      weight:   safeNum(s.weight),
    };
    res.json({
      _id: item.id, code: item.code, name: item.name, unit: item.unit,
      stock: stockMap, seasonId,
      defaultWeight: item.defaultWeight,
      lastPurchasePrice: item.lastPurchasePrice,
      lastSalePrice: item.lastSalePrice,
      minStockQty: item.minStockQty,  // ✅ Decimal returned as-is (normalized by n())
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getItems, getItemById, getItemByCode, createItem, updateItem, deleteItem, getItemStock,
  invalidateSeasonCache,
};
