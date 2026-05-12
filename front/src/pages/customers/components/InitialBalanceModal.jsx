// ─── InitialBalanceModal.jsx ──────────────────────────────────────────────────
// موديل مستقل لتعديل الرصيد الابتدائي لعميل موجود
// يُسمح بالتعديل في أي وقت بعد الإضافة — الأدمن فقط
// ────────────────────────────────────────────────────────────────────────────
import Modal from '../../../components/common/Modal';
import { fmt } from '../customerUtils';

export default function InitialBalanceModal({
  isOpen, onClose,
  customer,
  amount, setAmount,
  onSubmit,
  submitting,
}) {
  if (!customer) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`تعديل الرصيد الابتدائي — ${customer.name}`}
    >
      <form onSubmit={onSubmit} className="space-y-4">

        {/* ── معلومات العميل ── */}
        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>الكود:</span>
            <span className="font-mono font-medium text-gray-800">{customer.code}</span>
          </div>
          <div className="flex justify-between">
            <span>الرصيد الحالي:</span>
            <span className={`font-bold ${customer.balance > 0 ? 'text-red-600' : 'text-gray-600'}`}>
              {fmt(customer.balance)} ج.م
            </span>
          </div>
        </div>

        {/* ── المبلغ الجديد ── */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            الرصيد الابتدائي الجديد
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input-field"
            placeholder="0.00 ج.م"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
          <p className="text-xs text-gray-400 mt-1">
            ⚙️ سيتم تعديل فاتورة الرصيد الابتدائي المسجلة مسبقاً
          </p>
        </div>

        {/* ── أزرار ── */}
        <div className="flex gap-3 pt-1">
          <button type="submit" className="btn-primary flex-1" disabled={submitting}>
            {submitting ? 'جاري الحفظ...' : 'حفظ التعديل'}
          </button>
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            إلغاء
          </button>
        </div>

      </form>
    </Modal>
  );
}
