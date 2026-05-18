// ─── front/src/components/items/ItemFormModal.jsx ────────────────────────────
// نموذج إضافة/تعديل صنف — معالجة آمنة للقيم العشرية (Decimal)
// ✅ UPDATED: All numeric inputs use parseDecimalFromInput() + formatQty()
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { parseDecimalFromInput, formatQty, formatPrice } from '../../utils/decimalHelper';

const UNITS = ['كرتون', 'قطعة', 'كيلو', 'لتر', 'متر', 'علبة', 'شكارة', 'طن'];

const ItemFormModal = ({ item, onClose, onSave, isLoading }) => {
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: '',
    unit: 'كرتون',
    defaultWeight: 0,
    lastPurchasePrice: 0,
    lastSalePrice: 0,
    minStockQty: 0,
    isRawMaterial: false,
    notes: '',
  });

  useEffect(() => {
    if (item) {
      setFormData({
        code: item.code || '',
        name: item.name || '',
        category: item.category || '',
        unit: item.unit || 'كرتون',
        defaultWeight: item.defaultWeight || 0,
        lastPurchasePrice: item.lastPurchasePrice || 0,
        lastSalePrice: item.lastSalePrice || 0,
        minStockQty: item.minStockQty || 0,
        isRawMaterial: item.isRawMaterial || false,
        notes: item.notes || '',
      });
    }
  }, [item]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // ✅ Decimal-safe: handle numeric input changes
  const handleNumericChange = (field, value) => {
    const parsed = parseDecimalFromInput(value);
    setFormData(prev => ({ ...prev, [field]: parsed }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      alert('كود واسم الصنف مطلوبان');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">
            {item ? 'تعديل صنف' : 'إضافة صنف جديد'}
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium mb-1">الكود *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => handleChange('code', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1">الاسم *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium mb-1">التصنيف</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              {/* Unit */}
              <div>
                <label className="block text-sm font-medium mb-1">الوحدة</label>
                <select
                  value={formData.unit}
                  onChange={(e) => handleChange('unit', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                >
                  {UNITS.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>

              {/* Default Weight */}
              <div>
                <label className="block text-sm font-medium mb-1">الوزن الافتراضي</label>
                <input
                  type="number"
                  step="0.001"
                  value={formData.defaultWeight}
                  onChange={(e) => handleNumericChange('defaultWeight', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
                <span className="text-xs text-gray-500">{formatQty(formData.defaultWeight)}</span>
              </div>

              {/* Min Stock Qty */}
              <div>
                <label className="block text-sm font-medium mb-1">الحد الأدنى للمخزون</label>
                <input
                  type="number"
                  step="0.001"
                  value={formData.minStockQty}
                  onChange={(e) => handleNumericChange('minStockQty', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
                <span className="text-xs text-gray-500">{formatQty(formData.minStockQty)}</span>
              </div>

              {/* Last Purchase Price */}
              <div>
                <label className="block text-sm font-medium mb-1">آخر سعر شراء</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.lastPurchasePrice}
                  onChange={(e) => handleNumericChange('lastPurchasePrice', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
                <span className="text-xs text-gray-500">{formatPrice(formData.lastPurchasePrice)}</span>
              </div>

              {/* Last Sale Price */}
              <div>
                <label className="block text-sm font-medium mb-1">آخر سعر بيع</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.lastSalePrice}
                  onChange={(e) => handleNumericChange('lastSalePrice', e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
                <span className="text-xs text-gray-500">{formatPrice(formData.lastSalePrice)}</span>
              </div>

              {/* Is Raw Material */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isRawMaterial"
                  checked={formData.isRawMaterial}
                  onChange={(e) => handleChange('isRawMaterial', e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="isRawMaterial" className="text-sm">خامة تصنيع</label>
              </div>
            </div>

            {/* Notes */}
            <div className="mt-4">
              <label className="block text-sm font-medium mb-1">ملاحظات</label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                className="w-full border rounded px-3 py-2"
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded hover:bg-gray-100"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {isLoading ? 'جاري الحفظ...' : (item ? 'تحديث' : 'حفظ')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ItemFormModal;
