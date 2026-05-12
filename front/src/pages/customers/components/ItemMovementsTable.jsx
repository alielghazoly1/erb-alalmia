// ─── components/ItemMovementsTable.jsx ──────────────────────────────────────
// جدول حركات الصنف عند العميل (مبيعات + مرتجعات مدمجة)
// المرتجع يظهر بلون مختلف وبـ prefix "-"
// ────────────────────────────────────────────────────────────────────────────
import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';

export default function ItemMovementsTable({ movements, calcTotalWeight, calcTotal }) {
  if (!movements?.length)
    return <p className="text-center text-gray-400 py-8">لا يوجد حركات لهذا الصنف</p>;

  // ── إجماليات الجدول ───────────────────────────────────────────────────────
  const sales   = movements.filter((m) => m.type === 'sale');
  const returns = movements.filter((m) => m.type === 'return');

  const totals = {
    qty:    sales.reduce((s, m) => s + (m.quantity || 0), 0),
    wt:     sales.reduce((s, m) => s + calcTotalWeight(m), 0),
    amount: sales.reduce((s, m) => s + calcTotal(m),       0),
    retQty: returns.reduce((s, m) => s + (m.quantity || 0), 0),
    retWt:  returns.reduce((s, m) => s + calcTotalWeight(m),  0),
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '2px solid #000', borderTop: '2px solid #000', background: '#f1f5f9' }}>
            {[
              '#', 'النوع', 'رقم الفاتورة', 'التاريخ',
              'الكميه', 'الوزن (كجم)', 'الإجمالي (كجم)', 'السعر', 'الإجمالي',
              'الحالة', '',
            ].map((h, i) => (
              <th
                key={i}
                className={`px-3 py-2 font-bold text-black text-xs whitespace-nowrap
                  ${i >= 4 ? 'text-center' : 'text-right'}
                  ${i === 10 ? 'print:hidden' : ''}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {movements.map((m, idx) => {
            const isSale   = m.type === 'sale';
            const tw       = calcTotalWeight(m);
            const total    = calcTotal(m);
            const rowBg    = isSale
              ? (idx % 2 === 0 ? '#f8fafc' : 'white')
              : '#fff7ed'; // برتقالي فاتح للمرتجع

            return (
              <tr key={`${m.type}-${m.invoiceId}`} style={{ background: rowBg, borderBottom: '1px solid #e2e8f0' }}>
                <td className="px-3 py-2 text-gray-400 text-xs text-center">{idx + 1}</td>

                {/* نوع الحركة */}
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    isSale ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {isSale ? '🧾 بيع' : '↩️ مرتجع'}
                  </span>
                </td>

                {/* رقم الفاتورة */}
                <td className="px-3 py-2 font-mono text-xs text-gray-600">
                  {m.docNumber || m.invoiceNumber}
                </td>

                {/* التاريخ */}
                <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                  {new Date(m.date).toLocaleDateString('ar-EG')}
                </td>

                {/* الكمية */}
                <td className="px-3 py-2 text-center font-medium">
                  {isSale ? '' : <span className="text-orange-500">-</span>}
                  {m.quantity}
                </td>

                {/* وزن الوحدة */}
                <td className="px-3 py-2 text-center text-gray-600">{Number(m.weight).toFixed(2)}</td>

                {/* إجمالي الوزن */}
                <td className="px-3 py-2 text-center font-medium">{tw.toFixed(2)}</td>

                {/* السعر */}
                <td className="px-3 py-2 text-center text-gray-700">{Number(m.price).toFixed(2)}</td>

                {/* الإجمالي */}
                <td className={`px-3 py-2 text-center font-bold ${isSale ? 'text-blue-700' : 'text-orange-600'}`}>
                  {isSale ? '' : '-'}{total.toFixed(2)}
                </td>

                {/* الحالة */}
                <td className="px-3 py-2 text-center">
                  <StatusBadge status={m.status} />
                </td>

                {/* رابط الفاتورة */}
                <td className="px-3 py-2 text-center print:hidden">
                  <Link
                    to={isSale ? `/sales/${m.invoiceId}` : `/returns/${m.invoiceId}`}
                    target="_blank"
                    className="text-blue-500 hover:underline text-xs"
                  >
                    فتح
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>

        {/* ── Footer الإجماليات ── */}
        <tfoot>
          <tr style={{ borderTop: '2px solid #000', background: '#e2e8f0', fontWeight: 'bold' }}>
            <td colSpan={4} className="px-3 py-2 text-right text-black font-bold">
              إجمالي المبيعات
            </td>
            <td className="px-3 py-2 text-center">{totals.qty}</td>
            <td className="px-3 py-2 text-center">—</td>
            <td className="px-3 py-2 text-center">{totals.wt.toFixed(2)}</td>
            <td className="px-3 py-2 text-center">—</td>
            <td className="px-3 py-2 text-center text-blue-700">{totals.amount.toFixed(2)}</td>
            <td colSpan={2} />
          </tr>
          {returns.length > 0 && (
            <tr style={{ background: '#fff7ed', fontWeight: 'bold' }}>
              <td colSpan={4} className="px-3 py-2 text-right text-orange-700 font-bold">
                إجمالي المرتجعات
              </td>
              <td className="px-3 py-2 text-center text-orange-600">- {totals.retQty}</td>
              <td className="px-3 py-2 text-center">—</td>
              <td className="px-3 py-2 text-center text-orange-600">- {totals.retWt.toFixed(2)}</td>
              <td className="px-3 py-2 text-center">—</td>
              <td className="px-3 py-2 text-center text-orange-600">
                - {returns.reduce((s, m) => s + calcTotal(m), 0).toFixed(2)}
              </td>
              <td colSpan={2} />
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  );
}
