// components/common/PaymentModal.jsx
import { toNum } from '../../pages/sales/hooks/useSaleInvoiceForm';
/**
 * موديل الدفع المشترك بين العملاء والموردين
 * Props:
 *  title, form, setForm, error, checking, balance,
 *  isEdit?, balanceLabel?, onReceiptChange, onSubmit, onClose
 */
export default function PaymentModal({
  title,
  form = {},
  setForm,
  error,
  checking,
  balance,
  isEdit = false,
  balanceLabel = 'الرصيد الحالي',
  onReceiptChange,
  onSubmit,
  onClose,
}) {
  const isMixed      = form?.paymentMethod === 'mixed';
  const afterBalance = balance - (Number(form.amount) || 0);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* رصيد حالي */}
          {balance > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex justify-between items-center">
              <span className="text-sm text-red-600">{balanceLabel}</span>
              <span className="font-bold text-red-700 text-lg">{toNum(balance).toFixed(2)} ج.م</span>
            </div>
          )}

          {/* رقم الوصل */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              رقم الوصل <span className="text-gray-400 text-xs">(اختياري)</span>
            </label>
            <input
              className={`input-field ${error ? 'border-red-500 ring-2 ring-red-100' : ''}`}
              placeholder="مثلاً: 1234 أو ORD-001"
              value={form.receiptNumber}
              onChange={e => onReceiptChange(e.target.value)}
            />
            {checking && <p className="text-xs text-gray-400 mt-1">جاري التحقق...</p>}
            {error    && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>

          {/* المبلغ */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">المبلغ *</label>
            <input
              type="number" min="0" step="0.01"
              className="input-field text-xl font-bold text-center"
              placeholder="0.00"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            />
          </div>

          {/* طريقة الدفع */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">طريقة الدفع</label>
            <select
              className="input-field"
              value={form.paymentMethod}
              onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
            >
              <option value="cash">نقدي</option>
              <option value="instapay">انستاباي</option>
              <option value="transfer">تحويل بنكي</option>
              <option value="check">شيك</option>
              <option value="mixed">نقدي + انستاباي</option>
            </select>
          </div>

          {/* مختلط */}
          {isMixed && (
            <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg">
              {[
                { key: 'cashAmount',     label: 'نقدي' },
                { key: 'instapayAmount', label: 'انستاباي' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <input
                    type="number" min="0" step="0.01"
                    className="input-field" placeholder="0.00"
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}

          {/* تاريخ الدفعة */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">تاريخ الدفعة</label>
            <input
              type="date" className="input-field"
              value={form.date || new Date().toISOString().split('T')[0]}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            />
          </div>

          {/* مرجع */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">مرجع / رقم شيك</label>
            <input
              className="input-field" placeholder="اختياري"
              value={form.reference}
              onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
            />
          </div>

          {/* ملاحظات */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">ملاحظات</label>
            <input
              className="input-field" placeholder="اختياري"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          {/* رصيد بعد الدفع */}
          {form.amount && (
            <div className={`rounded-lg p-3 flex justify-between items-center border ${
              afterBalance > 0 ? 'bg-orange-50 border-orange-100' : 'bg-green-50 border-green-100'
            }`}>
              <span className={`text-sm ${afterBalance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                الرصيد بعد الدفع
              </span>
              <span className={`font-bold text-lg ${afterBalance > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                {afterBalance.toFixed(2)} ج.م
              </span>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onSubmit} className="btn-primary flex-1 py-3">
              {isEdit ? '💾 حفظ التعديل' : '✅ تسجيل الدفع'}
            </button>
            <button onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
          </div>
        </div>
      </div>
    </div>
  );
}