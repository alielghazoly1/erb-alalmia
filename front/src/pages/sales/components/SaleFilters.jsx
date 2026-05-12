// components/SaleFilters.jsx
// شريط الفلاتر — بحث / حالة / تواريخ
export default function SaleFilters({ filters, onChange }) {
  const { search, status, dateFrom, dateTo, showAllDates } = filters;

  const todayStr = () => new Date().toISOString().split('T')[0];
  const firstOfMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };
  const yesterday = () => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  };

  const set = (key, val) => onChange({ ...filters, [key]: val });

  return (
    <div className="card mb-4 space-y-3">
      <div className="flex gap-3 flex-wrap">
        <input
          className="input-field flex-1 min-w-48"
          placeholder="بحث برقم الفاتورة أو العميل أو رقم المستند..."
          value={search}
          onChange={e => set('search', e.target.value)}
        />
        <select
          className="input-field w-40"
          value={status}
          onChange={e => set('status', e.target.value)}
        >
          <option value="">كل الحالات</option>
          <option value="pending">معلق</option>
          <option value="approved">مُوافق</option>
          <option value="suspended">موقوف</option>
          <option value="cancelled">ملغي</option>
        </select>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showAllDates}
            onChange={e => set('showAllDates', e.target.checked)}
            className="w-4 h-4 rounded"
          />
          عرض كل التواريخ
        </label>

        {!showAllDates && (
          <>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 whitespace-nowrap">من</label>
              <input
                type="date"
                className="input-field py-1.5 text-sm w-40"
                value={dateFrom}
                onChange={e => set('dateFrom', e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 whitespace-nowrap">إلى</label>
              <input
                type="date"
                className="input-field py-1.5 text-sm w-40"
                value={dateTo}
                onChange={e => set('dateTo', e.target.value)}
              />
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => onChange({ ...filters, dateFrom: todayStr(), dateTo: todayStr() })}
                className="text-xs px-2.5 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium"
              >اليوم</button>
              <button
                onClick={() => onChange({ ...filters, dateFrom: firstOfMonth(), dateTo: todayStr() })}
                className="text-xs px-2.5 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium"
              >هذا الشهر</button>
              <button
                onClick={() => { const y = yesterday(); onChange({ ...filters, dateFrom: y, dateTo: y }); }}
                className="text-xs px-2.5 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium"
              >أمس</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
