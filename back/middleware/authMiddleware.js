// ─── middleware/authMiddleware.js ──────────────────────────────────────────────
const jwt    = require('jsonwebtoken');
const prisma = require('../config/db');

// mapping من الـ keys القديمة (المستخدمة في الـ routes) للـ Permission enum في DB
const PERM_MAP = {
  allowNegativeSale: 'sale_allow_negative',
  canEditInvoice:    'sale_edit',
};

const protect = async (req, res, next) => {
  const token = req.cookies?.authToken;

  if (!token) {
    return res.status(401).json({ message: 'غير مصرح — يرجى تسجيل الدخول' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true, name: true, username: true,
        role: true, scope: true, isActive: true,
        permissions: { select: { permission: true, granted: true } },
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'المستخدم غير موجود أو معطل' });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'التوكن غير صالح أو منتهي — سجل دخولك مجدداً' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  res.status(403).json({ message: 'ممنوع — للأدمن فقط' });
};

/**
 * middleware للتحقق من صلاحية محددة.
 * يقبل:
 *   - الـ Permission enum مباشرة (مثلاً 'sale_edit')
 *   - أو الـ key القديم (مثلاً 'canEditInvoice') للتوافق مع الـ routes الحالية
 *
 * الأدمن يعدي تلقائياً — اليوزر العادي لازم الصلاحية مفعّلة
 */
const requirePermission = (permKey) => (req, res, next) => {
  if (req.user?.role === 'admin') return next();

  // حوّل الـ key القديم للـ enum الجديد لو موجود في الـ map
  const dbKey = PERM_MAP[permKey] || permKey;

  const perms = req.user?.permissions;
  if (perms && perms.some(p => p.permission === dbKey && p.granted === true)) return next();

  return res.status(403).json({ message: 'ليس لديك صلاحية لهذا الإجراء' });
};

module.exports = { protect, adminOnly, requirePermission };