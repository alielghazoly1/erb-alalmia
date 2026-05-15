// ─── components/ItemStatementSummary.jsx ────────────────────────────────────
// كروت ملخص كشف الصنف — كمية / وزن / مبلغ / آخر سعر
// ────────────────────────────────────────────────────────────────────────────
import { toNum } from '../../../utils/fmt';
export default function ItemStatementSummary({ data }) {
  if (!data) return null;

  const cards = [
    {
      label: 'إجمالي الكمية',
      value: data.totalQty,
      unit:  'كرتونة',
      color: 'blue',
    },
    {
      label: 'إجمالي الوزن',
      value: data.totalWeight?.toFixed(2),
      unit:  'كجم',
      color: 'indigo',
    },
    {
      label: 'إجمالي المبلغ',
      value: toNum(data.totalAmount).toFixed(2)(),
      unit:  'ج.م',
      color: 'green',
    },
    {
      label: 'آخر سعر',
      value: data.lastPrice?.toFixed(2),
      unit:  'ج.م / كجم',
      color: 'gray',
    },
  ];

  if (data.returnQty > 0) {
    cards.push(
      {
        label: 'مرتجع — كمية',
        value: data.returnQty,
        unit:  'كرتونة',
        color: 'orange',
      },
      {
        label: 'مرتجع — وزن',
        value: data.returnWeight?.toFixed(2),
        unit:  'كجم',
        color: 'orange',
      },
    );
  }

  const colorMap = {
    blue:   'bg-blue-50   border-blue-200   text-blue-700   text-blue-500',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700 text-indigo-500',
    green:  'bg-green-50  border-green-200  text-green-700  text-green-500',
    gray:   'bg-gray-50   border-gray-200   text-gray-700   text-gray-400',
    orange: 'bg-orange-50 border-orange-200 text-orange-700 text-orange-500',
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {cards.map(({ label, value, unit, color }) => {
        const [bg, border, textVal, textLabel] = colorMap[color].split('   ');
        return (
          <div key={label} className={`${bg} border ${border} rounded-xl p-3 text-center`}>
            <p className={`text-xs font-medium mb-1 ${textLabel}`}>{label}</p>
            <p className={`text-2xl font-bold ${textVal}`}>{value}</p>
            <p className={`text-xs ${textLabel}`}>{unit}</p>
          </div>
        );
      })}
    </div>
  );
}
