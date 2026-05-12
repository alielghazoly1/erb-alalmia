import React from 'react';
import { fmtDate, fmtTime, ACTION_LABEL, COLOR_CLS, LIMIT } from '../auditConfig';

function LogDetails({ details }) {
  if (!details) return <span className="text-gray-300">—</span>;
  const parts = [];
  if (details.customerName) parts.push(`العميل: ${details.customerName}`);
  if (details.supplierName) parts.push(`المورد: ${details.supplierName}`);
  if (details.totalAmount !== undefined) parts.push(`${Number(details.totalAmount).toFixed(2)} ج.م`);
  if (details.amount       !== undefined && details.totalAmount === undefined) parts.push(`${Number(details.amount).toFixed(2)} ج.م`);
  if (details.editNotes)    parts.push(details.editNotes);
  if (!parts.length) return <span className="text-gray-300">—</span>;
  return (
    <span
      className="truncate block max-w-[180px] text-gray-500"
      title={JSON.stringify(details, null, 2)}
    >
      {parts.join(' — ')}
    </span>
  );
}

export default function AuditTable({ logs, loading, page }) {
  if (loading) {
    return (
      <div className="card text-center py-16 text-gray-400">
        <div className="text-4xl mb-3 animate-pulse">📋</div>
        <p>جاري التحميل...</p>
      </div>
    );
  }

  if (!logs.length) {
    return (
      <div className="card text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">📭</p>
        <p className="font-medium">مفيش سجلات في هذه الفترة</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-white text-xs">
              {['#', 'التاريخ', 'الوقت', 'المستخدم', 'الدور', 'العملية', 'المرجع', 'تفاصيل'].map((h) => (
                <th key={h} className="text-right px-4 py-3 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((log, idx) => {
              const lbl = ACTION_LABEL[log.action] || { text: log.action, icon: '•', color: 'gray' };
              const cls = COLOR_CLS[lbl.color] || COLOR_CLS.gray;
              const num = (page - 1) * LIMIT + idx + 1;

              return (
                <tr key={log._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-gray-400 text-xs text-center">{num}</td>

                  <td className="px-4 py-2.5 text-gray-700 text-xs font-medium whitespace-nowrap">
                    {fmtDate(log.createdAt)}
                  </td>

                  <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                    {fmtTime(log.createdAt)}
                  </td>

                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {log.userName?.charAt(0) || '?'}
                      </div>
                      <span className="font-medium text-gray-800 text-xs whitespace-nowrap">
                        {log.userName || '—'}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      log.userRole === 'admin'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {log.userRole === 'admin' ? 'أدمن' : 'مستخدم'}
                    </span>
                  </td>

                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${cls}`}>
                      {lbl.icon} {lbl.text}
                    </span>
                  </td>

                  <td className="px-4 py-2.5 font-mono text-blue-600 text-xs font-medium whitespace-nowrap">
                    {log.resourceRef || '—'}
                  </td>

                  <td className="px-4 py-2.5 text-xs">
                    <LogDetails details={log.details} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
