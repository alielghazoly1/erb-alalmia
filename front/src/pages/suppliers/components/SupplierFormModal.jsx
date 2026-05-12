// ─── components/SupplierFormModal.jsx ────────────────────────────────────────
// موديل الإضافة والتعديل — يستقبل كل البيانات من الـ hook
// ────────────────────────────────────────────────────────────────────────────
import Modal from '../../../components/common/Modal';

export default function SupplierFormModal({
  isOpen, onClose,
  editingId,
  form, setField,
  onSubmit,
  submitting,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingId ? 'تعديل مورد' : 'إضافة مورد جديد'}
    >
      <form onSubmit={onSubmit} className="space-y-4">

        {/* ── الكود + الاسم ── */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="الكود *">
            <input
              className="input-field"
              value={form.code}
              onChange={(e) => setField('code', e.target.value)}
              disabled={!!editingId}
              required
            />
          </Field>
          <Field label="الاسم *">
            <input
              className="input-field"
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              required
            />
          </Field>
        </div>

        {/* ── التليفون ── */}
        <Field label="التليفون">
          <input
            className="input-field"
            value={form.phone || ''}
            onChange={(e) => setField('phone', e.target.value)}
          />
        </Field>

        {/* ── العنوان ── */}
        <Field label="العنوان">
          <input
            className="input-field"
            value={form.address || ''}
            onChange={(e) => setField('address', e.target.value)}
          />
        </Field>

        {/* ── الرصيد الابتدائي — يظهر فقط عند الإضافة ── */}
        {!editingId && (
          <Field label="رصيد ابتدائي (اختياري)" hint="لو على المورد رصيد قديم قبل البدء">
            <input
              type="number"
              min="0"
              step="0.01"
              className="input-field"
              placeholder="0.00 ج.م"
              value={form.initialBalance}
              onChange={(e) => setField('initialBalance', e.target.value)}
            />
            {Number(form.initialBalance) > 0 && (
              <p className="text-xs text-amber-600 mt-1">
                ⚠️ سيتم تسجيل {Number(form.initialBalance).toFixed(2)} ج.م كرصيد ابتدائي
              </p>
            )}
          </Field>
        )}

        {/* ── ملاحظات ── */}
        <Field label="ملاحظات">
          <textarea
            className="input-field"
            rows={2}
            value={form.notes || ''}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </Field>

        {/* ── المورد عميل أيضاً ── */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isCustomer}
            onChange={(e) => setField('isCustomer', e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm text-gray-700">المورد ده عميل أيضاً</span>
        </label>

        {/* ── أزرار ── */}
        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary flex-1" disabled={submitting}>
            {submitting ? 'جاري الحفظ...' : editingId ? 'حفظ التعديلات' : 'إضافة'}
          </button>
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            إلغاء
          </button>
        </div>

      </form>
    </Modal>
  );
}

// ─── مكوّن مساعد ─────────────────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {hint && <span className="text-gray-400 text-xs font-normal mr-2">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}
