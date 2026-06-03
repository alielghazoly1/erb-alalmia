// ─── MfgItemInputRow.jsx ──────────────────────────────────────────────────────
// ✅ ARCH-001: موحَّد مع InvoiceItemsForm — نفس الترتيب والمنطق
//
// Layout محسّن:
//   سطر 1: [صنف (flex)] [عدد]
//   سطر 2: [وزن/وحدة readonly] [وزن كلي *] [زر]
//
// ✅ نتايج البحث فوق (في ItemSearch)
// ✅ وزن/وحدة readonly — ثابت من الصنف
// ✅ وزن كلي تحت سطر الصنف والعدد
// ✅ Enter ينقل للخانة الجاية
// ─────────────────────────────────────────────────────────────────────────────

import { memo } from 'react';
import ItemSearch from '../../../components/common/ItemSearch';
import { calcTotalWeight, fmtW } from '../hooks/useManufacturingItems';

const fmt4 = (v) => {
  const n = parseFloat(v);
  if (isNaN(n) || Math.abs(n) < 1e-10) return '0';
  return parseFloat(n.toFixed(4)).toString();
};

const MfgItemInputRow = memo(function MfgItemInputRow({
  row, totalWeightInput, checkStock,
  itemRefs, qtyRefs, wtRefs, twRefs,
  onItemSelect,
  onQuantityChange, onUnitWeightChange, onTotalWeightChange,
  onUpdateRow,
  onKeyDown, onSaveRow, onCancelRow,
}) {
  const _onQty = onQuantityChange ?? ((rowId, v) => onUpdateRow?.(rowId, 'quantity', v));

  const twInputVal = totalWeightInput[row.id] || '';
  const tw         = calcTotalWeight(row, twInputVal || null);
  const uw         = parseFloat(row.unitWeight) || 0;
  const hasTw      = parseFloat(twInputVal) > 0;

  const displayQty = uw > 0 && tw > 0 ? fmt4(tw / uw) : '';

  const awt  = row.availableWeight !== undefined ? parseFloat(row.availableWeight) : null;
  const over = awt !== null && tw > awt && awt >= 0;

  return (
    <div className={`
      rounded-xl border-2 p-3
      sticky bottom-0 z-10 bg-white
      shadow-[0_-4px_16px_rgba(0,0,0,0.08)]
      ${row.editing ? 'border-amber-400 bg-amber-50/95' :
        over        ? 'border-orange-300 bg-orange-50/95' :
                      'border-green-200 bg-green-50/95'}
    `}>

      <p className="text-xs font-semibold text-gray-500 mb-2">
        {row.editing ? '✏️ تعديل صنف' : '➕ أضف صنف'}
      </p>

      {/* رصيد المخزون */}
      {checkStock && awt !== null && (
        <p className={`text-xs mb-2 font-medium ${
          awt <= 0 ? 'text-red-500' : over ? 'text-orange-600' : 'text-green-600'
        }`}>
          {awt <= 0 ? '🔴' : over ? '⚠️' : '🟢'}
          {awt <= 0
            ? ` لا يوجد رصيد (${fmtW(awt)} ك)`
            : over
              ? ` متاح: ${fmtW(awt)} ك — يتجاوز بـ ${fmtW(tw - awt)} ك`
              : ` متاح: ${fmtW(awt)} ك (${fmt4(uw > 0 ? awt / uw : 0)} كرتون)`}
        </p>
      )}

      {/* ── سطر 1: الصنف + العدد ── */}
      <div className="flex gap-2 mb-2 items-end">

        {/* الصنف */}
        <div className="flex-1 min-w-0">
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

        {/* العدد */}
        <div className="w-24 shrink-0">
          <label className="block text-xs font-medium text-gray-500 mb-1">العدد</label>
          <input
            ref={el => (qtyRefs.current[row.id] = el)}
            type="number" min="0" step="any"
            className="input-field text-center"
            placeholder="0"
            value={row.quantity}
            onChange={e => _onQty(row.id, e.target.value)}
            onKeyDown={e => onKeyDown(e, row.id, 'quantity')}
          />
        </div>
      </div>

      {/* ── سطر 2: وزن/وحدة (readonly) + وزن كلي + زر ── */}
      <div className="flex gap-2 items-end">

        {/* وزن/وحدة — readonly ثابت */}
        <div className="w-28 shrink-0">
          <label className="block text-xs font-medium text-gray-400 mb-1">
            وزن/وحدة
            <span className="text-gray-300 mr-1 font-normal text-[10px]">(ثابت)</span>
          </label>
          <input
            type="number"
            className="input-field text-center bg-gray-50 text-gray-400 cursor-not-allowed select-none opacity-70"
            placeholder="0.000"
            value={row.unitWeight || ''}
            disabled
            tabIndex={-1}
          />
        </div>

        {/* الوزن الكلي */}
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-medium text-blue-600 mb-1">
            الوزن الكلي (ك) *
          </label>
          <input
            ref={el => (twRefs.current[row.id] = el)}
            type="number" min="0" step="any"
            className={`input-field text-center font-bold text-base border-2 ${
              over  ? 'bg-red-50 border-red-300' :
              hasTw ? 'border-blue-400 bg-blue-50' :
                      'border-blue-200'
            }`}
            placeholder="0.000"
            value={twInputVal}
            onChange={e => onTotalWeightChange(row.id, e.target.value)}
            onKeyDown={e => onKeyDown(e, row.id, 'totalWeight')}
          />
          {displayQty && (
            <p className="text-xs text-gray-500 mt-0.5 text-center">= {displayQty} كرتون</p>
          )}
        </div>

        {/* زر الإضافة */}
        <div className="shrink-0 flex flex-col gap-1">
          <button
            onClick={() => onSaveRow(row.id)}
            disabled={!row.item || !row.unitWeight}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              over ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'btn-primary'
            }`}
            title={over ? 'تحذير: يتجاوز الرصيد المتاح' : ''}
          >
            {row.editing ? '✓ حفظ' : '＋ أضف'}
          </button>
          {row.editing && (
            <button
              onClick={() => onCancelRow(row.id)}
              className="px-4 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-100 text-center"
            >
              إلغاء
            </button>
          )}
        </div>
      </div>

      {/* ملخص */}
      {tw > 0 && (
        <div className="mt-2 flex items-center gap-3 text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
          <span>📦 وزن كلي: <strong>{fmtW(tw)} ك</strong></span>
          {uw > 0 && <span>| عدد: <strong>{fmt4(tw / uw)} كرتون</strong></span>}
        </div>
      )}
    </div>
  );
});

export default MfgItemInputRow;
