// ─── components/SupplierTxFilterTabs.jsx ────────────────────────────────────
// تابز فلترة حركات المورد — مخفية في الطباعة
// ────────────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'all',      label: 'الكل' },
  { key: 'invoices', label: '🧾 الفواتير' },
  { key: 'returns',  label: '↩️ المرتجعات' },
  { key: 'payments', label: '💰 المدفوعات' },
];

export default function SupplierTxFilterTabs({ active, pagination = {}, onChange }) {
  const counts = {
    invoices: pagination.invTotal,
    returns:  pagination.retTotal,
    payments: pagination.payTotal,
  };

  return (
    <div className="flex gap-2 flex-wrap mb-4 print:hidden">
      {TABS.map(({ key, label }) => {
        const count = counts[key];
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`text-sm px-4 py-2 rounded-lg border transition-colors ${
              active === key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {label}
            {count !== undefined ? ` (${count.toLocaleString()})` : ''}
          </button>
        );
      })}
    </div>
  );
}
