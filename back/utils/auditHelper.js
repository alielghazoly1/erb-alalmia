// ─── utils/auditHelper.js ─────────────────────────────────────────────────────
// متوافق مع schema الجديدة:
//   - AuditLog model: لا يوجد userId كـ scalar — يتربط عبر user { connect }
//   - لا يوجد 'details' field — بدلها 'meta' (Json?)
//   - action لازم يكون من AuditAction enum بالظبط
// ─────────────────────────────────────────────────────────────────────────────
const prisma = require('../config/db');

// Map كل string قديم لـ AuditAction enum صحيح
const ACTION_MAP = {
  // فواتير مبيعات
  invoice_created:         'invoice_created',
  invoice_approved:        'invoice_approved',
  invoice_edited:          'invoice_edited',
  invoice_cancelled:       'invoice_cancelled',
  invoice_suspended:       'invoice_suspended',
  invoice_restored:        'invoice_restored',
  // مرتجعات
  return_created:          'return_created',
  return_updated:          'return_created',   // fallback
  return_approved:         'return_approved',
  return_rejected:         'return_rejected',
  // دفعات
  payment_created:         'payment_created',
  payment_updated:         'payment_updated',
  payment_deleted:         'payment_deleted',
  // عملاء
  customer_created:        'customer_created',
  customer_updated:        'customer_updated',
  customer_deleted:        'customer_deleted',
  initial_balance_updated: 'customer_updated',  // fallback
  // موردين
  supplier_created:        'supplier_created',
  supplier_updated:        'supplier_updated',
  supplier_deleted:        'supplier_deleted',
  // مخزون
  stock_adjustment:        'stock_adjustment',
  stock_transfer:          'stock_transfer',
  transfer_created:        'stock_transfer',
  transfer_updated:        'stock_transfer',
  transfer_approved:       'stock_transfer',
  transfer_rejected:       'stock_transfer',
  manufacturing_approved:  'manufacturing_approved',
  // نظام
  user_login:              'user_login',
  user_logout:             'user_logout',
  user_created:            'user_created',
  user_updated:            'user_updated',
  user_deactivated:        'user_deactivated',
  season_created:          'season_created',
  season_activated:        'season_activated',
  season_closed:           'season_closed',
  // خزينة
  treasury_entry_created:  'treasury_entry_created',
  treasury_adjustment:     'treasury_adjustment',
};

/**
 * يسجل حدث في audit_logs — مش بيرمي error لو فشل
 */
const audit = async (user, action, resource, resourceId, resourceRef, details) => {
  try {
    const mappedAction = ACTION_MAP[action];
    if (!mappedAction) return; // skip unknown actions silently

    const data = {
      userName:    user?.name  ?? null,
      userRole:    user?.role  ?? null,
      action:      mappedAction,
      resource:    resource    ?? null,
      resourceId:  resourceId  ? String(resourceId) : null,
      resourceRef: String(resourceRef || ''),
      meta:        details     ?? undefined,
    };

    // userId كـ relation connect (مش scalar مباشرة)
    if (user?.id) {
      data.user = { connect: { id: user.id } };
    }

    await prisma.auditLog.create({ data });
  } catch {
    // الـ audit مش المفروض يوقف العملية الأصلية
  }
};

module.exports = { audit };
