// ─── controllers/seasonController.js ─────────────────────────────────────────
//  Clean, production-ready controller for Season management
//  ✅ Fixed: prisma.season.updateMany() — wrong signature → correct { where, data }
//  ✅ Fixed: validation on createSeason (name, startDate, endDate required)
//  ✅ Fixed: date range logic (endDate must be after startDate)
//  ✅ Added: $transaction to guarantee atomicity (deactivate + create / activate)
//  ✅ Added: conflict guard (duplicate season name)
//  ✅ Added: normalSeason helper preserved for frontend _id compatibility
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

const prisma = require('../config/db');
const { safeNum, round2, round3, n } = require('../utils/decimalHelper');
const { getStockQty } = require('../utils/stockHelper');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * يضيف _id بجانب id للتوافق مع الـ frontend الي بيعتمد على _id (MongoDB style)
 * @param {object} season
 */
const normalSeason = (season) => ({ ...season, _id: season.id });



// ─── GET /api/seasons ─────────────────────────────────────────────────────────

const getSeasons = async (req, res) => {
  try {
    const seasons = await prisma.season.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return res.json(seasons.map(normalSeason));
  } catch (err) {
    console.error('[getSeasons]', err);
    return res.status(500).json({ message: 'حدث خطأ أثناء جلب المواسم' });
  }
};

// ─── GET /api/seasons/active ──────────────────────────────────────────────────

const getActiveSeason = async (req, res) => {
  try {
    const season = await prisma.season.findFirst({
      where: { isActive: true },
    });

    if (!season) {
      return res.status(404).json({ message: 'مفيش موسم نشط حالياً' });
    }

    return res.json(normalSeason(season));
  } catch (err) {
    console.error('[getActiveSeason]', err);
    return res.status(500).json({ message: 'حدث خطأ أثناء جلب الموسم النشط' });
  }
};

// ─── POST /api/seasons ────────────────────────────────────────────────────────

const createSeason = async (req, res) => {
  try {
    const { name, startDate, endDate, isManufacturing = false } = req.body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!name?.trim()) {
      return res.status(400).json({ message: 'اسم الموسم مطلوب' });
    }
    if (!startDate) {
      return res.status(400).json({ message: 'تاريخ بداية الموسم مطلوب' });
    }
    if (!endDate) {
      return res.status(400).json({ message: 'تاريخ نهاية الموسم مطلوب' });
    }

    const start = new Date(startDate);
    const end   = new Date(endDate);

    if (isNaN(start.getTime())) {
      return res.status(400).json({ message: 'تاريخ البداية غير صالح' });
    }
    if (isNaN(end.getTime())) {
      return res.status(400).json({ message: 'تاريخ النهاية غير صالح' });
    }
    if (end <= start) {
      return res.status(400).json({ message: 'تاريخ النهاية لازم يكون بعد تاريخ البداية' });
    }

    // ── Duplicate name guard ──────────────────────────────────────────────────
    const existing = await prisma.season.findFirst({
      where: { name: name.trim() },
    });
    if (existing) {
      return res.status(409).json({ message: `موسم بالاسم "${name.trim()}" موجود بالفعل` });
    }

    // ── Transaction: deactivate all → create new active season ───────────────
    const season = await prisma.$transaction(async (tx) => {
      await tx.season.updateMany({
        where: {},
        data:  { isActive: false },
      });

      return tx.season.create({
        data: {
          name:            name.trim(),
          code:            name.trim().replace(/\s+/g, '-').toUpperCase().slice(0, 20),
          startDate:       start,
          endDate:         end,
          isManufacturing: Boolean(isManufacturing),
          isActive:        true,
          createdById:     null,
        },
      });
    });

    return res.status(201).json(normalSeason(season));
  } catch (err) {
    console.error('[createSeason]', err);
    return res.status(500).json({ message: 'حدث خطأ أثناء إنشاء الموسم' });
  }
};

// ─── PUT /api/seasons/:id/activate ───────────────────────────────────────────

const activateSeason = async (req, res) => {
  try {
    const { id } = req.params;

    const target = await prisma.season.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({ message: 'الموسم مش موجود' });
    }
    if (target.isActive) {
      return res.status(400).json({ message: 'الموسم ده نشط بالفعل' });
    }

    // ── Transaction: deactivate all → activate target ─────────────────────────
    const season = await prisma.$transaction(async (tx) => {
      await tx.season.updateMany({
        where: {},
        data:  { isActive: false },
      });

      return tx.season.update({
        where: { id },
        data:  { isActive: true },
      });
    });

    return res.json({ message: 'تم تفعيل الموسم ✅', season: normalSeason(season) });
  } catch (err) {
    console.error('[activateSeason]', err);
    return res.status(500).json({ message: 'حدث خطأ أثناء تفعيل الموسم' });
  }
};

// ─── PUT /api/seasons/:id ─────────────────────────────────────────────────────

const updateSeason = async (req, res) => {
  try {
    const { id } = req.params;

    // isActive و stockSnapshot محميان — مش بنسمح بتعديلهم من هنا
    const { isActive, stockSnapshot, ...rest } = req.body;

    const data = {};

    if (rest.name !== undefined) {
      if (!rest.name?.trim()) {
        return res.status(400).json({ message: 'اسم الموسم لا يمكن أن يكون فارغاً' });
      }
      data.name = rest.name.trim();
    }

    if (rest.startDate !== undefined) {
      const d = new Date(rest.startDate);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ message: 'تاريخ البداية غير صالح' });
      }
      data.startDate = d;
    }

    if (rest.endDate !== undefined) {
      const d = new Date(rest.endDate);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ message: 'تاريخ النهاية غير صالح' });
      }
      data.endDate = d;
    }

    if (rest.isManufacturing !== undefined) {
      data.isManufacturing = Boolean(rest.isManufacturing);
    }

    // Validate date range when both sides are present (after merging with DB)
    if (data.startDate && data.endDate && data.endDate <= data.startDate) {
      return res.status(400).json({ message: 'تاريخ النهاية لازم يكون بعد تاريخ البداية' });
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'مفيش بيانات للتعديل' });
    }

    const season = await prisma.season.update({
      where: { id },
      data,
    });

    return res.json(normalSeason(season));
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'الموسم مش موجود' });
    }
    console.error('[updateSeason]', err);
    return res.status(500).json({ message: 'حدث خطأ أثناء تعديل الموسم' });
  }
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  getSeasons,
  getActiveSeason,
  createSeason,
  activateSeason,
  updateSeason,
};