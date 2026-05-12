// ─── controllers/Auditcontroller.js ──────────────────────────────────────────
const prisma = require('../config/db');

const actionLabel = {
  invoice_created:   { text: 'إنشاء فاتورة مبيعات', icon: '🧾', color: 'green'  },
  invoice_approved:  { text: 'موافقة على فاتورة',   icon: '✅', color: 'green'  },
  invoice_cancelled: { text: 'إلغاء فاتورة',         icon: '❌', color: 'red'    },
  invoice_suspended: { text: 'تعليق فاتورة',          icon: '⏸️', color: 'orange' },
  invoice_edited:    { text: 'تعديل فاتورة',          icon: '✏️', color: 'amber'  },
  return_created:    { text: 'إنشاء مرتجع',           icon: '↩️', color: 'orange' },
  return_approved:   { text: 'موافقة على مرتجع',     icon: '✅', color: 'blue'   },
  return_rejected:   { text: 'رفض مرتجع',             icon: '🚫', color: 'red'    },
  payment_created:   { text: 'تسجيل دفعة',            icon: '💰', color: 'green'  },
  payment_updated:   { text: 'تعديل دفعة',            icon: '✏️', color: 'amber'  },
  payment_deleted:   { text: 'حذف دفعة',              icon: '🗑️', color: 'red'    },
  customer_created:  { text: 'إضافة عميل',            icon: '👤', color: 'blue'   },
  customer_updated:  { text: 'تعديل عميل',            icon: '✏️', color: 'amber'  },
  customer_deleted:  { text: 'حذف عميل',              icon: '🗑️', color: 'red'    },
  supplier_created:  { text: 'إضافة مورد',            icon: '🏭', color: 'blue'   },
  supplier_updated:  { text: 'تعديل مورد',            icon: '✏️', color: 'amber'  },
  supplier_deleted:  { text: 'حذف مورد',              icon: '🗑️', color: 'red'    },
  user_login:        { text: 'تسجيل دخول',            icon: '🔐', color: 'gray'   },
  user_created:      { text: 'إنشاء مستخدم',          icon: '👥', color: 'blue'   },
  season_activated:  { text: 'تفعيل موسم',            icon: '🗓️', color: 'purple' },
};

// ── GET /api/audit ────────────────────────────────────────────────────────────
const getAuditLogs = async (req, res) => {
  try {
    const { userId, action, resource, startDate, endDate, page = 1, limit = 50 } = req.query;

    const where = {};
    if (userId)   where.userId   = userId;
    if (action)   where.action   = action;
    if (resource) where.resource = resource;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate)   where.createdAt.lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    const skip     = (Number(page) - 1) * Number(limit);
    const limitNum = Number(limit);

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limitNum }),
    ]);

    const enriched = logs.map(log => ({
      ...log, _id: log.id,
      actionLabel: actionLabel[log.action] || { text: log.action, icon: '•', color: 'gray' },
    }));

    res.json({ logs: enriched, total, page: Number(page), totalPages: Math.ceil(total / limitNum) });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET /api/audit/users ──────────────────────────────────────────────────────
const getAuditUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where:   { isActive: true },
      select:  { id: true, name: true, username: true, role: true },
      orderBy: { name: 'asc' },
    });
    res.json(users.map(u => ({ ...u, _id: u.id })));
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── GET /api/audit/summary ────────────────────────────────────────────────────
const getAuditSummary = async (req, res) => {
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end   = new Date(); end.setHours(23, 59, 59, 999);
    const range = { gte: start, lte: end };

    const [todayCount, rawByAction, rawByUser] = await Promise.all([
      prisma.auditLog.count({ where: { createdAt: range } }),
      prisma.auditLog.groupBy({ by: ['action'], where: { createdAt: range }, _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
      prisma.auditLog.groupBy({ by: ['userName', 'userRole'], where: { createdAt: range }, _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
    ]);

    res.json({
      todayCount,
      byAction: rawByAction.map(a => ({ _id: a.action, count: a._count.id, label: actionLabel[a.action] })),
      byUser:   rawByUser.map(u => ({ _id: u.userName, role: u.userRole, count: u._count.id })),
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { getAuditLogs, getAuditUsers, getAuditSummary };
