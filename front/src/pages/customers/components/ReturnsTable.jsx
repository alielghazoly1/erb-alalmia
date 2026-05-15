// ─── components/ReturnsTable.jsx ────────────────────────────────────────────
// جدول المرتجعات داخل كشف الحساب
// ────────────────────────────────────────────────────────────────────────────
import { Link } from 'react-router-dom';
import { toNum } from '../../../utils/fmt';
import SectionHeader from './SectionHeader';
import StatementTablePagination from './StatementTablePagination';

export default function ReturnsTable({
  returns,    // الصفحة الحالية
  allReturns, // كل المرتجعات
  page, totalPages, onPageChange,
}) {
  if (allReturns.length === 0) return null;

  const total = allReturns.reduce((s, r) => s + (r.totalAmount || 0), 0);

  return (
    <div className="card mb-4 print:shadow-none print:border">
      <SectionHeader
        title="↩️ المرتجعات"
        count={allReturns.length}
        total={`- ${total.toFixed(2)} ج.م`}
        totalColor="text-orange-600"
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '2px solid #000', borderTop: '2px solid #000', background: '#fff7ed' }}>
              {['رقم المرتجع', 'التاريخ', 'المبلغ', ''].map((h, i) => (
                <th
                  key={i}
                  className={`px-3 py-2 font-bold text-black text-xs ${i === 2 ? 'text-center' : 'text-right'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {returns.map((r, idx) => (
              <tr
                key={r._id}
                style={{
                  background:   idx % 2 === 0 ? '#fff7ed' : 'white',
                  borderBottom: '1px solid #fed7aa',
                }}
              >
                <td className="px-3 py-2 font-mono text-orange-600 text-xs">
                  <Link to={`/returns/${r._id}`} className="hover:underline">
                    {r.invoiceNumber}
                  </Link>
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs">
                  {new Date(r.date).toLocaleDateString('ar-EG')}
                </td>
                <td className="px-3 py-2 text-center text-orange-600 font-medium">
                  - {toNum(r.totalAmount).toFixed(2)()}
                </td>
                <td className="px-3 py-2 text-center print:hidden">
                  <div className="flex gap-1 justify-center">
                    <Link to={`/returns/${r._id}`} className="text-xs text-blue-600 hover:underline">
                      فتح
                    </Link>
                    {r.status === 'pending' && (
                      <Link
                        to={`/returns/customer/${r._id}/edit`}
                        className="text-xs text-amber-600 hover:underline mr-1"
                      >
                        تعديل
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <StatementTablePagination
        page={page}
        totalPages={totalPages}
        total={allReturns.length}
        onPageChange={onPageChange}
      />
    </div>
  );
}
