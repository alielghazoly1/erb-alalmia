import React from 'react';
import { ACTION_OPTS } from '../auditConfig';

const QUICK = ['اليوم', 'أمس', 'الأسبوع'];

export default function AuditFilters({
  users, userId, action, dateFrom, dateTo, showAll, total,
  setUserId, setAction, setDateFrom, setDateTo, setShowAll, setQuick,
}) {
  return (
    <div className="card mb-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        {/* User filter */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">المستخدم</label>
          <select className="input-field" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">الكل</option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name} ({u.role === 'admin' ? 'أدمن' : 'مستخدم'})
              </option>
            ))}
          </select>
        </div>

        {/* Action filter */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">نوع العملية</label>
          <select className="input-field" value={action} onChange={(e) => setAction(e.target.value)}>
            {ACTION_OPTS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Date range */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">من تاريخ</label>
          <input
            type="date" className="input-field"
            value={dateFrom} disabled={showAll}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">إلى تاريخ</label>
          <input
            type="date" className="input-field"
            value={dateTo} disabled={showAll}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {/* Quick filters row */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox" className="w-4 h-4 rounded"
            checked={showAll} onChange={(e) => setShowAll(e.target.checked)}
          />
          كل التواريخ
        </label>
        {!showAll && QUICK.map((l) => (
          <button
            key={l} onClick={() => setQuick(l)}
            className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium transition-colors"
          >
            {l}
          </button>
        ))}
        <span className="text-xs text-gray-400 mr-auto">{total.toLocaleString('ar-EG')} سجل</span>
      </div>
    </div>
  );
}
