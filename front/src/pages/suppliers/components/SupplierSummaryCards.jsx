// ─── SupplierSummaryCards.jsx ─────────────────────────────────────────────────
import { toNum } from '../../../utils/fmt';

const COLORS = {
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   lbl: 'text-blue-500'   },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', lbl: 'text-orange-400' },
  green:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  lbl: 'text-green-500'  },
  red:    { bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-700',    lbl: 'text-red-500'    },
  gray:   { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-700',   lbl: 'text-gray-400'   },
};

function SummaryCard({ label, value, prefix = '', color = 'gray', bold = false }) {
  const c = COLORS[color] || COLORS.gray;
  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-3 text-center`}>
      <p className={`text-xs font-medium mb-1 ${c.lbl}`}>{label}</p>
      <p className={`font-bold ${c.text} ${bold ? 'text-3xl' : 'text-2xl'}`}>
        {prefix}{toNum(value).toFixed(2)}
      </p>
      <p className={`text-xs ${c.lbl}`}>ج.م</p>
    </div>
  );
}

export default function SupplierSummaryCards({ statement }) {
  const {
    totalPurchases = 0,
    totalReturns   = 0,
    totalPaid      = 0,
    balance        = 0,
  } = statement ?? {};

  const bal = toNum(balance);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 print:hidden">
      <SummaryCard label="إجمالي التوريد"  value={totalPurchases} color="blue"   />
      <SummaryCard label="المرتجعات"       value={totalReturns}   color="orange" prefix="-" />
      <SummaryCard label="إجمالي المدفوع"  value={totalPaid}      color="green"  prefix="+" />
      <SummaryCard
        label={bal > 0 ? '⚠️ مستحق للمورد' : '✅ الرصيد'}
        value={Math.abs(bal)}
        color={bal > 0 ? 'red' : 'gray'}
        bold
      />
    </div>
  );
}
