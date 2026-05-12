// ─── pages/reports/components/PendingBadges.jsx ──────────────────────────────
import React from 'react';

const PENDING_CONFIG = [
  { key: 'sales',     label: 'مبيعات',   color: 'text-green-600',  bg: 'bg-green-50' },
  { key: 'purchases', label: 'توريد',    color: 'text-blue-600',   bg: 'bg-blue-50' },
  { key: 'returns',   label: 'مرتجعات',  color: 'text-orange-600', bg: 'bg-orange-50' },
  { key: 'transfers', label: 'تحويلات',  color: 'text-purple-600', bg: 'bg-purple-50' },
];

export function PendingBadges({ pending }) {
  if (!pending) return null;
  const hasAny = Object.values(pending).some(v => v > 0);
  if (!hasAny) return null;

  return (
    <div className="card border-l-4 border-amber-400">
      <h3 className="font-semibold text-amber-700 mb-4 flex items-center gap-2">
        <span>⏳</span> في انتظار الموافقة
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {PENDING_CONFIG.map(({ key, label, color, bg }) => (
          <div key={key} className={`${bg} rounded-xl p-4 text-center`}>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-3xl font-bold ${color}`}>{pending[key] ?? 0}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
