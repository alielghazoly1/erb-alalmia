// ─── PaymentSection.jsx ───────────────────────────────────────────────────────
// ✅ FIX-PAY-001: تحذير مرئي لما المبلغ المدفوع لا يساوي الإجمالي
// ✅ FIX-CREDIT-001: عرض شارة "آجل" واضحة للعميل الآجل
// ─────────────────────────────────────────────────────────────────────────────
import { PAYMENT_METHODS } from '../hooks/useSaleInvoiceForm';

const r2 = (v) => Math.round((parseFloat(v) || 0) * 100) / 100;

export default function PaymentSection({
  isCash, isMixed, paymentMethod, cashAmount, instapayAmount,
  totalAmount, paidAmount, remaining,
  onMethodChange, onCashChange, onInstapayChange,
  customer,
}) {
  if (!customer) return null;

  // ── عميل آجل ─────────────────────────────────────────────────────────────
  if (!isCash) {
    return (
      <div className="mb-4 pb-4 border-b border-gray-100">
        <div className="px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg inline-block">
          <p className="text-xs text-blue-600">📋 فاتورة آجل — ستضاف لكشف حساب العميل</p>
        </div>
      </div>
    );
  }

  // ✅ حساب الفرق لإظهار تحذير لو المبلغ مختلف
  const eps = 0.01;
  let effectivePaid = 0;
  let paymentMismatch = false;

  if (totalAmount > 0) {
    if (isMixed) {
      effectivePaid = r2((parseFloat(cashAmount) || 0) + (parseFloat(instapayAmount) || 0));
    } else if (paymentMethod !== 'credit') {
      effectivePaid = r2(parseFloat(cashAmount) || parseFloat(instapayAmount) || 0);
    }
    paymentMismatch = Math.abs(effectivePaid - totalAmount) > eps;
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
            <input
              type="number" min="0" step="0.01"
              className={`input-field ${paymentMismatch ? 'border-red-400 ring-2 ring-red-100 bg-red-50' : ''}`}
              placeholder={totalAmount.toFixed(2)}
              value={cashAmount} onChange={e => onCashChange(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* ✅ تحذير مرئي لما المبلغ مختلف عن الإجمالي */}
      {paymentMismatch && totalAmount > 0 && (
        <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          <span className="text-red-500 text-base">⚠️</span>
          <p className="text-xs text-red-600 font-medium">
            المبلغ المدفوع ({effectivePaid.toFixed(2)}) لا يساوي إجمالي الفاتورة ({r2(totalAmount).toFixed(2)}) — يجب أن يكون مساوياً تماماً للمبيعات النقدية
          </p>
        </div>
      )}

      {/* ✅ تأكيد أخضر لما المبلغ مضبوط */}
      {!paymentMismatch && effectivePaid > 0 && totalAmount > 0 && (
        <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-green-100 border border-green-200 rounded-lg">
          <span className="text-green-600 text-base">✅</span>
          <p className="text-xs text-green-700 font-medium">المبلغ المدفوع مطابق للإجمالي</p>
        </div>
      )}
    </div>
  );
}
