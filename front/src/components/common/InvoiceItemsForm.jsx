// ─── InvoiceItemsForm.jsx ──────────────────────────────────────────────────────
// ✅ ARCH-001: الوزن هو مصدر الحقيقة الوحيد
//
// Layout جديد محسّن:
//   سطر 1: [صنف (flex-1)] [عدد (ثابت)]
//   سطر 2: [وزن/وحدة (readonly)] [وزن كلي]
//   سطر 3: [سعر (لو showPrice)] — زر الإضافة
//
// ✅ نتايج البحث فوق مش تحت (في ItemSearch)
// ✅ وزن/وحدة readonly — مش قابل للتعديل
// ✅ وزن كلي تحت العدد ووزن/وحدة
// ✅ Enter ينقل للخانة الجاية
// ✅ تعديل يفتح نفس الفورم (في نفس المكان في الجدول)
//
// الفورم مستخدم في: مبيعات، توريدات، مرتجعات، تحويلات، تصنيع
// ─────────────────────────────────────────────────────────────────────────────

import { memo, useRef } from 'react';
import ItemSearch from './ItemSearch';

// ── helpers ────────────────────────────────────────────────────────────────────
const r2  = (v) => Math.round((parseFloat(v) || 0) * 100)  / 100;
const r3  = (v) => Math.round((parseFloat(v) || 0) * 1000) / 1000;

/**
 * ✅ ARCH-001: getTotalWeight — المصدر الحقيقي
 */
const getTW = (row, twInputVal = null) => {
  const twInput = parseFloat(twInputVal);
  if (!isNaN(twInput) && twInput > 0) return twInput;
  const stored = parseFloat(row._totalWeight);
  if (!isNaN(stored) && stored > 0) return stored;
  const qty = parseFloat(row.quantity)   || 0;
  const uw  = parseFloat(row.unitWeight) || 0;
  return r3(qty * uw);
};

const derivedQty = (tw, uw) => {
  if (!uw || !tw) return null;
  return tw / uw;
};

const fmt4 = (v) => {
  const n = parseFloat(v);
  if (isNaN(n) || Math.abs(n) < 1e-10) return '0';
  return parseFloat(n.toFixed(4)).toString();
};

const fmt3 = (v) => parseFloat(v || 0).toFixed(3);
const fmt2 = (v) => parseFloat(v || 0).toFixed(2);

export const calcRowPayload = (row) => {
  const uw  = parseFloat(row.unitWeight) || 0;
  const pr  = parseFloat(row.price)      || 0;
  const tw  = getTW(row);
  const qty = uw > 0 ? tw / uw : (parseFloat(row.quantity) || 0);
  return {
    item:        row.item,
    itemCode:    row.itemCode,
    itemName:    row.itemName,
    quantity:    qty,
    weight:      uw,
    totalWeight: tw,
    price:       pr,
    total:       r2(tw * pr),
  };
};

// ── StockBadge ─────────────────────────────────────────────────────────────────
const StockBadge = memo(function StockBadge({ row, currentTW }) {
  const hasWt  = row.availableWeight !== undefined;
  if (!hasWt && row.availableQty === undefined) return null;

  const awt    = parseFloat(row.availableWeight) || 0;
  const uw     = parseFloat(row.unitWeight) || 0;
  const isZero = hasWt && awt <= 0;
  const isOver = hasWt && currentTW > awt && awt >= 0;

  return (
    <div className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs font-medium mb-2 border ${
      isZero ? 'bg-red-50 border-red-200 text-red-700' :
      isOver  ? 'bg-orange-50 border-orange-200 text-orange-700' :
                'bg-emerald-50 border-emerald-200 text-emerald-700'
    }`}>
      <span className="text-base leading-none">
        {isZero ? '❌' : isOver ? '⚠️' : '📦'}
      </span>
      <span>رصيد: </span>
      <span className={`font-bold ${isOver ? 'text-orange-600 underline decoration-dotted' : ''}`}>
        {fmt3(awt)} ك
      </span>
      {uw > 0 && (
        <span className="text-gray-400">
          ({fmt4(awt / uw)} كرتون)
        </span>
      )}
      {isOver && (
        <span className="mr-auto text-orange-600 font-semibold">
          (يتجاوز بـ {fmt3(currentTW - awt)} ك)
        </span>
      )}
      {isZero && (
        <span className="mr-auto font-semibold">لا يوجد رصيد في هذا المخزن</span>
      )}
    </div>
  );
});

// ── SavedRowsTable ─────────────────────────────────────────────────────────────
const SavedRowsTable = memo(function SavedRowsTable({ rows, showPrice, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-200">
            <th className="text-center px-2 py-2.5 w-8">#</th>
            <th className="text-right  px-3 py-2.5">الكود</th>
            <th className="text-right  px-3 py-2.5">الصنف</th>
            <th className="text-center px-2 py-2.5">رصيد (ك)</th>
            <th className="text-center px-2 py-2.5">العدد</th>
            <th className="text-center px-2 py-2.5">وزن/وحدة</th>
            <th className="text-center px-2 py-2.5">وزن كلي (ك)</th>
            {showPrice && <th className="text-center px-2 py-2.5">السعر/ك</th>}
            {showPrice && <th className="text-center px-2 py-2.5">الإجمالي</th>}
            <th className="w-16"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, idx) => {
            const tw   = getTW(row);
            const uw   = parseFloat(row.unitWeight) || 0;
            const qty  = derivedQty(tw, uw);
            const awt  = row.availableWeight !== undefined ? parseFloat(row.availableWeight) : null;
            const over = awt !== null && tw > awt && awt >= 0;
            return (
              <tr key={row.id} className={`hover:bg-gray-50 transition-colors ${over ? 'bg-orange-50/40' : ''}`}>
                <td className="px-2 py-2.5 text-gray-400 text-center text-xs">{idx + 1}</td>
                <td className="px-3 py-2.5 font-mono text-blue-600 text-xs">{row.itemCode}</td>
                <td className="px-3 py-2.5 font-medium text-gray-800 max-w-[180px] truncate">{row.itemName}</td>
                <td className="px-2 py-2.5 text-center">
                  {awt !== null ? (
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                      awt <= 0 ? 'bg-red-100 text-red-600' :
                      over     ? 'bg-orange-100 text-orange-700' :
                                 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {fmt3(awt)}
                    </span>
                  ) : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="px-2 py-2.5 text-center text-gray-600 text-xs">
                  {qty !== null ? fmt4(qty) : '—'}
                </td>
                <td className="px-2 py-2.5 text-center text-gray-400 text-xs">{fmt3(uw)}</td>
                <td className={`px-2 py-2.5 text-center font-bold ${over ? 'text-orange-600' : 'text-blue-700'}`}>
                  {fmt3(tw)}
                  {over && <span className="block text-xs text-orange-400 font-normal">⚠️ يتجاوز</span>}
                </td>
                {showPrice && <td className="px-2 py-2.5 text-center text-gray-600">{fmt2(row.price)}</td>}
                {showPrice && (
                  <td className="px-2 py-2.5 text-center font-semibold text-green-700">
                    {fmt2(tw * (parseFloat(row.price) || 0))}
                  </td>
                )}
                <td className="px-2 py-2.5 text-right">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => onEdit(row.id)}   className="text-blue-500 text-xs p-1.5 rounded hover:bg-blue-50" title="تعديل">✏️</button>
                    <button onClick={() => onDelete(row.id)} className="text-red-400  text-xs p-1.5 rounded hover:bg-red-50"  title="حذف">🗑️</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        {rows.length > 1 && (
          <tfoot>
            <tr className="bg-gray-50 border-t border-gray-200 font-semibold text-xs text-gray-600">
              <td colSpan={showPrice ? 6 : 6} className="px-3 py-2 text-right">
                الإجمالي ({rows.length} صنف)
              </td>
              <td className="px-2 py-2 text-center text-blue-700 font-bold">
                {fmt3(rows.reduce((s, r) => s + getTW(r), 0))} ك
              </td>
              {showPrice && <td></td>}
              {showPrice && (
                <td className="px-2 py-2 text-center text-green-700 font-bold">
                  {fmt2(rows.reduce((s, r) => s + r2(getTW(r) * (parseFloat(r.price) || 0)), 0))} ج.م
                </td>
              )}
              <td></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
});

// ── InputRow ───────────────────────────────────────────────────────────────────
// Layout محسّن:
//   سطر 1: [صنف (flex)] [عدد]
//   سطر 2: [وزن/وحدة readonly] [وزن كلي *] [سعر لو موجود]
//   زر الإضافة في آخر سطر 2
const InputRow = memo(function InputRow({
  row, showPrice, totalWeightInputVal,
  qtyRefs, wtRefs, prRefs, twRefs, itemRefs,
  onItemSelect,
  onQuantityChange, onUnitWeightChange, onTotalWeightChange, onPriceChange,
  onKeyDown, onSaveRow, onCancelRow,
}) {
  const tw    = getTW(row, totalWeightInputVal || null);
  const uw    = parseFloat(row.unitWeight) || 0;
  const pr    = parseFloat(row.price)      || 0;
  const total = r2(tw * pr);

  const displayQty = uw > 0 && tw > 0 ? fmt4(tw / uw) : '';
  const hasTwInput = parseFloat(totalWeightInputVal) > 0;

  const awt  = row.availableWeight !== undefined ? parseFloat(row.availableWeight) : null;
  const over = awt !== null && tw > awt && awt >= 0;

  return (
    <div className={`rounded-xl border-2 p-3 sticky bottom-0 z-20 bg-white shadow-[0_-6px_20px_rgba(0,0,0,0.1)] ${
      row.editing ? 'border-amber-400 bg-amber-50/98' :
      over        ? 'border-orange-300 bg-orange-50/98' :
                    'border-blue-200 bg-blue-50/98'
    }`}>

      <p className="text-xs font-semibold text-gray-500 mb-2">
        {row.editing ? '✏️ تعديل الصنف' : '➕ إضافة صنف'}
      </p>

      <StockBadge row={row} currentTW={tw} />

      {/* ── سطر 1: الصنف + العدد ── */}
      <div className="flex gap-2 mb-2 items-end">

        {/* الصنف — يأخذ كل المساحة المتاحة */}
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-medium text-gray-500 mb-1">الصنف *</label>
          <ItemSearch
            onSelect={item => onItemSelect(row.id, item)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); qtyRefs.current[row.id]?.focus(); } }}
            placeholder="ابحث بالكود أو الاسم..."
            getFocusTrigger={fn => { itemRefs.current[row.id] = fn; }}
            defaultValue={row.editing ? row.itemName : ''}
          />
        </div>

        {/* العدد — عرض ثابت */}
        <div className="w-24 shrink-0">
          <label className="block text-xs font-medium text-gray-500 mb-1">العدد</label>
          <input
            ref={el => (qtyRefs.current[row.id] = el)}
            type="number" min="0" step="any"
            className="input-field text-center"
            placeholder="0"
            value={row.quantity}
            onChange={e => onQuantityChange(row.id, e.target.value)}
            onKeyDown={e => onKeyDown(e, row.id, 'quantity')}
          />
        </div>
      </div>

      {/* ── سطر 2: وزن/وحدة (readonly) + وزن كلي + [سعر] + زر ── */}
      <div className="flex gap-2 items-end">

        {/* وزن/وحدة — readonly ثابت من الصنف */}
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

        {/* الوزن الكلي — المصدر الحقيقي */}
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-medium text-blue-600 mb-1">
            الوزن الكلي (ك) *
          </label>
          <input
            ref={el => (twRefs.current[row.id] = el)}
            type="number" min="0" step="any"
            className={`input-field text-center font-bold text-base border-2 ${
              over        ? 'bg-red-50 border-red-300' :
              hasTwInput  ? 'border-blue-400 bg-blue-50' :
                            'border-blue-200'
            }`}
            placeholder="0.000"
            value={totalWeightInputVal}
            onChange={e => onTotalWeightChange(row.id, e.target.value)}
            onKeyDown={e => onKeyDown(e, row.id, 'totalWeight')}
          />
          {displayQty && (
            <p className="text-xs text-gray-500 mt-0.5 text-center">
              = {displayQty} كرتون
            </p>
          )}
        </div>

        {/* السعر */}
        {showPrice && (
          <div className="w-24 shrink-0">
            <label className="block text-xs font-medium text-gray-500 mb-1">السعر/ك</label>
            <input
              ref={el => (prRefs.current[row.id] = el)}
              type="number" min="0" step="0.01"
              className="input-field text-center"
              placeholder="0.00"
              value={row.price}
              onChange={e => onPriceChange(row.id, e.target.value)}
              onKeyDown={e => onKeyDown(e, row.id, 'price')}
            />
          </div>
        )}

        {/* زر الإضافة / الحفظ */}
        <div className="shrink-0 flex flex-col gap-1">
          {showPrice && tw > 0 && pr > 0 && (
            <p className="text-xs text-emerald-600 font-bold text-center leading-tight">
              {fmt2(total)} ج
            </p>
          )}
          <button
            onClick={() => onSaveRow(row.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              over ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'btn-primary'
            }`}
            disabled={!row.item || !row.unitWeight}
            title={over ? 'تحذير: يتجاوز الرصيد المتاح' : ''}
          >
            {row.editing ? '✓ حفظ' : '＋ أضف'}
          </button>
          {row.editing && (
            <button onClick={() => onCancelRow(row.id)} className="px-4 py-1 rounded-lg text-xs text-gray-500 hover:bg-gray-100 text-center">
              إلغاء
            </button>
          )}
        </div>
      </div>

      {/* ملخص الصف */}
      {tw > 0 && (
        <div className="mt-2 flex items-center gap-3 text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg flex-wrap">
          <span>📦 وزن كلي: <strong>{fmt3(tw)} ك</strong></span>
          {uw > 0 && <span>| عدد: <strong>{fmt4(tw / uw)} كرتون</strong></span>}
          {showPrice && pr > 0 && <span>| إجمالي: <strong>{fmt2(total)} ج.م</strong></span>}
        </div>
      )}
    </div>
  );
});

// ── InvoiceItemsForm — الكومبونانت الرئيسي ─────────────────────────────────────
export default function InvoiceItemsForm({
  rows = [],
  totalWeightInput = {},
  showPrice = true,
  qtyRefs, wtRefs, prRefs, twRefs, itemRefs,
  onItemSelect,
  onUpdateRow,
  onQuantityChange,
  onUnitWeightChange,
  onTotalWeightChange,
  onKeyDown, onSaveRow, onEditRow, onCancelRow, onDeleteRow,
}) {
  const _qtyRefs  = useRef({});
  const _wtRefs   = useRef({});
  const _prRefs   = useRef({});
  const _twRefs   = useRef({});
  const _itemRefs = useRef({});
  const $qty  = qtyRefs  ?? _qtyRefs;
  const $wt   = wtRefs   ?? _wtRefs;
  const $pr   = prRefs   ?? _prRefs;
  const $tw   = twRefs   ?? _twRefs;
  const $item = itemRefs ?? _itemRefs;

  const handleQty   = onQuantityChange   ?? ((rowId, v) => onUpdateRow?.(rowId, 'quantity',   v));
  const handleUW    = onUnitWeightChange ?? ((rowId, v) => onUpdateRow?.(rowId, 'unitWeight', v));
  const handlePrice = (rowId, v) => onUpdateRow?.(rowId, 'price', v);

  const savedRows = rows.filter(r => r.saved);
  const inputRows = rows.filter(r => !r.saved);

  return (
    <div>
      {savedRows.length > 0 && (
        <div className="mb-3">
          <SavedRowsTable
            rows={savedRows}
            showPrice={showPrice}
            onEdit={onEditRow}
            onDelete={onDeleteRow}
          />
        </div>
      )}
      {inputRows.map(row => (
        <InputRow
          key={row.id}
          row={row}
          showPrice={showPrice}
          totalWeightInputVal={totalWeightInput[row.id] || ''}
          qtyRefs={$qty}
          wtRefs={$wt}
          prRefs={$pr}
          twRefs={$tw}
          itemRefs={$item}
          onItemSelect={onItemSelect}
          onQuantityChange={handleQty}
          onUnitWeightChange={handleUW}
          onPriceChange={handlePrice}
          onTotalWeightChange={onTotalWeightChange}
          onKeyDown={onKeyDown}
          onSaveRow={onSaveRow}
          onCancelRow={onCancelRow}
        />
      ))}
    </div>
  );
}
