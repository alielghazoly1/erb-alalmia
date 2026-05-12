// ─── pages/items/components/ItemFormModal.jsx ─────────────────────────────────
import Modal from '../../../components/common/Modal';

const UNITS = ['كرتون', 'كيلو', 'شكارة', 'طن', 'برميل', 'باكيت', 'قطعة', 'علبة', 'بستلة'];

export default function ItemFormModal({ isOpen, onClose, form, setForm, onSubmit, editingId }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingId ? 'تعديل صنف' : 'إضافة صنف جديد'}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الكود *</label>
            <input
              className="input-field"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              disabled={!!editingId}
              placeholder="مثلاً 1001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الاسم *</label>
            <input
              className="input-field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="اسم الصنف"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">التصنيف</label>
            <input
              className="input-field"
              placeholder="مكسرات، فول، ..."
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">وحدة القياس</label>
            <select
              className="input-field"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            >
              {UNITS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            الوزن الافتراضي للوحدة (كيلو)
          </label>
          <input
            type="number"
            step="0.01"
            className="input-field"
            placeholder="مثلاً 22.68"
            value={form.defaultWeight}
            onChange={(e) => setForm({ ...form, defaultWeight: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
          <textarea
            className="input-field"
            rows={2}
            value={form.notes || ''}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.isRawMaterial}
            onChange={(e) => setForm({ ...form, isRawMaterial: e.target.checked })}
            className="w-4 h-4 accent-orange-500"
          />
          <span className="text-sm text-gray-700">ده صنف خامة (للتصنيع)</span>
        </label>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary flex-1">
            {editingId ? 'حفظ التعديلات' : 'إضافة'}
          </button>
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
