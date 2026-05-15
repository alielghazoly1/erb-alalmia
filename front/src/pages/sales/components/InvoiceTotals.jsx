// ─── InvoiceTotals.jsx ────────────────────────────────────────────────────────
const r2 = (v) => Math.round((parseFloat(v) || 0) * 100) / 100;
const r3 = (v) => Math.round((parseFloat(v) || 0) * 1000) / 1000;

export default function InvoiceTotals({
  savedRows, totalAmount, totalWeightAll,
  isCash, isMixed, paymentMethod,
  cashAmount, instapayAmount, paidAmount, remaining,
}) {
  if (!savedRows?.length) return null;

  return (
    <div className="card">
      <div className="flex justify-between items-end">
        <div className="text-sm text-gray-500 space-y-1">
          <p>عدد الأصناف: <span className="font-medium text-gray-700">{savedRows.length}</span></p>
          <p>إجمالي الوزن: <span className="font-medium text-gray-700">{r3(totalWeightAll).toFixed(3)} كيلو</span></p>
        </div>
        <div className="text-left space-y-1 min-w-52">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">إجمالي الفاتورة</span>
            <span className="font-bold text-gray-800">{r2(totalAmount).toFixed(2)} ج.م</span>
          </div>
          {isCash && paymentMethod !== 'credit' && (
            <>
              {isMixed && (
                <>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>نقدي</span>
                    <span>{r2(cashAmount).toFixed(2)} ج.م</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>انستاباي</span>
                    <span>{r2(instapayAmount).toFixed(2)} ج.م</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">المدفوع</span>
                <span className="font-bold text-green-600">{r2(paidAmount).toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between text-base border-t pt-1">
                <span className="font-semibold text-gray-700">الباقي</span>
                <span className={`font-bold text-xl ${r2(remaining) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {r2(remaining).toFixed(2)} ج.م
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
