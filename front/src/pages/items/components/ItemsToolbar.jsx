// ─── pages/items/components/ItemsToolbar.jsx ──────────────────────────────────
import { useRef } from 'react';
import SearchInput from '../../../components/common/SearchInput';

export default function ItemsToolbar({
  total,
  search,
  onSearch,
  filterRaw,
  onFilterRaw,
  isAdmin,
  onAdd,
  onPrintRamses,
  onPrintOctober,
  onPrintAll,
}) {
  return (
    <div className="flex flex-col gap-3 mb-6">
      {/* العنوان + الأزرار */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">الأصناف</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            إجمالي <span className="font-semibold text-blue-600">{total.toLocaleString()}</span> صنف
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* أزرار الطباعة */}
          <div className="flex gap-1">
            <button
              onClick={onPrintRamses}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-medium rounded-lg border border-blue-200 transition-colors"
            >
              🖨️ رمسيس
            </button>
            <button
              onClick={onPrintOctober}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-sm font-medium rounded-lg border border-purple-200 transition-colors"
            >
              🖨️ أكتوبر
            </button>
            <button
              onClick={onPrintAll}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-medium rounded-lg border border-gray-200 transition-colors"
            >
              🖨️ الكل
            </button>
          </div>

          {isAdmin && (
            <button className="btn-primary" onClick={onAdd}>
              + إضافة صنف
            </button>
          )}
        </div>
      </div>

      {/* الفلاتر */}
      <div className="card py-3 flex gap-3 items-center flex-wrap">
        <div className="flex-1 min-w-48">
          <SearchInput
            onSearch={onSearch}
            placeholder="بحث بالاسم أو الكود..."
          />
        </div>
        <select
          className="input-field w-auto min-w-32"
          value={filterRaw}
          onChange={(e) => onFilterRaw(e.target.value)}
        >
          <option value="all">كل الأصناف</option>
          <option value="raw">خامات فقط</option>
          <option value="product">منتجات فقط</option>
        </select>
      </div>
    </div>
  );
}
