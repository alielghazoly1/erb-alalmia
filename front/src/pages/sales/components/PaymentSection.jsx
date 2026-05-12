import { PAYMENT_METHODS } from '../hooks/useSaleInvoiceForm';

export default function PaymentSection({
  isCash, isMixed, paymentMethod, cashAmount, instapayAmount,
  totalAmount, paidAmount, remaining,
  onMethodChange, onCashChange, onInstapayChange,
  customer,
}) {
  if (!customer) return null;

  // عميل آجل
  if (!isCash) {
    return (
      <div className="mb-4 pb-4 border-b border-gray-100">
        <div className="px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg inline-block">
          <p className="text-xs text-blue-600">📋 فاتورة آجل — ستضاف لكشف حساب العميل</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 pb-4 border-b border-gray-100 p-3 bg-green-50 rounded-xl">
      <p className="text-xs font-semibold text-green-700 mb-2 uppercase tracking-wide">💵 دفع نقدي</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {/* طريقة الدفع */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">طريقة الدفع</label>
          <select className="input-field" value={paymentMethod}
            onChange={e => { onMethodChange(e.target.value); }}>
            {PAYMENT_METHODS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {isMixed ? (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">نقدي</label>
              <input type="number" min="0" step="0.01" className="input-field" placeholder="0.00"
                value={cashAmount} onChange={e => onCashChange(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">انستاباي</label>
              <input type="number" min="0" step="0.01" className="input-field" placeholder="0.00"
                value={instapayAmount} onChange={e => onInstapayChange(e.target.value)} />
            </div>
          </>
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              {paymentMethod === 'instapay' ? 'المبلغ (انستاباي)'
               : paymentMethod === 'transfer' ? 'المبلغ (تحويل)'
               : paymentMethod === 'check'    ? 'المبلغ (شيك)'
               : 'المبلغ المدفوع'}
            </label>
            <input type="number" min="0" step="0.01" className="input-field"
              placeholder={totalAmount.toFixed(2)}
              value={cashAmount} onChange={e => onCashChange(e.target.value)} />
          </div>
        )}
      </div>
    </div>
  );
}
