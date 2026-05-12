import { memo } from 'react';
import ItemSearch from '../../../components/common/ItemSearch';
import { calcTotalWeight, fmtW } from '../hooks/useManufacturingItems';

/**
 * MfgItemInputRow
 * ───────────────
 * نفس بالضبط ItemInputRow في فاتورة المبيعات:
 *  - sticky bottom-0 داخل الـ card
 *  - Enter ينتقل: صنف → كراتين → وزن/كرتون → وزن كلي → إضافة
 *  - الوزن الكلي اليدوي يحسب الكراتين (reverse)
 *  - بدون السعر (مش محتاجينه في التصنيع)
 */
const MfgItemInputRow = memo(function MfgItemInputRow({
  row, totalWeightInput, checkStock,
  itemRefs, qtyRefs, wtRefs, twRefs,
  onItemSelect, onUpdateRow, onTotalWeightChange,
  onKeyDown, onSaveRow, onCancelRow,
}) {
  const tw       = calcTotalWeight(row);
  const isManual = row.totalWeightManual !== '' && row.totalWeightManual !== undefined;

  return (
    <div className={`
      rounded-xl border-2 p-3
      sticky bottom-0 z-10 bg-white
      shadow-[0_-4px_16px_rgba(0,0,0,0.08)]
      ${row.editing
        ? 'border-amber-400 bg-amber-50/95'
        : 'border-green-200 bg-green-50/95'}
    `}>
      {/* صنف محدد */}
      {row.itemName && (
        <p className="text-xs text-green-700 font-semibold mb-0.5 truncate">✓ {row.itemName}</p>
      )}

      {/* تحذير المخزون */}
      {checkStock && row.availableQty !== undefined && (
        <p className={`text-xs mb-1 ${
          row.availableQty <= 0
            ? 'text-red-500'
            : row.availableQty <= 5
              ? 'text-amber-600'
              : 'text-green-600'
        }`}>
          {row.availableQty <= 0 ? '🔴' : row.availableQty <= 5 ? '🟡' : '🟢'}
          {row.availableQty <= 0
            ? ` سيُصرف بالسالب (${row.availableQty} كرتون)`
            : ` متاح: ${row.availableQty} كرتون`}
        </p>
      )}

      <p className="text-xs font-semibold text-gray-500 mb-2">
        {row.editing ? '✏️ تعديل صنف' : '➕ أضف صنف'}
      </p>

      {/* الحقول الرئيسية */}
      <div className="grid grid-cols-12 gap-2 items-end">

        {/* الصنف */}
        <div className="col-span-5">
          <label className="block text-xs font-medium text-gray-500 mb-1">الصنف *</label>
          <ItemSearch
            onSelect={item => onItemSelect(row.id, item)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); qtyRefs.current[row.id]?.focus(); }
            }}
            placeholder="ابحث بالكود أو الاسم..."
            getFocusTrigger={fn => { itemRefs.current[row.id] = fn; }}
            defaultValue={row.editing ? row.itemName : ''}
          />
        </div>

        {/* الكراتين */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            الكراتين
            {row.weight && (
              <span className="text-blue-400 mr-1">×{parseFloat(row.weight).toFixed(2)}ك</span>
            )}
          </label>
          <input
            ref={el => (qtyRefs.current[row.id] = el)}
            type="number" min="0" step="0.001"
            className="input-field text-center font-bold text-base"
            placeholder="0"
            value={row.quantity}
            onChange={e => onUpdateRow(row.id, 'quantity', e.target.value)}
            onKeyDown={e => onKeyDown(e, row.id, 'quantity')}
          />
        </div>

        {/* وزن/كرتون */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            وزن/كرتون
            {isManual && <span className="text-gray-300 mr-1">(مُعطَّل)</span>}
          </label>
          <input
            ref={el => (wtRefs.current[row.id] = el)}
            type="number" min="0" step="0.001"
            className={`input-field text-center ${isManual ? 'opacity-40' : ''}`}
            placeholder="0.000"
            value={row.weight}
            onChange={e => onUpdateRow(row.id, 'weight', e.target.value)}
            onKeyDown={e => onKeyDown(e, row.id, 'weight')}
          />
        </div>

        {/* الوزن الكلي المحسوب */}
        <div className="col-span-2 flex flex-col items-center gap-0.5">
          <p className="text-xs text-gray-400">الوزن الكلي</p>
          <p className={`text-sm font-bold leading-tight ${
            tw > 0
              ? isManual ? 'text-blue-600' : 'text-green-600'
              : 'text-gray-300'
          }`}>
            {tw > 0 ? `${fmtW(tw)} ك` : '—'}
          </p>
          {isManual && (
            <span className="text-xs text-blue-400 leading-none">يدوي</span>
          )}
        </div>

        {/* زر الإضافة */}
        <div className="col-span-1 flex flex-col gap-1">
          <button
            onClick={() => onSaveRow(row.id)}
            className="btn-primary px-2 py-2 text-sm"
            disabled={!row.item || !row.quantity || (!row.weight && !row.totalWeightManual)}
          >
            {row.editing ? '✓' : '✓ أضف'}
          </button>
          {row.editing && (
            <button
              onClick={() => onCancelRow(row.id)}
              className="btn-secondary px-2 py-1 text-xs"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* الوزن الكلي اليدوي — يحسب الكراتين تلقائياً (reverse) */}
      <div className="flex items-center gap-2 mt-2">
        <div className="flex-1">
          <input
            ref={el => (twRefs.current[row.id] = el)}
            type="number" min="0" step="0.001"
            className="input-field text-center text-xs bg-blue-50/60 py-1.5"
            placeholder="أو أدخل الوزن الكلي (يحسب الكراتين تلقائياً)"
            value={totalWeightInput[row.id] || ''}
            onChange={e => onTotalWeightChange(row.id, e.target.value)}
            onKeyDown={e => onKeyDown(e, row.id, 'totalWeight')}
            title="لو عندك الوزن الكلي مباشرة اكتبه هنا، هيحسب الكراتين تلقائياً"
          />
        </div>

        {/* معلومة الحساب العكسي */}
        {isManual && row.weight && (
          <div className="text-xs text-blue-500 bg-blue-50 px-2 py-1 rounded-lg whitespace-nowrap">
            ≈ {fmtW((parseFloat(totalWeightInput[row.id]) || 0) / (parseFloat(row.weight) || 1), 2)} كرتون
          </div>
        )}
      </div>
    </div>
  );
});

export default MfgItemInputRow;
