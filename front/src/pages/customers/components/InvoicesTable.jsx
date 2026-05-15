// ─── components/InvoicesTable.jsx ───────────────────────────────────────────
// جدول الفواتير داخل كشف الحساب
// يدعم الطباعة — أعمدة "فتح" مخفية في print
// ────────────────────────────────────────────────────────────────────────────
import { Link } from 'react-router-dom';
import { toNum } from '../../../utils/fmt';
import StatusBadge from './StatusBadge';
import SectionHeader from './SectionHeader';
import StatementTablePagination from './StatementTablePagination';

const HEADERS = ['#', 'رقم الفاتورة', 'التاريخ', 'الوقت', 'الإجمالي', 'الحالة', 'فتح'];

export default function InvoicesTable({
  invoices,   // الصفحة الحالية من الفواتير
  allInvoices,// كل الفواتير (للإجمالي والعدد)
  page, totalPages, onPageChange,
  backToStatement, // رابط الرجوع لكشف الحساب
}) {
  const total = allInvoices.reduce((s, inv) => s + (inv.totalAmount || 0), 0);

  return (
    <div className="card mb-4 print:shadow-none print:border">
      <SectionHeader
        title="🧾 الفواتير"
        count={allInvoices.length}
        total={`${total.toFixed(2)} ج.م`}
        totalColor="text-blue-700"
      />

      {allInvoices.length === 0 ? (
        <p className="text-center text-gray-400 py-4">لا يوجد فواتير</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '2px solid #000', borderTop: '2px solid #000', background: '#f1f5f9' }}>
                  {HEADERS.map((h, i) => (
                    <th
                      key={h}
                      className={`px-3 py-2 font-bold text-black text-xs
                        ${i === 0 || i >= 4 ? 'text-center' : 'text-right'}
                        ${i === 6 ? 'print:hidden' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {invoices.map((inv, idx) => (
                  <tr
                    key={inv._id}
                    style={{
                      background:   idx % 2 === 0 ? '#f8fafc' : 'white',
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    <td className="px-3 py-2 text-gray-400 text-center text-xs">{idx + 1}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">
                      {inv.docNumber || inv.invoiceNumber}
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs">
                      {new Date(inv.date).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-3 py-2 text-gray-400 text-xs">
                      {new Date(inv.createdAt).toLocaleTimeString('ar-EG', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold text-gray-800">
                      {toNum(inv.totalAmount).toFixed(2)()}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-3 py-2 text-center print:hidden">
                      <Link
                        to={`/sales/${inv._id}`}
                        state={backToStatement ? { backTo: backToStatement, backLabel: 'كشف العميل' } : undefined}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        ←
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr style={{ borderTop: '2px solid #000', background: '#e2e8f0', fontWeight: 'bold' }}>
                  <td colSpan={5} className="px-3 py-2 text-right text-black font-bold">
                    الإجمالي
                  </td>
                  <td className="px-3 py-2 text-center text-black font-bold">
                    {total.toFixed(2)} ج.م
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          <StatementTablePagination
            page={page}
            totalPages={totalPages}
            total={allInvoices.length}
            onPageChange={onPageChange}
          />
        </>
      )}
    </div>
  );
}
