// ─── middleware/authMiddleware.js ─────────────────────────────────────────────
// ✅ PERF-AUTH-001: userCache يمنع 2 DB queries على كل request
//    كل user يُخزَّن 60 ثانية — بعد تغيير صلاحيات يُمسح فوراً
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const jwt       = require('jsonwebtoken');
const prisma    = require('../config/db');
const userCache = require('../utils/userCache');

const PERM_MAP = {
  allowNegativeSale: 'sale_allow_negative',
  canEditInvoice:    'sale_edit',
};

// ── protect ───────────────────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  const token = req.cookies?.authToken;
  if (!token) return res.status(401).json({ message: 'غير مصرح — يرجى تسجيل الدخول' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ PERF-AUTH-001: من الكاش (< 1ms) بدل 2 DB queries (~300ms)
    const user = await userCache.getUser(decoded.id, () =>
      prisma.user.findUnique({
        where:  { id: decoded.id },
        select: {
          id: true, name: true, username: true,
          role: true, scope: true, isActive: true,
          permissions: { select: { permission: true, granted: true } },
        },
      })
    );

    if (!user || !user.isActive) {
      userCache.invalidateUser(decoded.id);
      return res.status(401).json({ message: 'المستخدم غير موجود أو معطل' });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'التوكن غير صالح أو منتهي — سجل دخولك مجدداً' });
  }
};

// ── adminOnly ─────────────────────────────────────────────────────────────────
const adminOnly = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  res.status(403).json({ message: 'ممنوع — للأدمن فقط' });
};

// ── requirePermission ─────────────────────────────────────────────────────────
const requirePermission = (permKey) => (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  const dbKey = PERM_MAP[permKey] || permKey;
  const perms = req.user?.permissions;
  if (perms?.some(p => p.permission === dbKey && p.granted === true)) return next();
  return res.status(403).json({ message: 'ليس لديك صلاحية لهذا الإجراء' });
};

module.exports = { protect, adminOnly, requirePermission };
