// ─── components/common/InitialBalanceModal.jsx ────────────────────────────────
// موديل تعديل الرصيد الابتدائي — مشترك بين العملاء والموردين
// يقبل قيم سالبة (دائن) وموجبة (مدين)
import { useState, useEffect } from 'react';
import { toNum } from '../../utils/fmt';

export default function InitialBalanceModal({ entity, entityType = 'customer', onSave, onClose }) {
  const [value,   setValue]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (entity) {
      // يقبل القيمة الحالية (موجبة أو سالبة)
      const current = toNum(entity.openingBalance ?? entity.initialBalance);
      setValue(String(current));
    }
  }, [entity]);

  if (!entity) return null;

  const label    = entityType === 'customer' ? 'العميل' : 'المورد';
  const isNeg    = parseFloat(value) < 0;
  const isZero   = parseFloat(value) === 0;

  const handleSave = async () => {
    const num = parseFloat(value);
    if (isNaN(num)) { setError('أدخل رقماً صحيحاً'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(entity._id || entity.id, num);
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message || 'خطأ في الحفظ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-bold text-gray-800">💰 تعديل الرصيد الابتدائي</h2>
            <p className="text-sm text-gray-500 mt-0.5">{label}: {entity.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 text-xl">×</button>
        </div>

        {/* body */}
        <div className="p-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            الرصيد الابتدائي (ج.م)
            <span className="text-gray-400 text-xs mr-2">— موجب = مدين عليه | سالب = دائن له</span>
          </label>
          <input
            type="number"
            step="0.01"
            className={`input-field text-center text-xl font-bold ${
              isNeg  ? 'border-green-400 bg-green-50 text-green-700' :
              isZero ? 'border-gray-300' :
                       'border-red-300 bg-red-50 text-red-700'
            }`}
            value={value}
            onChange={e => { setValue(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            autoFocus
          />

          {/* indicator */}
          <div className="mt-2 text-center text-sm">
            {isNeg  && <span className="text-green-600 font-medium">✅ دائن — {label} له {Math.abs(parseFloat(value)||0).toFixed(2)} ج.م</span>}
            {!isNeg && !isZero && <span className="text-red-600 font-medium">⚠️ مدين — على {label} {(parseFloat(value)||0).toFixed(2)} ج.م</span>}
            {isZero && <span className="text-gray-400">لا يوجد رصيد</span>}
          </div>

          {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
        </div>

        {/* footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 btn-secondary">إلغاء</button>
          <button
            onClick={handleSave}
            disabled={saving || value === ''}
            className="flex-1 btn-primary disabled:opacity-50"
          >
            {saving ? 'جاري الحفظ...' : '✓ حفظ الرصيد'}
          </button>
        </div>
      </div>
    </div>
  );
}
