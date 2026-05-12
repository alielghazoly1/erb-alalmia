// ─── components/PaymentsTable.jsx ───────────────────────────────────────────
// جدول المدفوعات داخل كشف الحساب مع دعم التعديل
// ────────────────────────────────────────────────────────────────────────────
import { PAY_METHOD_LABEL } from '../customerUtils';
import SectionHeader from './SectionHeader';
import StatementTablePagination from './StatementTablePagination';

export default function PaymentsTable({
  payments,    // الصفحة الحالية
  allPayments, // كل المدفوعات
  page, totalPages, onPageChange,
  onEdit,      // callback لتعديل دفعة
}) {
  const total = allPayments.reduce((s, p) => s + (p.amount || 0), 0);

  return (
    <div className="card mb-4 print:shadow-none print:border">
      <SectionHeader
        title="💰 المدفوعات"
        count={allPayments.length}
        total={`+ ${total.toFixed(2)} ج.م`}
        totalColor="text-green-700"
      />

      {allPayments.length === 0 ? (
        <p className="text-center text-gray-400 py-4">لا يوجد مدفوعات</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '2px solid #000', borderTop: '2px solid #000', background: '#f0fdf4' }}>
                  {['رقم الوصل', 'التاريخ', 'الوقت', 'المبلغ', 'طريقة الدفع', 'ملاحظات', 'تعديل'].map((h, i) => (
                    <th
                      key={h}
                      className={`px-3 py-2 font-bold text-black text-xs
                        ${i === 3 ? 'text-center' : 'text-right'}
                        ${i === 6 ? 'print:hidden' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {payments.map((p, idx) => (
                  <tr
                    key={p._id}
                    style={{
                      background:   idx % 2 === 0 ? '#f0fdf4' : 'white',
                      borderBottom: '1px solid #bbf7d0',
                    }}
                  >
                    <td className="px-3 py-2 font-mono text-purple-600 text-xs">
                      {p.receiptNumber || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs">
                      {new Date(p.date).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-3 py-2 text-gray-400 text-xs">
                      {new Date(p.createdAt).toLocaleTimeString('ar-EG', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold text-green-700">
                      + {p.amount?.toFixed(2)} ج.م
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs">
                      {PAY_METHOD_LABEL[p.paymentMethod] || p.paymentMethod}
                    </td>
                    <td className="px-3 py-2 text-gray-400 text-xs">{p.notes || '—'}</td>
                    <td className="px-3 py-2 text-center print:hidden">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(p)}
                          className="text-blue-500 hover:underline text-xs"
                        >
                          ✏️ تعديل
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr style={{ borderTop: '2px solid #000', background: '#dcfce7', fontWeight: 'bold' }}>
                  <td colSpan={3} className="px-3 py-2 text-right text-black font-bold">
                    إجمالي المدفوع
                  </td>
                  <td className="px-3 py-2 text-center text-black font-bold">
                    + {total.toFixed(2)} ج.م
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>

          <StatementTablePagination
            page={page}
            totalPages={totalPages}
            total={allPayments.length}
            onPageChange={onPageChange}
          />
        </>
      )}
    </div>
  );
}
