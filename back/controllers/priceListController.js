// ─── controllers/priceListController.js ──────────────────────────────────────
// نسخة محسّنة — Prisma + in-memory cache
// ─────────────────────────────────────────────────────────────────────────────
const prisma = require('../config/db');
const { safeNum, round2, round3, n } = require('../utils/decimalHelper');
const cache  = require('../utils/priceListCache');

const LISTS_CACHE_KEY = 'pl:lists';
const listKey = (name) => `pl:list:${name}`;
const itemKey = (id)   => `pl:item:${id}`;

// ── GET /price-list/lists ─────────────────────────────────────────────────────
const getAllPriceLists = async (req, res) => {
  try {
    const result = await cache.getOrFetch(LISTS_CACHE_KEY, async () => {
      // groupBy حسب priceListName
      const rows = await prisma.priceList.findMany({
        where:   { isActive: true },
        select:  { id: true, priceListName: true, priceListDescription: true, displayOrder: true },
        orderBy: [{ displayOrder: 'asc' }, { priceListName: 'asc' }],
      });

      // نجمّع يدوياً لأن Prisma groupBy مش بيدعم first() على fields زي Mongoose
      const map = new Map();
      for (const r of rows) {
        if (!map.has(r.priceListName)) {
          map.set(r.priceListName, { name: r.priceListName, description: r.priceListDescription, displayOrder: r.displayOrder, count: 0 });
        }
        map.get(r.priceListName).count++;
      }
      return Array.from(map.values()).sort((a, b) => a.displayOrder - b.displayOrder);
    });

    res.setHeader('X-Cache', 'HIT').json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET /price-list/:listName/items ──────────────────────────────────────────
const getPriceListByName = async (req, res) => {
  try {
    const { listName } = req.params;
    const { search }   = req.query;
    const cKey = !search ? listKey(listName) : null;

    const result = await cache.getOrFetch(cKey || `${listKey(listName)}:${search}`, async () => {
      const where = { priceListName: listName, isActive: true };
      if (search) {
        where.OR = [
          { displayName: { contains: search, mode: 'insensitive' } },
          { origin:      { contains: search, mode: 'insensitive' } },
          { linkedItems: { some: { itemName: { contains: search, mode: 'insensitive' } } } },
          { linkedItems: { some: { itemCode: { contains: search, mode: 'insensitive' } } } },
        ];
      }

      const [items, info] = await Promise.all([
        prisma.priceList.findMany({
          where,
          include: { linkedItems: { select: { itemId: true, itemCode: true, itemName: true } } },
          orderBy: { itemDisplayOrder: 'asc' },
        }),
        prisma.priceList.findFirst({
          where:  { priceListName: listName },
          select: { priceListDescription: true },
        }),
      ]);

      return { name: listName, description: info?.priceListDescription || '', items: items.map(n) };
    });

    res.setHeader('X-Cache', cKey ? 'MISS' : 'SKIP').json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET /price-list/item/:itemId ──────────────────────────────────────────────
const getItemPrice = async (req, res) => {
  try {
    const { itemId }   = req.params;
    const { listName } = req.query;
    const cKey = listName ? `${itemKey(itemId)}:${listName}` : itemKey(itemId);

    const result = await cache.getOrFetch(cKey, async () => {
      const where = { isActive: true, linkedItems: { some: { itemId } } };
      if (listName) where.priceListName = listName;

      const entry = await prisma.priceList.findFirst({
        where,
        include: { linkedItems: { where: { itemId }, select: { itemCode: true, itemName: true } } },
      });
      return entry ? n(entry) : null;
    });

    res.setHeader('X-Cache', 'MISS').json(result);
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET /price-list/item-with-purchase/:itemId ────────────────────────────────
const getItemPriceWithLastPurchase = async (req, res) => {
  try {
    const { itemId }   = req.params;
    const { listName } = req.query;

    const [priceEntry, lastInvoice] = await Promise.all([
      prisma.priceList.findFirst({
        where:   { isActive: true, linkedItems: { some: { itemId } }, ...(listName ? { priceListName: listName } : {}) },
        include: { linkedItems: { where: { itemId } } },
      }),
      prisma.purchaseInvoice.findFirst({
        where:   { items: { some: { itemId } } },
        include: { items: { where: { itemId } }, supplier: { select: { name: true } } },
        orderBy: { date: 'desc' },
      }),
    ]);

    let lastPurchaseInfo = null;
    if (lastInvoice?.items?.[0]) {
      const it = lastInvoice.items[0];
      lastPurchaseInfo = { price: it.price, supplierName: lastInvoice.supplier?.name || '—', date: lastInvoice.date };
    }

    res.json({ priceEntry: priceEntry ? n(priceEntry) : null, lastPurchaseInfo });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── POST /price-list — إنشاء أو تعديل صف ─────────────────────────────────────
const upsertPriceEntry = async (req, res) => {
  try {
    const { entryId, priceListName, displayName, origin, unit, notes, prices, linkedItems, description } = req.body;

    if (!priceListName)       return res.status(400).json({ message: 'اسم القائمة مطلوب' });
    if (!displayName?.trim()) return res.status(400).json({ message: 'الاسم الظاهر مطلوب' });
    if (!prices?.length)      return res.status(400).json({ message: 'الأسعار مطلوبة' });

    // جلب بيانات الأصناف المرتبطة
    let linkedArr = [];
    if (Array.isArray(linkedItems) && linkedItems.length > 0) {
      const itemIds = linkedItems.map(li => li.itemId || li.item).filter(Boolean);
      const foundItems = await prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, code: true, name: true } });
      const itemMap = new Map(foundItems.map(i => [i.id, i]));
      linkedArr = itemIds.map(id => itemMap.get(id)).filter(Boolean).map(i => ({ itemId: i.id, itemCode: i.code, itemName: i.name }));
    }

    const defaultPrice = Number(prices[0]?.price) || 0;

    let entry;
    if (entryId) {
      // ── تعديل ──
      const existing = await prisma.priceList.findUnique({ where: { id: entryId } });
      if (!existing || !existing.isActive) return res.status(404).json({ message: 'الصف غير موجود' });

      // حذف الروابط القديمة وإعادة إنشائها
      await prisma.priceListItemLink.deleteMany({ where: { priceListId: entryId } });

      entry = await prisma.priceList.update({
        where: { id: entryId },
        data: {
          displayName: displayName.trim(),
          origin:      origin || '',
          unit:        unit   || '',
          notes:       notes  || '',
          prices, defaultPrice,
          updatedById: req.user.id,
          ...(description !== undefined && { priceListDescription: description }),
          linkedItems: { create: linkedArr },
        },
        include: { linkedItems: true },
      });
    } else {
      // ── إنشاء ──
      const maxOrder = await prisma.priceList.findFirst({
        where:   { priceListName, isActive: true },
        orderBy: { itemDisplayOrder: 'desc' },
        select:  { itemDisplayOrder: true },
      });

      entry = await prisma.priceList.create({
        data: {
          priceListName,
          priceListDescription: description || '',
          displayName: displayName.trim(),
          origin:   origin || '',
          unit:     unit   || '',
          notes:    notes  || '',
          prices, defaultPrice,
          itemDisplayOrder: (maxOrder?.itemDisplayOrder ?? -1) + 1,
          isActive:    true,
          updatedById: req.user.id,
          linkedItems: { create: linkedArr },
        },
        include: { linkedItems: true },
      });
    }

    cache.invalidate(); // مسح الكاش بعد أي تعديل
    res.json(n(entry));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── POST /price-list/reorder ──────────────────────────────────────────────────
const reorderItems = async (req, res) => {
  try {
    const { listName, orderedEntryIds } = req.body;
    if (!listName || !Array.isArray(orderedEntryIds))
      return res.status(400).json({ message: 'بيانات غير صحيحة' });

    // transaction لضمان atomic reorder
    await prisma.$transaction(
      orderedEntryIds.map((id, index) =>
        prisma.priceList.update({ where: { id }, data: { itemDisplayOrder: index } })
      )
    );
    res.json({ message: 'تم حفظ الترتيب' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── DELETE /price-list/:id ────────────────────────────────────────────────────
const deletePriceEntry = async (req, res) => {
  try {
    const entry = await prisma.priceList.update({
      where:  { id: req.params.id },
      data:   { isActive: false },
      select: { priceListName: true, linkedItems: { select: { itemId: true } } },
    });
    if (entry)
    res.json({ message: 'تم الحذف' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'الصف مش موجود' });
    res.status(500).json({ message: err.message });
  }
};

// ── POST /price-list/lists ────────────────────────────────────────────────────
const createPriceList = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: 'اسم القائمة مطلوب' });

    const exists = await prisma.priceList.findFirst({ where: { priceListName: name }, select: { id: true } });
    if (exists) return res.status(400).json({ message: 'قائمة بهذا الاسم موجودة بالفعل' });
    res.json({ message: 'تم', name, description: description || '' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── PUT /price-list/lists/info ────────────────────────────────────────────────
const updatePriceListInfo = async (req, res) => {
  try {
    const { oldName, newName, description } = req.body;
    if (!oldName || !newName) return res.status(400).json({ message: 'البيانات مطلوبة' });

    if (newName !== oldName) {
      const dup = await prisma.priceList.findFirst({ where: { priceListName: newName }, select: { id: true } });
      if (dup) return res.status(400).json({ message: 'هذا الاسم مستخدم بالفعل' });
    }

    await prisma.priceList.updateMany({
      where: { priceListName: oldName },
      data:  { priceListName: newName, priceListDescription: description || '' },
    });
    res.json({ message: 'تم التحديث' });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET /price-list/cache/stats ───────────────────────────────────────────────
const getCacheStats = (req, res) => {
  res.json({ message: 'In-memory cache active', timestamp: new Date() });
};


module.exports = {
  getAllPriceLists, getPriceListByName,
  getItemPrice, getItemPriceWithLastPurchase,
  upsertPriceEntry, reorderItems, deletePriceEntry,
  createPriceList, updatePriceListInfo, getCacheStats,
};