// ── Formatters ─────────────────────────────────────────────────────────────
export const fmt = (n, d = 2) => Number(n || 0).toFixed(d);

export const todayStr = () => new Date().toISOString().split('T')[0];

// ── Status map ──────────────────────────────────────────────────────────────
export const STATUS = {
  pending:  { text: 'معلق',   cls: 'bg-yellow-100 text-yellow-700', icon: '⏳' },
  approved: { text: 'مُوافق', cls: 'bg-green-100 text-green-700',   icon: '✅' },
  rejected: { text: 'مرفوض',  cls: 'bg-red-100 text-red-700',       icon: '❌' },
};

// ── Warehouse labels ────────────────────────────────────────────────────────
export const WH = {
  ramses:  '🏭 رمسيس',
  october: '🏭 أكتوبر',
};

// ── Print styles ────────────────────────────────────────────────────────────
export const PRINT_STYLE = `
  @page { size: A4 portrait; margin: 12mm 10mm 14mm 10mm; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
  body { font-size: 10px; color: #111; background: white; direction: rtl; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tbody tr { page-break-inside: avoid; }
  .no-print { display: none !important; }
`;

// ── Helper: sum totalWeight from an array of lines ──────────────────────────
export const sumWeight = (lines) =>
  (lines || []).reduce((s, r) => s + (r.totalWeight || 0), 0);

// ── newRow factory ──────────────────────────────────────────────────────────
export const newRow = () => ({
  id: Date.now() + Math.random(),
  item: null, itemCode: '', itemName: '', unit: '',
  quantity: '', weight: '', totalWeightManual: '',
  saved: false, editing: false,
});

// ── calcTotalWeight ─────────────────────────────────────────────────────────
export const calcTotalWeight = (row) => {
  if (row.totalWeightManual !== '' && row.totalWeightManual !== undefined)
    return parseFloat(row.totalWeightManual) || 0;
  return (parseFloat(row.quantity) || 0) * (parseFloat(row.weight) || 0);
};
