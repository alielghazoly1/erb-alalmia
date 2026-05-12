export default function CustomerBalanceCard({ customer, balance }) {
  if (!customer || !balance) return null;
  return (
    <div className="w-64 shrink-0">
      <div className="card sticky top-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-2 border-b">
          📋 حساب {customer?.name}
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">إجمالي المبيعات</span>
            <span className="font-medium">{balance.totalSales?.toFixed(2)}</span>
          </div>
          {balance.totalReturns > 0 && (
            <div className="flex justify-between text-orange-600">
              <span>المرتجعات</span>
              <span>- {balance.totalReturns?.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-green-600">
            <span>المدفوع</span>
            <span>- {balance.totalPaid?.toFixed(2)}</span>
          </div>
          <div className={`flex justify-between font-bold text-base pt-2 border-t ${balance.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
            <span>الرصيد</span>
            <span>{balance.balance?.toFixed(2)} ج.م</span>
          </div>
        </div>
        {balance.balance > 0 && (
          <div className="mt-3 p-2 bg-red-50 border border-red-100 rounded-lg text-center">
            <p className="text-xs text-red-600 font-medium">
              ⚠️ على العميل {balance.balance?.toFixed(2)} ج.م
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
