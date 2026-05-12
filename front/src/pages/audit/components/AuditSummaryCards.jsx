import React from 'react';
import { ACTION_LABEL, COLOR_CLS } from '../auditConfig';

export default function AuditSummaryCards({ summary }) {
  if (!summary) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      {/* Today total */}
      <div className="card text-center bg-blue-50 border border-blue-100">
        <p className="text-xs text-blue-500 mb-1">عمليات اليوم</p>
        <p className="text-3xl font-bold text-blue-700">{summary.todayCount}</p>
        <p className="text-xs text-blue-400 mt-0.5">إجمالي</p>
      </div>

      {/* Top 3 users */}
      {summary.byUser?.slice(0, 3).map((u, i) => (
        <div key={i} className="card text-center bg-gray-50">
          <div className="w-8 h-8 rounded-full bg-gray-600 text-white flex items-center justify-center text-sm font-bold mx-auto mb-1">
            {u._id?.charAt(0) || '?'}
          </div>
          <p className="text-xs text-gray-500 truncate">{u._id || 'غير معروف'}</p>
          <p className="text-xl font-bold text-gray-700">{u.count}</p>
          <p className="text-xs text-gray-400">عملية</p>
        </div>
      ))}

      {/* Top actions mini list */}
      {summary.byAction?.length > 0 && (
        <div className="card col-span-2 md:col-span-4 bg-gray-50">
          <p className="text-xs font-medium text-gray-500 mb-2">أكثر العمليات اليوم</p>
          <div className="flex flex-wrap gap-2">
            {summary.byAction.slice(0, 6).map((a) => {
              const lbl = ACTION_LABEL[a._id] || { text: a._id, icon: '•', color: 'gray' };
              return (
                <span
                  key={a._id}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${COLOR_CLS[lbl.color] || COLOR_CLS.gray}`}
                >
                  {lbl.icon} {lbl.text}
                  <span className="bg-white/60 rounded-full px-1 font-bold">{a.count}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
