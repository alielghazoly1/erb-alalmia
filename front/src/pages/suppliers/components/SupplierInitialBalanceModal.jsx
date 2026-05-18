// ─── SupplierInitialBalanceModal.jsx ─────────────────────────────────────────
import Modal    from '../../../components/common/Modal';
import { toNum } from '../../../utils/fmt';

export default function SupplierInitialBalanceModal({ isOpen, onClose, supplier, amount, setAmount, onSubmit, submitting, seasonId }) {
  if (!supplier) return null;

  const parsed = parseFloat(amount) || 0;
  const isNeg  = parsed < 0;
  const isZero = parsed === 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="💰 الرصيد الابتدائي">
      <form onSubmit={onSubmit} className="space-y-4">

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm space-y-1">
          <p className="font-semibold text-blue-800">{supplier.name}</p>
          <p className="text-blue-600 text-xs">كود: {supplier.code}</p>
          <p className="text-blue-500 text-xs">
            الرصيد الجاري: <span className={`font-bold ${toNum(supplier.balance) > 0 ? 'text-red-600' : 'text-blue-600'}`}>
              {Math.abs(toNum(supplier.balance)).toFixed(2)} ج.م
              {toNum(supplier.balance) > 0 ? ' (مستحق للمورد)' : toNum(supplier.balance) < 0 ? ' (مستحق لنا)' : ''}
            </span>
          </p>
          {!seasonId && (
            <p className="text-red-500 text-xs font-medium">⚠️ لا يوجد موسم محدد — اختر موسماً أولاً</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            الرصيد الابتدائي (ج.م)
            <span className="text-gray-400 text-xs mr-2">موجب = مستحق للمورد | سالب = دفعنا زيادة</span>
          </label>
          <input
            type="number" step="0.01"
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
          <p className="text-center text-xs mt-1">
            {isNeg  && <span className="text-blue-600">✅ مستحق لنا {Math.abs(parsed).toFixed(2)} ج.م</span>}
            {!isNeg && !isZero && <span className="text-red-600">⚠️ مستحق للمورد {parsed.toFixed(2)} ج.م</span>}
            {isZero && <span className="text-gray-400">لا يوجد رصيد ابتدائي</span>}
          </p>
        </div>

        <div className="flex gap-3 pt-1">
          <button type="submit" className="btn-primary flex-1"
            disabled={submitting || amount === '' || !seasonId}>
            {submitting ? 'جاري الحفظ...' : '✓ حفظ الرصيد'}
          </button>
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>إلغاء</button>
        </div>
      </form>
    </Modal>
  );
}
