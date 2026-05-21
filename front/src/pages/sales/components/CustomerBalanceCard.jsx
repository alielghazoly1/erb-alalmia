// ─── CustomerBalanceCard.jsx ──────────────────────────────────────────────────
// ✅ FIX-CREDIT-001: عرض رصيد أول المدة + رسالة واضحة لما الرصيد مش متاح بعد
// ─────────────────────────────────────────────────────────────────────────────
import { toNum } from '../../../utils/fmt';

const Row = ({ label, value, color = 'gray', prefix = '' }) => (
  <div className={`flex justify-between text-sm ${color}`}>
    <span className="text-gray-500">{label}</span>
    <span className="font-medium">{prefix}{toNum(value).toFixed(2)}</span>
  </div>
);

export default function CustomerBalanceCard({ customer, balance }) {
  if (!customer) return null;

  // لو لسه بيتحمل الرصيد
  if (!balance) {
    return (
      <div className="w-64 shrink-0">
        <div className="card sticky top-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">
            📋 حساب {customer?.name}
          </h3>
          <div className="flex items-center gap-2 text-gray-400 text-sm py-4 justify-center">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            جاري تحميل الرصيد...
          </div>
        </div>
      </div>
    );
  }

  const bal        = toNum(balance.balance);
  const hasOpening = toNum(balance.openingBalance) !== 0;

  return (
    <div className="w-64 shrink-0">
      <div className="card sticky top-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">
          📋 حساب {customer?.name}
        </h3>
        <div className="space-y-2">
          {hasOpening && (
            <Row label="رصيد أول المدة" value={balance.openingBalance} color="text-gray-600" />
          )}
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
        {bal <= 0 && bal < 0 && (
          <div className="mt-3 p-2 bg-green-50 border border-green-100 rounded-lg text-center">
            <p className="text-xs text-green-700 font-medium">
              ✅ رصيد دائن: {Math.abs(bal).toFixed(2)} ج.م
            </p>
          </div>
        )}
        {bal === 0 && (
          <div className="mt-3 p-2 bg-gray-50 border border-gray-100 rounded-lg text-center">
            <p className="text-xs text-gray-500 font-medium">✔ حساب متوازن</p>
          </div>
        )}
      </div>
    </div>
  );
}
