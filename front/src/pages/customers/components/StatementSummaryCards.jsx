// ─── components/StatementSummaryCards.jsx ───────────────────────────────────
// كروت الإجماليات أعلى كشف الحساب (مبيعات / مدفوعات / رصيد)
// مشترك بين CustomerStatementPage وغيرها
// ────────────────────────────────────────────────────────────────────────────

export default function StatementSummaryCards({ statement }) {
  const {
    totalSales   = 0,
    totalReturns = 0,
    totalPaid    = 0,
    balance      = 0,
  } = statement;


  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 print:hidden">
      <SummaryCard
        label="إجمالي المبيعات"
        value={totalSales}
        color="blue"
      />
      <SummaryCard
        label="المرتجعات"
        value={totalReturns}
        prefix="-"
        color="orange"
      />
      <SummaryCard
        label="إجمالي المدفوع"
        value={totalPaid}
        prefix="+"
        color="green"
      />
      <SummaryCard
        label={balance > 0 ? '⚠️ رصيد مستحق' : '✅ الرصيد'}
        value={Math.abs(balance)}
        suffix={balance < 0 ? ' (دائن)' : ''}
        color={balance > 0 ? 'red' : 'gray'}
        bold
      />
    </div>
  );
}

// ─── كرت واحد ────────────────────────────────────────────────────────────────
function SummaryCard({ label, value, prefix = '', suffix = '', color, bold }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   label: 'text-blue-500'   },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', label: 'text-orange-400' },
    green:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  label: 'text-green-500'  },
    red:    { bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-700',    label: 'text-red-500'    },
    gray:   { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-700',   label: 'text-gray-400'   },
  };
  const c = colors[color] || colors.gray;

  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-3 text-center`}>
      <p className={`text-xs font-medium mb-1 ${c.label}`}>{label}</p>
      <p className={`text-2xl font-bold ${c.text} ${bold ? 'text-3xl' : ''}`}>
        {prefix}{value.toFixed(2)}{suffix}
      </p>
      <p className={`text-xs ${c.label}`}>ج.م</p>
    </div>
  );
}
