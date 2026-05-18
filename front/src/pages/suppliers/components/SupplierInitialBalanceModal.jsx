// ─── SupplierInitialBalanceModal.jsx ─────────────────────────────────────────
// موديل تعديل الرصيد الابتدائي لمورد موجود — الأدمن فقط
// يقبل قيم سالبة (دفعنا زيادة) وموجبة (عليهم فلوس)
import Modal from '../../../components/common/Modal';
import { toNum } from '../../../utils/fmt';

export default function SupplierInitialBalanceModal({
  isOpen, onClose,
  supplier,
  amount, setAmount,
  onSubmit, submitting,
}) {
  if (!supplier) return null;

  const parsed  = parseFloat(amount) || 0;
  const isNeg   = parsed < 0;
  const isZero  = parsed === 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`💰 الرصيد الابتدائي — ${supplier.name}`}>
      <form onSubmit={onSubmit} className="space-y-4">

        {/* معلومات المورد */}
        <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>الكود:</span>
            <span className="font-mono font-medium text-gray-800">{supplier.code}</span>
          </div>
          <div className="flex justify-between">
            <span>الرصيد الجاري:</span>
            <span className={`font-bold ${toNum(supplier.balance) > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {Math.abs(toNum(supplier.balance)).toFixed(2)} ج.م
              <span className="text-xs mr-1 font-normal">
                {toNum(supplier.balance) > 0 ? '(مستحق للمورد)' : toNum(supplier.balance) < 0 ? '(مستحق لنا)' : ''}
              </span>
            </span>
          </div>
        </div>

        {/* المبلغ الجديد */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            الرصيد الابتدائي (ج.م)
            <span className="text-gray-400 text-xs mr-2">— موجب = مستحق للمورد | سالب = دفعنا زيادة</span>
          </label>
          <input
            type="number"
            step="0.01"
            className={`input-field text-center text-xl font-bold ${
              isNeg  ? 'border-blue-400 bg-blue-50 text-blue-700' :
              isZero ? 'border-gray-300' :
                       'border-red-300 bg-red-50 text-red-700'
            }`}
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            autoFocus
          />
          <div className="mt-1.5 text-center text-xs">
            {isNeg  && <span className="text-blue-600">✅ دفعنا زيادة — مستحق لنا {Math.abs(parsed).toFixed(2)} ج.م</span>}
            {!isNeg && !isZero && <span className="text-red-600">⚠️ مستحق للمورد {parsed.toFixed(2)} ج.م</span>}
            {isZero && <span className="text-gray-400">لا يوجد رصيد ابتدائي</span>}
          </div>
        </div>

        {/* أزرار */}
        <div className="flex gap-3 pt-1">
          <button type="submit" className="btn-primary flex-1" disabled={submitting || amount === ''}>
            {submitting ? 'جاري الحفظ...' : '✓ حفظ الرصيد'}
          </button>
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
