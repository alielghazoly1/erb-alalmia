// ── Formatters ─────────────────────────────────────────────────────────────
export const fmtDate = (d) => new Date(d).toLocaleDateString('ar-EG');
export const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

export const todayStr = () => new Date().toISOString().split('T')[0];
export const yesterdayStr = () => {
  const y = new Date(); y.setDate(y.getDate() - 1);
  return y.toISOString().split('T')[0];
};
export const weekStartStr = () => {
  const w = new Date(); w.setDate(w.getDate() - 6);
  return w.toISOString().split('T')[0];
};

// ── Action labels ───────────────────────────────────────────────────────────
export const ACTION_LABEL = {
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

export const ACTION_OPTS = [
  { value: '', label: 'كل العمليات' },
  ...Object.entries(ACTION_LABEL).map(([value, { text, icon }]) => ({
    value,
    label: `${icon} ${text}`,
  })),
];

// ── Badge color map ─────────────────────────────────────────────────────────
export const COLOR_CLS = {
  green:  'bg-green-100 text-green-700',
  red:    'bg-red-100 text-red-700',
  orange: 'bg-orange-100 text-orange-700',
  amber:  'bg-amber-100 text-amber-700',
  blue:   'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  gray:   'bg-gray-100 text-gray-600',
};

export const LIMIT = 50;
