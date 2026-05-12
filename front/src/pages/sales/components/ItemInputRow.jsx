import { memo } from 'react';
import ItemSearch from '../../../components/common/ItemSearch';
import { calcTotal } from '../hooks/useSaleInvoiceForm';

const ItemInputRow = memo(function ItemInputRow({
  row, totalWeightInput,
  itemRefs, qtyRefs, wtRefs, prRefs,
  onItemSelect, onUpdateRow, onTotalWeightChange,
  onKeyDown, onSaveRow, onCancelRow,
}) {
  return (
    <div className={`rounded-xl border-2 p-3 sticky bottom-0 z-10 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.08)] ${row.editing ? 'border-amber-400 bg-amber-50/95' : 'border-green-200 bg-green-50/95'}`}>
      {row.itemName && (
        <p className="text-xs text-green-600 mt-0.5 font-medium truncate">✓ {row.itemName}</p>
      )}
      {row.availableQty !== undefined && (
        <p className={`text-xs mt-0.5 ${row.availableQty <= 0 ? 'text-orange-500' : row.availableQty <= 5 ? 'text-amber-600' : 'text-green-600'}`}>
          {row.availableQty <= 0 ? '⚠️' : row.availableQty <= 5 ? '🟡' : '🟢'}{' '}
          {row.availableQty <= 0 ? `سيُباع بالسالب (${row.availableQty} كرتون)` : `متاح: ${row.availableQty} كرتون`}
        </p>
      )}
      <p className="text-xs font-semibold text-gray-500 mb-2">
        {row.editing ? '✏️ تعديل صنف' : '➕ أضف صنف'}
      </p>

      <div className="grid grid-cols-12 gap-2 items-end">
        {/* الصنف */}
        <div className="col-span-5">
          <label className="block text-xs font-medium text-gray-500 mb-1">الصنف *</label>
          <ItemSearch
            onSelect={item => onItemSelect(row.id, item)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); qtyRefs.current[row.id]?.focus(); } }}
            placeholder="ابحث بالكود أو الاسم..."
            getFocusTrigger={fn => { itemRefs.current[row.id] = fn; }}
            defaultValue={row.editing ? row.itemName : ''}
          />
        </div>

        {/* العدد */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            العدد{row.weight && <span className="text-blue-400 mr-1">×{row.weight}ك</span>}
          </label>
          <input ref={el => (qtyRefs.current[row.id] = el)}
            type="number" min="0" step="0.001"
            className="input-field text-center font-bold text-base"
            placeholder="0" value={row.quantity}
            onChange={e => onUpdateRow(row.id, 'quantity', e.target.value)}
            onKeyDown={e => onKeyDown(e, row.id, 'quantity')}
          />
        </div>

        {/* الوزن */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">وزن/وحدة</label>
          <input ref={el => (wtRefs.current[row.id] = el)}
            type="number" min="0" step="0.001"
            className="input-field text-center"
            placeholder="22.680" value={row.weight}
            onChange={e => onUpdateRow(row.id, 'weight', e.target.value)}
            onKeyDown={e => onKeyDown(e, row.id, 'weight')}
          />
        </div>

        {/* السعر */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">السعر/ك</label>
          <input ref={el => (prRefs.current[row.id] = el)}
            type="number" min="0" step="0.01"
            className="input-field text-center"
            placeholder="0.00" value={row.price}
            onChange={e => onUpdateRow(row.id, 'price', e.target.value)}
            onKeyDown={e => onKeyDown(e, row.id, 'price')}
          />
        </div>

        {/* الإجمالي */}
        <div className="col-span-1 flex flex-col items-center gap-1">
          <p className="text-xs text-gray-400">الإجمالي</p>
          <p className="text-sm font-bold text-green-600 leading-tight">
            {calcTotal(row.quantity, row.weight, row.price).toFixed(0)}
          </p>
        </div>
      </div>

      {/* الوزن الكلي + زر الإضافة */}
      <div className="flex items-center gap-2 mt-2">
        <div className="flex-1">
          <input type="number" min="0" step="0.001"
            className="input-field text-center text-xs bg-blue-50/50 py-1.5"
            placeholder="أو أدخل الوزن الكلي (يحسب العدد)"
            value={totalWeightInput[row.id] || ''}
            onChange={e => onTotalWeightChange(row.id, e.target.value)}
          />
        </div>
        <button onClick={() => onSaveRow(row.id)}
          className="btn-primary px-5 py-2 text-sm"
          disabled={!row.item || !row.quantity || !row.weight || !row.price}
        >
          {row.editing ? '✓ تحديث' : '✓ إضافة'}
        </button>
        {row.editing && (
          <button onClick={() => onCancelRow(row.id)} className="btn-secondary px-3 py-2 text-sm">
            إلغاء
          </button>
        )}
      </div>
    </div>
  );
});

export default ItemInputRow;
