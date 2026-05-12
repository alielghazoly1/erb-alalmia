// ─── components/SupplierSummaryCards.jsx ────────────────────────────────────
// كروت الإجماليات أعلى كشف حساب المورد
// مخفية في الطباعة (print:hidden)
// ────────────────────────────────────────────────────────────────────────────

export default function SupplierSummaryCards({ statement }) {
  const {
    totalPurchases = 0,
    totalReturns   = 0,
    totalPaid      = 0,
    balance        = 0,
  } = statement;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 print:hidden">
      <SummaryCard label="إجمالي التوريد"  value={totalPurchases} color="blue"   />
      <SummaryCard label="المرتجعات"       value={totalReturns}   color="orange" prefix="-" />
      <SummaryCard label="إجمالي المدفوع"  value={totalPaid}      color="green"  prefix="+" />
      <SummaryCard
        label={balance > 0 ? '⚠️ مستحق للمورد' : '✅ الرصيد'}
        value={Math.abs(balance)}
        color={balance > 0 ? 'red' : 'gray'}
        bold
      />
    </div>
  );
}

function SummaryCard({ label, value, prefix = '', color, bold }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   lbl: 'text-blue-500'   },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', lbl: 'text-orange-400' },
    green:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  lbl: 'text-green-500'  },
    red:    { bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-700',    lbl: 'text-red-500'    },
    gray:   { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-700',   lbl: 'text-gray-400'   },
  };
  const c = colors[color] || colors.gray;

  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-3 text-center`}>
      <p className={`text-xs font-medium mb-1 ${c.lbl}`}>{label}</p>
      <p className={`font-bold ${c.text} ${bold ? 'text-3xl' : 'text-2xl'}`}>
        {prefix}{value.toFixed(2)}
      </p>
      <p className={`text-xs ${c.lbl}`}>ج.م</p>
    </div>
  );
}
