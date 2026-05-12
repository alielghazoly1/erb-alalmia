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
        hour: '2-digit',
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

// ── Labels ─────────────────────────────────────────────────────────────────
export const TYPE_LABEL = {
  sale_cash:    { text: 'فاتورة نقدي',  cls: 'bg-green-100 text-green-700',   icon: '🧾', sign: '+' },
  sale_bank:    { text: 'فاتورة بنكي',  cls: 'bg-blue-100 text-blue-700',     icon: '🏦', sign: '+' },
  payment_cash: { text: 'دفعة نقدي',    cls: 'bg-emerald-100 text-emerald-700',icon: '💰', sign: '+' },
  payment_bank: { text: 'دفعة بنكي',    cls: 'bg-indigo-100 text-indigo-700', icon: '💳', sign: '+' },
  return_cash:  { text: 'مرتجع نقدي',  cls: 'bg-red-100 text-red-700',       icon: '↩️', sign: '-' },
  return_bank:  { text: 'مرتجع بنكي',  cls: 'bg-orange-100 text-orange-700', icon: '↩️', sign: '-' },
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
