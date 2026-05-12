// components/SaleStatusBadge.jsx
const statusMap = {
  pending:   { text: 'معلق',   cls: 'bg-yellow-100 text-yellow-700' },
  approved:  { text: 'مُوافق', cls: 'bg-green-100 text-green-700' },
  suspended: { text: 'موقوف', cls: 'bg-orange-100 text-orange-700' },
  cancelled: { text: 'ملغي',  cls: 'bg-red-100 text-red-700' },
  returned:  { text: 'مرتجع', cls: 'bg-gray-100 text-gray-600' },
};

export { statusMap };

export default function SaleStatusBadge({ status }) {
  const s = statusMap[status] || statusMap.pending;
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.cls}`}>
      {s.text}
    </span>
  );
}
