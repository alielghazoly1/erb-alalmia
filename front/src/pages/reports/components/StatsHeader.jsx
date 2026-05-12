// ─── pages/reports/components/StatsHeader.jsx ────────────────────────────────
import React from 'react';

export function StatsHeader({ season, onRefresh, loading }) {
  return (
    <div className="flex items-center justify-between mb-6 print:hidden">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">التقارير والإحصائيات</h1>
        {season && (
          <p className="text-sm text-gray-400 mt-0.5">
            موسم: <span className="text-blue-600 font-medium">{season.name}</span>
            {' · '}
            {new Date(season.startDate).toLocaleDateString('ar-EG')}
            {' ← '}
            {new Date(season.endDate).toLocaleDateString('ar-EG')}
          </p>
        )}
      </div>
      <button
        className="btn-secondary flex items-center gap-2"
        onClick={onRefresh}
        disabled={loading}
      >
        <span className={loading ? 'animate-spin inline-block' : ''}>🔄</span>
        تحديث
      </button>
    </div>
  );
}
