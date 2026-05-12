// ─── components/TxFilterTabs.jsx ─────────────────────────────────────────────
// تبويبات فلترة الحركات داخل كشف الحساب (الكل / فواتير / مرتجعات / مدفوعات)
// pagination = { invTotal, retTotal, payTotal } لعرض العدد في كل تاب
// ────────────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'all',      label: 'الكل',          countKey: null         },
  { key: 'invoices', label: '🧾 الفواتير',   countKey: 'invTotal'   },
  { key: 'returns',  label: '↩️ المرتجعات',  countKey: 'retTotal'   },
  { key: 'payments', label: '💰 المدفوعات',  countKey: 'payTotal'   },
];

export default function TxFilterTabs({ active, onChange, pagination = {} }) {
  return (
    <div className="flex gap-2 flex-wrap border-b mb-4 pb-2 print:hidden">
      {TABS.map(({ key, label, countKey }) => {
        const count = countKey ? pagination[countKey] : null;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`text-sm px-4 py-1.5 rounded-full border transition-colors font-medium ${
              active === key
                ? 'bg-blue-600 text-white border-blue-600'
                : 'text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {label}
            {count !== null && count !== undefined && (
              <span className="mr-1 opacity-70">({count.toLocaleString()})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
