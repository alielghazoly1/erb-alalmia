// ─── components/SaleTable.jsx ─────────────────────────────────────────────────
// ✅ بدون pagination — الـ infinite scroll يتحكم في التحميل
// ✅ onView: فتح الفاتورة في Modal بدل Link برا
import SaleTableRow from './SaleTableRow';

export default function SaleTable({
  invoices, loading, showAllDates,
  isAdmin, onApprove, onSuspend, onCancel, onView,
}) {
  const totalApproved = invoices
    .filter(i => i.status === 'approved')
    .reduce((s, i) => s + (i.totalAmount || 0), 0);

  if (loading) {
    return (
      <div className="card text-center py-12">
        <svg className="animate-spin w-8 h-8 mx-auto text-blue-500 mb-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <p className="text-gray-400 text-sm">جاري تحميل الفواتير...</p>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="card text-center py-12 text-gray-400">
        <p className="text-3xl mb-2">📭</p>
        <p>مفيش فواتير في هذه الفترة</p>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gradient-to-l from-gray-50 to-blue-50/40 text-gray-600 border-b border-gray-200 text-xs">
            <th className="text-right px-4 py-3.5 font-semibold">رقم الفاتورة</th>
            <th className="text-right px-4 py-3.5 font-semibold">المستند</th>
            <th className="text-right px-4 py-3.5 font-semibold">العميل</th>
            <th className="text-right px-4 py-3.5 font-semibold">التاريخ</th>
            <th className="text-right px-4 py-3.5 font-semibold">بواسطة</th>
            <th className="text-right px-4 py-3.5 font-semibold">المخزن</th>
            <th className="text-right px-4 py-3.5 font-semibold">الإجمالي</th>
            <th className="text-center px-4 py-3.5 font-semibold">الحالة</th>
            <th className="text-center px-4 py-3.5 font-semibold">إجراءات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {invoices.map(inv => (
            <SaleTableRow
              key={inv._id}
              inv={inv}
              isAdmin={isAdmin}
              onApprove={onApprove}
              onSuspend={onSuspend}
              onCancel={onCancel}
              onView={onView}
            />
          ))}
        </tbody>
        {invoices.some(i => i.status === 'approved') && (
          <tfoot>
            <tr className="bg-green-50 font-semibold text-sm border-t border-green-200">
              <td colSpan={6} className="px-4 py-2.5 text-right text-gray-600">إجمالي الموافق عليه</td>
              <td className="px-4 py-2.5 text-green-700 font-bold">
                {totalApproved.toLocaleString('eg-EG', { minimumFractionDigits: 2 })} ج.م
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
