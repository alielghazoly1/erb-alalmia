// ─── components/StatusBadge.jsx ─────────────────────────────────────────────
// Badge لحالة الفاتورة — مُوافق / معلق / ملغي
// مشترك بين InvoicesTable وغيرها
// ────────────────────────────────────────────────────────────────────────────

const STATUS_MAP = {
  approved:  { label: 'مُوافق عليها', cls: 'bg-green-100 text-green-700'  },
  pending:   { label: 'مُعلقة',       cls: 'bg-yellow-100 text-yellow-700' },
  cancelled: { label: 'ملغية',        cls: 'bg-red-100 text-red-500'       },
};

export default function StatusBadge({ status }) {
  const { label, cls } = STATUS_MAP[status] || {
    label: status,
    cls:   'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 font-medium rounded ${cls}`}>
      {label}
    </span>
  );
}
