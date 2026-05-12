import React, { useRef } from 'react';
import ItemSearch from '../../../components/common/ItemSearch';
import toast from 'react-hot-toast';
import { fmt, calcTotalWeight, newRow } from '../manufacturingConfig';

export default function ItemRowsSection({ rows, setRows, title, icon, borderColor, headerBg, warehouse, checkStock }) {
  const qtyRefs = useRef({});
  const wtRefs  = useRef({});
  const twRefs  = useRef({});

  const handleItemSelect = (rowId, item) => {
    if (!item) return;
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? { ...r, item: item._id, itemCode: item.code, itemName: item.name, unit: item.unit,
              weight: item.defaultWeight ? String(item.defaultWeight) : r.weight,
              availableQty: item.stock?.[warehouse]?.quantity,
              totalWeightManual: '' }
          : r
      )
    );
    setTimeout(() => qtyRefs.current[rowId]?.focus(), 50);
  };

  const updateRow = (rowId, field, val) =>
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, [field]: val } : r)));

  const handleSaveRow = (rowId) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row?.item)                                  return toast.error('اختار الصنف أولاً');
    if (!row.quantity)                               return toast.error('أدخل العدد (الكراتين)');
    if (!row.weight && row.totalWeightManual === '') return toast.error('أدخل الوزن أو الوزن الكلي');
    if (calcTotalWeight(row) <= 0)                  return toast.error('الوزن الكلي لازم يكون أكبر من صفر');
    if (checkStock && row.availableQty !== undefined && Number(row.quantity) > row.availableQty)
      return toast.error(`الكمية (${row.quantity}) أكبر من المتاح (${row.availableQty} كرتون)`);
    if (rows.find((r) => r.id !== rowId && r.saved && r.item === row.item))
      return toast.error(`"${row.itemName}" موجود — عدّله`);

    setRows((prev) => [
      ...prev.map((r) => (r.id === rowId ? { ...r, saved: true, editing: false } : r)),
      newRow(),
    ]);
  };

  const handleEditRow   = (rowId) => setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, saved: false, editing: true } : r)));
  const handleDeleteRow = (rowId) => {
    setRows((prev) => { const f = prev.filter((r) => r.id !== rowId); return f.length ? f : [newRow()]; });
  };

  const savedRows   = rows.filter((r) => r.saved);
  const totalWeight = savedRows.reduce((s, r) => s + calcTotalWeight(r), 0);

  return (
    <div className="card mb-4">
      <div className={`-mx-5 -mt-5 px-5 py-3 mb-4 rounded-t-xl ${headerBg}`}>
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          {title}
          {savedRows.length > 0 && (
            <span className="text-xs font-normal text-gray-500">
              ({savedRows.length} صنف — {fmt(totalWeight, 3)} كيلو)
            </span>
          )}
        </h2>
      </div>

      {/* Saved rows table */}
      {savedRows.length > 0 && (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs">
                {['#', 'الكود', 'الصنف', 'الكراتين', 'وزن/كرتون', 'الوزن الكلي', ''].map((h) => (
                  <th key={h} className="text-right px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {savedRows.map((row, idx) => {
                const tw       = calcTotalWeight(row);
                const isManual = row.totalWeightManual !== '' && row.totalWeightManual !== undefined;
                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-gray-400 text-center text-xs">{idx + 1}</td>
                    <td className="px-3 py-2.5 font-mono text-blue-600 text-xs">{row.itemCode}</td>
                    <td className="px-3 py-2.5 font-medium text-gray-800">{row.itemName}</td>
                    <td className="px-3 py-2.5 text-center font-bold">{row.quantity}</td>
                    <td className="px-3 py-2.5 text-center text-gray-400 text-xs">{fmt(row.weight, 3)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`font-semibold text-sm ${isManual ? 'text-blue-700' : 'text-green-700'}`}>
                        {fmt(tw, 3)} ك
                      </span>
                      {isManual && <span className="block text-xs text-blue-400">يدوي</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => handleEditRow(row.id)}   className="text-blue-500 text-xs p-1 rounded hover:bg-blue-50">✏️</button>
                      <button onClick={() => handleDeleteRow(row.id)} className="text-red-400  text-xs p-1 rounded hover:bg-red-50">🗑️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-green-50 text-xs font-semibold">
                <td colSpan={5} className="px-3 py-2 text-right text-gray-600">الإجمالي</td>
                <td className="px-3 py-2 text-center text-green-700">{fmt(totalWeight, 3)} كيلو</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Input row */}
      {rows.filter((r) => !r.saved).map((row) => {
        const previewTotal = calcTotalWeight(row);
        const isManual     = row.totalWeightManual !== '' && row.totalWeightManual !== undefined;
        return (
          <div key={row.id} className={`border-2 ${borderColor} rounded-xl p-3 ${row.editing ? 'bg-amber-50/30' : 'bg-white'}`}>
            <div className="grid grid-cols-12 gap-2 mb-2 items-end">
              {/* Item */}
              <div className="col-span-12 md:col-span-4">
                <label className="block text-xs font-medium text-gray-500 mb-1">الصنف *</label>
                <ItemSearch
                  onSelect={(item) => handleItemSelect(row.id, item)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); qtyRefs.current[row.id]?.focus(); } }}
                  placeholder="ابحث بالكود أو الاسم..."
                  defaultValue={row.editing ? row.itemName : ''}
                />
                {row.itemName && <p className="text-xs text-green-600 mt-0.5 font-medium truncate">✓ {row.itemName}</p>}
                {checkStock && row.availableQty !== undefined && (
                  <p className={`text-xs mt-0.5 ${row.availableQty === 0 ? 'text-red-500' : row.availableQty <= 5 ? 'text-amber-600' : 'text-green-600'}`}>
                    {row.availableQty === 0 ? '🔴' : row.availableQty <= 5 ? '🟡' : '🟢'} متاح: {row.availableQty} كرتون
                  </p>
                )}
              </div>

              {/* Quantity */}
              <div className="col-span-4 md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">الكراتين *</label>
                <input ref={(el) => (qtyRefs.current[row.id] = el)}
                  type="number" min="0" step="1" className="input-field text-center font-bold"
                  placeholder="0" value={row.quantity}
                  onChange={(e) => updateRow(row.id, 'quantity', e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); wtRefs.current[row.id]?.focus(); } }}
                />
              </div>

              {/* Weight per unit */}
              <div className="col-span-4 md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  وزن/كرتون {isManual && <span className="text-gray-300">(مُعطَّل)</span>}
                </label>
                <input ref={(el) => (wtRefs.current[row.id] = el)}
                  type="number" min="0" step="0.001"
                  className={`input-field text-center ${isManual ? 'opacity-40' : ''}`}
                  placeholder="0.000" value={row.weight}
                  onChange={(e) => updateRow(row.id, 'weight', e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); twRefs.current[row.id]?.focus(); } }}
                />
              </div>

              {/* Manual total weight */}
              <div className="col-span-4 md:col-span-2">
                <label className="block text-xs font-medium text-blue-600 mb-1">
                  الوزن الكلي <span className="text-gray-400 font-normal">(يدوي)</span>
                </label>
                <input ref={(el) => (twRefs.current[row.id] = el)}
                  type="number" min="0" step="0.001"
                  className="input-field text-center border-blue-200 focus:border-blue-400 focus:ring-blue-100"
                  placeholder="اتركه فاضي"
                  value={row.totalWeightManual}
                  onChange={(e) => updateRow(row.id, 'totalWeightManual', e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRow(row.id); }}
                />
                <p className="text-xs text-blue-400 mt-0.5">{isManual ? '✏️ يدوي مفعّل' : 'للحساب التلقائي'}</p>
              </div>

              {/* Preview */}
              <div className="col-span-6 md:col-span-1 text-center">
                <p className="text-xs text-gray-400 mb-1">الكلي</p>
                <p className={`text-sm font-bold ${isManual ? 'text-blue-700' : 'text-gray-700'}`}>
                  {fmt(previewTotal, 2)} ك
                </p>
              </div>

              {/* Save button */}
              <div className="col-span-6 md:col-span-1 flex flex-col gap-1">
                <button onClick={() => handleSaveRow(row.id)}
                  className="btn-primary text-xs py-2 px-2"
                  disabled={!row.item || !row.quantity}>
                  {row.editing ? '✓' : '+ إضافة'}
                </button>
                {row.editing && (
                  <button onClick={() => handleDeleteRow(row.id)} className="btn-secondary text-xs py-1 px-2">×</button>
                )}
              </div>
            </div>

            {/* Manual weight hint */}
            {isManual && row.quantity && row.weight && (
              <div className="mt-1 p-2 bg-blue-50 rounded-lg flex items-center gap-2 text-xs text-blue-600">
                <span>ℹ️</span>
                <span>
                  الحساب التلقائي: {fmt((parseFloat(row.quantity) || 0) * (parseFloat(row.weight) || 0), 3)} ك —
                  الوزن اليدوي: <b>{fmt(parseFloat(row.totalWeightManual), 3)} ك</b>
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
