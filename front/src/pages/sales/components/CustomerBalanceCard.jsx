// ─── CustomerBalanceCard.jsx ──────────────────────────────────────────────────
import { toNum } from '../../../utils/fmt';

const Row = ({ label, value, color = 'gray', prefix = '' }) => (
  <div className={`flex justify-between text-sm ${color}`}>
    <span className="text-gray-500">{label}</span>
    <span className="font-medium">{prefix}{toNum(value).toFixed(2)}</span>
  </div>
);

export default function CustomerBalanceCard({ customer, balance }) {
  if (!customer || !balance) return null;

  const bal = toNum(balance.balance);

  return (
    <div className="w-64 shrink-0">
      <div className="card sticky top-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">
          📋 حساب {customer?.name}
        </h3>
        <div className="space-y-2">
          <Row label="إجمالي المبيعات" value={balance.totalSales} />
          {toNum(balance.totalReturns) > 0 && (
            <Row label="المرتجعات" value={balance.totalReturns} prefix="- " color="text-orange-600" />
          )}
          <Row label="المدفوع" value={balance.totalPaid} prefix="- " color="text-green-600" />
          <div className={`flex justify-between font-bold text-base pt-2 border-t ${bal > 0 ? 'text-red-600' : 'text-green-600'}`}>
            <span>الرصيد</span>
            <span>{bal.toFixed(2)} ج.م</span>
          </div>
        </div>
        {bal > 0 && (
          <div className="mt-3 p-2 bg-red-50 border border-red-100 rounded-lg text-center">
            <p className="text-xs text-red-600 font-medium">
              ⚠️ على العميل {bal.toFixed(2)} ج.م
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
