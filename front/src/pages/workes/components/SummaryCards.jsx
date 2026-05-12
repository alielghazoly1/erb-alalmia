// ─── components/SummaryCards.jsx ─────────────────────────────────────────────
//  بطاقات الإجماليات (أوامر / خامات / منتجات / هالك)
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (n, d = 2) => Number(n || 0).toFixed(d);

const CARDS = [
  {
    key:   'totalOrders',
    label: 'أوامر مُوافق',
    icon:  '✅',
    color: 'blue',
    unit:  'أمر',
    fmt:   (v) => v,
  },
  {
    key:   'totalRawWeight',
    label: 'خامات مستهلكة',
    icon:  '📤',
    color: 'orange',
    unit:  'كيلو',
    fmt:   (v) => fmt(v),
  },
  {
    key:   'totalOutputWeight',
    label: 'منتجات تمت',
    icon:  '📦',
    color: 'green',
    unit:  'كيلو',
    fmt:   (v) => fmt(v),
  },
  {
    key:   'wasteWeight',
    label: 'هالك',
    icon:  '⚖️',
    color: 'dynamic', // بيتحدد حسب القيمة
    unit:  'كيلو',
    fmt:   (v) => fmt(v),
  },
];

const COLOR_MAP = {
  blue:   'bg-blue-50 border-blue-100 text-blue-700 text-blue-400',
  orange: 'bg-orange-50 border-orange-100 text-orange-600 text-orange-400',
  green:  'bg-green-50 border-green-100 text-green-700 text-green-400',
  red:    'bg-red-50 border-red-100 text-red-600 text-red-400',
  gray:   'bg-gray-50 border-gray-100 text-gray-500 text-gray-400',
};

export default function SummaryCards({ summary }) {
  if (!summary) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      {CARDS.map(({ key, label, icon, color, unit, fmt: fmtFn }) => {
        const val = summary[key] ?? 0;

        // الهالك — أحمر لو موجب، رمادي لو صفر
        const resolvedColor = color === 'dynamic'
          ? (val > 0 ? 'red' : 'gray')
          : color;

        const [bg, border, text, muted] = COLOR_MAP[resolvedColor].split(' ');

        return (
          <div key={key} className={`rounded-xl p-4 text-center border ${bg} ${border}`}>
            <p className={`text-xs mb-1 ${muted}`}>{icon} {label}</p>
            <p className={`text-2xl font-bold ${text}`}>{fmtFn(val)}</p>
            <p className={`text-xs ${muted}`}>{unit}</p>
          </div>
        );
      })}
    </div>
  );
}
