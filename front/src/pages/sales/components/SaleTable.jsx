// components/SaleTable.jsx
import SaleTableRow from './SaleTableRow';

const PAGE_SIZE = 50;

export default function SaleTable({
  invoices, loading, showAllDates,
  isAdmin, onApprove, onSuspend, onCancel,
  page, onPageChange,
}) {
  const totalApproved = invoices
    .filter(i => i.status === 'approved')
    .reduce((s, i) => s + (i.totalAmount || 0), 0);

  const totalPages = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));
  const slice      = invoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) {
    return (
      <div className="card text-center py-12 text-gray-400">جاري التحميل...</div>
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
          <tr className="bg-gray-50 text-gray-600">
            <th className="text-right px-4 py-3 font-medium">رقم المستند</th>
            <th className="text-right px-4 py-3 font-medium">العميل</th>
            <th className="text-right px-4 py-3 font-medium">التاريخ</th>
            <th className="text-right px-4 py-3 font-medium">بواسطة</th>
            <th className="text-right px-4 py-3 font-medium">المخزن</th>
            <th className="text-right px-4 py-3 font-medium">الإجمالي</th>
            <th className="text-right px-4 py-3 font-medium">الحالة</th>
            <th className="text-right px-4 py-3 font-medium">إجراءات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {slice.map(inv => (
            <SaleTableRow
              key={inv._id}
              inv={inv}
              isAdmin={isAdmin}
              onApprove={onApprove}
              onSuspend={onSuspend}
              onCancel={onCancel}
            />
          ))}
        </tbody>
        {invoices.some(i => i.status === 'approved') && (
          <tfoot>
            <tr className="bg-green-50 font-semibold text-sm">
              <td colSpan={5} className="px-4 py-2.5 text-right text-gray-600">
                إجمالي الموافق عليه
              </td>
              <td className="px-4 py-2.5 text-green-700">{totalApproved.toFixed(2)} ج.م</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        )}
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 py-3 border-t text-sm">
          <button
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
            className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
          >السابق</button>
          <span className="text-gray-500">{page} / {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => onPageChange(page + 1)}
            className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
          >التالي</button>
        </div>
      )}
    </div>
  );
}
