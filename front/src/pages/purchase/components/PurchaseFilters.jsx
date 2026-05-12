// ─── pages/purchase/components/PurchaseFilters.jsx ───────────────────────────
import React from 'react';

export default function PurchaseFilters({ filters, onFilter }) {
  const { status, search, showAllDates, dateFrom, dateTo } = filters;
  const {
    setFilter,
    setToday,
    setYesterday,
    setThisMonth,
    toggleAllDates,
  } = onFilter;

  return (
    <div className="card mb-4 space-y-3">
      {/* صف ١: بحث + حالة */}
      <div className="flex gap-3 flex-wrap">
        <input
          className="input-field flex-1 min-w-48"
          placeholder="بحث برقم الفاتورة أو المورد أو رقم المستند..."
          value={search}
          onChange={(e) => setFilter('search', e.target.value)}
        />
        <select
          className="input-field w-40"
          value={status}
          onChange={(e) => setFilter('status', e.target.value)}
        >
          <option value="">كل الحالات</option>
          <option value="pending">معلق</option>
          <option value="approved">مُوافق</option>
          <option value="suspended">موقوف</option>
          <option value="cancelled">ملغي</option>
        </select>
      </div>

      {/* صف ٢: فلتر التاريخ */}
      <div className="flex gap-3 flex-wrap items-center">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showAllDates}
            onChange={(e) => toggleAllDates(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          عرض كل التواريخ
        </label>

        {!showAllDates && (
          <>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 whitespace-nowrap">
                من
              </label>
              <input
                type="date"
                className="input-field py-1.5 text-sm w-40"
                value={dateFrom}
                onChange={(e) => setFilter('from', e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 whitespace-nowrap">
                إلى
              </label>
              <input
                type="date"
                className="input-field py-1.5 text-sm w-40"
                value={dateTo}
                onChange={(e) => setFilter('to', e.target.value)}
              />
            </div>
            <div className="flex gap-1.5">
              {[
                { label: 'اليوم', fn: setToday },
                { label: 'أمس', fn: setYesterday },
                { label: 'هذا الشهر', fn: setThisMonth },
              ].map((btn) => (
                <button
                  key={btn.label}
                  onClick={btn.fn}
                  className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium transition-colors"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
