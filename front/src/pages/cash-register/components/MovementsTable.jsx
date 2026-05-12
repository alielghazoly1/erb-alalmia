import React from 'react';
import { Link } from 'react-router-dom';
import { fmt, fmtDate, fmtTime, TYPE_LABEL, METHOD_LABEL } from '../cashRegisterConfig';

function EmptyState({ msg }) {
  return (
    <div className="text-center py-10 text-gray-400">
      <p className="text-3xl mb-2">💸</p>
      <p>{msg}</p>
    </div>
  );
}

export default function MovementsTable({ movements, emptyMsg }) {
  if (!movements?.length) return <EmptyState msg={emptyMsg} />;

  const total = movements.reduce((s, m) => s + m.amount, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-gray-600 text-xs">
            {['#','التاريخ','الوقت','النوع','طريقة الدفع','العميل','المرجع'].map((h) => (
              <th key={h} className="text-right px-3 py-2.5">{h}</th>
            ))}
            <th className="text-center px-3 py-2.5">المبلغ</th>
            <th className="text-center px-3 py-2.5">فتح</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100">
          {movements.map((m, idx) => {
            const tp    = TYPE_LABEL[m.type] || { text: m.type, cls: 'bg-gray-100 text-gray-600', icon: '•', sign: '' };
            const isNeg = m.amount < 0;
            const link  = m.referenceModel === 'SaleInvoice' ? `/sales/${m.referenceId}` : null;

            return (
              <tr key={m._id} className={`hover:bg-gray-50 ${isNeg ? 'bg-red-50/30' : ''}`}>
                <td className="px-3 py-2.5 text-gray-400 text-xs text-center">{idx + 1}</td>
                <td className="px-3 py-2.5 text-gray-600 text-xs">{fmtDate(m.date)}</td>
                <td className="px-3 py-2.5 text-gray-400 text-xs">{fmtTime(m.createdAt)}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tp.cls}`}>
                    {tp.icon} {tp.text}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-500">
                  {METHOD_LABEL[m.paymentMethod] || m.paymentMethod || '—'}
                </td>
                <td className="px-3 py-2.5 text-xs">
                  <span className="font-medium text-gray-800">{m.customerName || '—'}</span>
                  {m.customerCode && (
                    <span className="text-gray-400 text-xs mr-1">({m.customerCode})</span>
                  )}
                </td>
                <td className="px-3 py-2.5 font-mono text-blue-600 text-xs">
                  {m.referenceNumber || '—'}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`font-bold text-sm ${isNeg ? 'text-red-600' : 'text-green-600'}`}>
                    {tp.sign}{fmt(Math.abs(m.amount))}
                  </span>
                  <span className="text-gray-400 text-xs mr-1">ج.م</span>
                </td>
                <td className="px-3 py-2.5 text-center">
                  {link ? (
                    <Link to={link} className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded-lg">
                      فتح ←
                    </Link>
                  ) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr className={`font-semibold text-sm ${total >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <td colSpan={7} className="px-3 py-2.5 text-right text-gray-600">الصافي</td>
            <td className={`px-3 py-2.5 text-center font-bold ${total >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {total >= 0 ? '+' : ''}{fmt(total)} ج.م
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
