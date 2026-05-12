// ─── components/OrdersStatsBar.jsx ───────────────────────────────────────────
//  بار الإجماليات (معتمد / خامات / منتجات) في قائمة الأوامر
// ─────────────────────────────────────────────────────────────────────────────
import { fmt } from '../manufacturingConfig';

export default function OrdersStatsBar({ approvedCount, totalRawWt, totalOutWt }) {
  const stats = [
    {
      label: 'مُوافق (محمّل)',
      value: approvedCount,
      unit:  'أمر',
      bg:    'bg-blue-50 border-blue-100',
      text:  'text-blue-700',
      muted: 'text-blue-500',
    },
    {
      label: 'خامات مستهلكة',
      value: fmt(totalRawWt, 1),
      unit:  'كيلو',
      bg:    'bg-orange-50 border-orange-100',
      text:  'text-orange-600',
      muted: 'text-orange-500',
    },
    {
      label: 'منتجات تمت',
      value: fmt(totalOutWt, 1),
      unit:  'كيلو',
      bg:    'bg-green-50 border-green-100',
      text:  'text-green-700',
      muted: 'text-green-500',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3 mb-4">
      {stats.map(s => (
        <div key={s.label} className={`card border text-center py-3 ${s.bg}`}>
          <p className={`text-xs mb-1 ${s.muted}`}>{s.label}</p>
          <p className={`text-2xl font-bold ${s.text}`}>{s.value}</p>
          {s.unit && <p className={`text-xs ${s.muted}`}>{s.unit}</p>}
        </div>
      ))}
    </div>
  );
}
