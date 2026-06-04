// ─── pages/transfers/components/TransferFilters.jsx ──────────────────────────
import { useState } from 'react';

const todayStr   = () => new Date().toISOString().split('T')[0];
const monthStart = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`;
};

/**
 * Props:
 *  filters     { search, status, direction, dateFrom, dateTo }
 *  onChange    (key, value) => void
 *  onClear     () => void
 */
export default function TransferFilters({ filters, onChange, onClear }) {
  const [open, setOpen] = useState(false);
  const { search, status, direction, dateFrom, dateTo } = filters;

  const activeCount = [status, direction, dateFrom, dateTo, search].filter(Boolean).length;

  const setQuick = (label) => {
    if      (label === 'اليوم') { onChange('dateFrom', todayStr());   onChange('dateTo', todayStr()); }
    else if (label === 'أمس')   {
      const y = new Date(); y.setDate(y.getDate() - 1);
      const s = y.toISOString().split('T')[0];
      onChange('dateFrom', s); onChange('dateTo', s);
    }
    else if (label === 'الشهر') { onChange('dateFrom', monthStart()); onChange('dateTo', todayStr()); }
    else                         { onChange('dateFrom', '');          onChange('dateTo', ''); }
  };

  return (
    <div className="card space-y-3">
      {/* سطر البحث */}
      <div className="flex gap-3 flex-wrap items-center">
        <input
          className="input-field flex-1 min-w-48"
          placeholder="🔍 بحث برقم الإذن أو المستند..."
          value={search}
          onChange={e => onChange('search', e.target.value)}
        />
        <button
          onClick={() => setOpen(v => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
            open || activeCount > 0
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
          }`}
        >
          ⚙️ فلاتر
          {activeCount > 0 && (
            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
        {activeCount > 0 && (
          <button onClick={onClear} className="text-xs text-red-500 hover:underline">
            مسح الكل ✕
          </button>
        )}
      </div>

      {/* الفلاتر التفصيلية */}
      {open && (
        <div className="pt-3 border-t border-gray-100 space-y-3">
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-36">
              <label className="block text-xs font-medium text-gray-500 mb-1">الحالة</label>
              <select className="input-field" value={status} onChange={e => onChange('status', e.target.value)}>
                <option value="">الكل</option>
                <option value="pending">معلق</option>
                <option value="approved">مُوافق</option>
                <option value="rejected">مرفوض</option>
              </select>
            </div>
            <div className="flex-1 min-w-36">
              <label className="block text-xs font-medium text-gray-500 mb-1">الاتجاه</label>
              <select className="input-field" value={direction} onChange={e => onChange('direction', e.target.value)}>
                <option value="">الكل</option>
                <option value="R2O">🔵 رمسيس → أكتوبر</option>
                <option value="O2R">🟣 أكتوبر → رمسيس</option>
              </select>
            </div>
            <div className="flex-1 min-w-36">
              <label className="block text-xs font-medium text-gray-500 mb-1">من تاريخ</label>
              <input type="date" className="input-field" value={dateFrom} onChange={e => onChange('dateFrom', e.target.value)} />
            </div>
            <div className="flex-1 min-w-36">
              <label className="block text-xs font-medium text-gray-500 mb-1">إلى تاريخ</label>
              <input type="date" className="input-field" value={dateTo} onChange={e => onChange('dateTo', e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['اليوم', 'أمس', 'الشهر', 'الكل'].map(l => (
              <button
                key={l}
                onClick={() => setQuick(l)}
                className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-700 font-medium transition-colors"
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
