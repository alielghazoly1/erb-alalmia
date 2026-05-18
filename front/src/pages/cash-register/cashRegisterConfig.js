// ── Formatters ─────────────────────────────────────────────────────────────
export const fmt = (n) =>
  Number(n || 0).toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('ar-EG') : '—';

export const fmtTime = (d) =>
  d
    ? new Date(d).toLocaleTimeString('ar-EG', {
        hour:   '2-digit',
        minute: '2-digit',
      })
    : '—';

export const todayStr = () => new Date().toISOString().split('T')[0];

export const yesterdayStr = () => {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return y.toISOString().split('T')[0];
};

export const monthStartStr = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`;
};

// ── Type Labels ────────────────────────────────────────────────────────────
// يغطي كل قيم TreasuryEntryType في الـ schema:
//   sale_cash | sale_bank | purchase_cash | purchase_bank
//   payment_in_cash | payment_in_bank | payment_out_cash | payment_out_bank
//   return_in_cash  | return_in_bank  | return_out_cash  | return_out_bank
//   expense | adjustment
export const TYPE_LABEL = {
  // فواتير بيع
  sale_cash:        { text: 'بيع نقدي',      cls: 'bg-green-100 text-green-700',     icon: '🧾', sign: '+' },
  sale_bank:        { text: 'بيع بنكي',       cls: 'bg-blue-100 text-blue-700',       icon: '🏦', sign: '+' },

  // فواتير شراء
  purchase_cash:    { text: 'شراء نقدي',     cls: 'bg-yellow-100 text-yellow-700',   icon: '🛒', sign: '-' },
  purchase_bank:    { text: 'شراء بنكي',      cls: 'bg-amber-100 text-amber-700',     icon: '🏪', sign: '-' },

  // دفعات واردة (من العملاء)
  payment_in_cash:  { text: 'دفعة عميل نقدي', cls: 'bg-emerald-100 text-emerald-700', icon: '💰', sign: '+' },
  payment_in_bank:  { text: 'دفعة عميل بنكي', cls: 'bg-indigo-100 text-indigo-700',   icon: '💳', sign: '+' },

  // دفعات صادرة (للموردين)
  payment_out_cash: { text: 'دفعة مورد نقدي', cls: 'bg-orange-100 text-orange-700',   icon: '📤', sign: '-' },
  payment_out_bank: { text: 'دفعة مورد بنكي', cls: 'bg-violet-100 text-violet-700',   icon: '🏧', sign: '-' },

  // مرتجعات واردة (من العملاء — بتخصم من الخزنة)
  return_in_cash:   { text: 'مرتجع عميل نقدي', cls: 'bg-red-100 text-red-700',        icon: '↩️', sign: '-' },
  return_in_bank:   { text: 'مرتجع عميل بنكي', cls: 'bg-rose-100 text-rose-700',      icon: '↩️', sign: '-' },

  // مرتجعات صادرة (للموردين — بتضيف للخزنة)
  return_out_cash:  { text: 'مرتجع مورد نقدي', cls: 'bg-teal-100 text-teal-700',      icon: '↪️', sign: '+' },
  return_out_bank:  { text: 'مرتجع مورد بنكي', cls: 'bg-cyan-100 text-cyan-700',      icon: '↪️', sign: '+' },

  // Legacy keys (للتوافق مع بيانات قديمة)
  payment_cash:     { text: 'دفعة نقدي',      cls: 'bg-emerald-100 text-emerald-700', icon: '💰', sign: '+' },
  payment_bank:     { text: 'دفعة بنكي',       cls: 'bg-indigo-100 text-indigo-700',   icon: '💳', sign: '+' },
  return_cash:      { text: 'مرتجع نقدي',     cls: 'bg-red-100 text-red-700',         icon: '↩️', sign: '-' },
  return_bank:      { text: 'مرتجع بنكي',      cls: 'bg-rose-100 text-rose-700',       icon: '↩️', sign: '-' },

  // أخرى
  expense:          { text: 'مصروف',           cls: 'bg-gray-100 text-gray-700',       icon: '📝', sign: '-' },
  adjustment:       { text: 'تسوية',           cls: 'bg-purple-100 text-purple-700',   icon: '⚖️', sign: '' },
};

export const METHOD_LABEL = {
  cash:     'نقدي',
  instapay: 'انستاباي',
  transfer: 'تحويل',
  check:    'شيك',
  mixed:    'مختلط',
};

export const TABS = [
  { key: 'summary', label: '📊 ملخص يومي' },
  { key: 'admin',   label: '👤 خزنة الأدمن' },
  { key: 'bank',    label: '🏦 خزنة البنك' },
];
