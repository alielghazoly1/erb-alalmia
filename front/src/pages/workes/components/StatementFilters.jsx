// ─── components/StatementFilters.jsx ─────────────────────────────────────────
//  شريط الفلاتر: الموسم / الحالة / التاريخ / الاختصارات
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import api                     from '../../../services/api';
import { QUICK_RANGES }        from '../hooks/useWorkerStatement';

export default function StatementFilters({
  dateFrom, setDateFrom,
  dateTo,   setDateTo,
  showAll,  setShowAll,
  statusFilter, setStatusFilter,
  seasonId,     setSeasonId,
  applyQuickRange,
}) {
  const [seasons, setSeasons] = useState([]);

  useEffect(() => {
    api.get('/manufacturing/seasons')
      .then(({ data }) => setSeasons(data))
      .catch(() => {});
  }, []);

  return (
    <div className="card mb-5 no-print space-y-3">

      {/* ── صف 1: موسم + حالة + كل التواريخ ─────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-end">

        {/* الموسم */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">الموسم</label>
          <select
            className="input-field py-1.5 text-sm w-44"
            value={seasonId}
            onChange={e => setSeasonId(e.target.value)}
          >
            <option value="">كل المواسم</option>
            {seasons.map(s => (
              <option key={s._id} value={s._id}>
                {s.name}{s.isActive ? ' ✦' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* الحالة */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">الحالة</label>
          <select
            className="input-field py-1.5 text-sm w-36"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">كل الحالات</option>
            <option value="approved">✅ مُوافق فقط</option>
            <option value="pending">⏳ معلق فقط</option>
            <option value="rejected">❌ مرفوض فقط</option>
          </select>
        </div>

        {/* كل التواريخ */}
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer self-end pb-1.5">
          <input
            type="checkbox"
            className="w-4 h-4 rounded"
            checked={showAll}
            onChange={e => setShowAll(e.target.checked)}
          />
          كل التواريخ
        </label>
      </div>

      {/* ── صف 2: من / إلى + اختصارات ───────────────────────────────────── */}
      {!showAll && (
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="date"
            className="input-field py-1.5 text-sm w-36"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
          />
          <span className="text-gray-400 text-xs">←</span>
          <input
            type="date"
            className="input-field py-1.5 text-sm w-36"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
          />
          <div className="flex gap-1.5 flex-wrap">
            {QUICK_RANGES.map(r => (
              <button
                key={r.label}
                onClick={() => applyQuickRange(r)}
                className="text-xs px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-medium"
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
