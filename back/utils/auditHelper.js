// ─── utils/auditHelper.js ─────────────────────────────────────────────────────
const prisma = require('../config/db');

/**
 * يسجل حدث في audit_logs — مش بيرمي error لو فشل
 * @param {Object} user       - req.user
 * @param {string} action     - من AuditAction enum
 * @param {string} resource   - 'SaleInvoice' | 'Customer' | ...
 * @param {string} resourceId - id السجل
 * @param {string} resourceRef - رقم الفاتورة أو الاسم (للعرض)
 * @param {Object} details    - بيانات إضافية (اختياري)
 */
const audit = async (user, action, resource, resourceId, resourceRef, details) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId:      user?.id ?? null,
        userName:    user?.name ?? null,
        userRole:    user?.role ?? null,
        action,
        resource:    resource ?? null,
        resourceId:  resourceId ? String(resourceId) : null,
        resourceRef: String(resourceRef || ''),
        details:     details ?? undefined,
      },
    });
  } catch {
    // الـ audit مش المفروض يوقف العملية الأصلية
  }
};

module.exports = { audit };
