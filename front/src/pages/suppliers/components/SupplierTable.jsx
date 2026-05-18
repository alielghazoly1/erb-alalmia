// ─── components/SupplierTable.jsx ────────────────────────────────────────────
// جدول عرض الموردين مع footer الإجماليات وزراير الإجراءات
// نفس هيكل CustomerTable تماماً — عمودان منفصلان للمستحق له / المستحق عليه
// ────────────────────────────────────────────────────────────────────────────
import { Link } from 'react-router-dom';
import { fmt } from '../supplierUtils';
import SupplierPagination from './SupplierPagination';

export default function SupplierTable({
  paginated = [], // الصفحة الحالية — هذا ما يُعرض في الجدول
  filtered = [], // كل النتائج بعد الفلتر (للإحصاء والـ footer)
  totals,
  page,
  totalPages,
  setPage,
  isAdmin,
  onStatement,
  onEdit,
  onEditBalance,
  onDelete,
}) {
  if (paginated.length === 0)
    return (
      <div className="text-center py-12 text-gray-400">
        مفيش موردين بهذه الفلاتر
      </div>
    );

  // إجماليات المستحق عليه والمستحق له من الـ filtered (كل النتائج مش الصفحة)
  // balance موجب = عليهم فلوس (مستحق عليهم)
  // balance سالب = دفعنا زيادة (مستحق لنا)
  const totalOwedByUs = filtered.reduce(
    (s, sup) => s + Math.max(0, sup.balance || 0),
    0,
  );
  const totalOwedToUs = filtered.reduce(
    (s, sup) => s + Math.max(0, -(sup.balance || 0)),
    0,
  );

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-right">
              {[
                'الكود',
                'الاسم',
                'المرتجعات',
                'المدفوع',
                'المستحق عليه',
                'المستحق له',
                'إجراءات',
              ].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {paginated.map((s) => (
              <SupplierRow
                key={s._id}
                supplier={s}
                isAdmin={isAdmin}
                onStatement={onStatement}
                onEdit={onEdit}
                onEditBalance={onEditBalance}
                onDelete={onDelete}
              />
            ))}
          </tbody>

          {/* ── Footer الإجماليات ── */}
          <tfoot>
            <tr className="bg-gray-100 font-semibold text-sm">
              <td colSpan={2} className="px-4 py-2.5 text-right text-gray-600">
                الإجمالي ({filtered.length} مورد)
              </td>
              <td className="px-4 py-2.5 text-center text-orange-600">
                {fmt(totals?.returns || 0)}
              </td>
              <td className="px-4 py-2.5 text-center text-green-700">
                {fmt(totals?.paid || 0)}
              </td>
              {/* المستحق له = دفعنا زيادة (balance سالب) */}
              <td className="px-4 py-2.5 text-center text-blue-700">
                {fmt(totalOwedToUs)}
              </td>
              {/* المستحق عليه = عليهم فلوس (balance موجب) */}
              <td className="px-4 py-2.5 text-center text-red-600">
                {fmt(totalOwedByUs)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Pagination ── */}
      <SupplierPagination
        page={page}
        totalPages={totalPages}
        total={filtered.length}
        onPageChange={setPage}
      />
    </>
  );
}

// ─── صف واحد في الجدول ───────────────────────────────────────────────────────
function SupplierRow({
  supplier: s,
  isAdmin,
  onStatement,
  onEdit,
  onEditBalance,
  onDelete,
}) {
  const balance = s.balance || 0;

  // balance موجب = عليهم فلوس (مستحق عليهم)
  // balance سالب = دفعنا زيادة (مستحق لنا) — نعرضه كموجب في الخانة دي
  const owedByUs = balance > 0 ? balance : 0;
  const owedToUs = balance < 0 ? -balance : 0;

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 font-mono font-medium text-blue-600">
        {s.code}
      </td>
      <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
      {/* <td className="px-4 py-3 text-center text-gray-700">{fmt(s.totalPurchases)}</td> */}
      <td className="px-4 py-3 text-center text-orange-600">
        {fmt(s.totalReturns)}
      </td>
      <td className="px-4 py-3 text-center text-green-600">
        {fmt(s.totalPaid)}
      </td>

      {/* المستحق له — دفعنا زيادة (balance سالب في الـ DB) */}
      <td className="px-4 py-3 text-center">
        {owedToUs > 0 ? (
          <span className="font-bold text-blue-600">{fmt(owedToUs)}</span>
        ) : (
          <span className="text-gray-800">0</span>
        )}
      </td>

      {/* المستحق عليه — عليهم فلوس (balance موجب) */}
      <td className="px-4 py-3 text-center">
        {owedByUs > 0 ? (
          <span className="font-bold text-red-600">{fmt(owedByUs)}</span>
        ) : (
          <span className="text-gray-800">0</span>
        )}
      </td>

      {/* إجراءات */}
      <td className="px-4 py-3">
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => onStatement(s)}
            className="text-purple-600 hover:underline text-xs"
          >
            كشف سريع
          </button>
          <Link
            to={`/suppliers/statement?supplierId=${s._id}&supplierName=${encodeURIComponent(s.name)}`}
            className="text-blue-500 hover:underline text-xs font-medium"
          >
            كشف كامل ↗
          </Link>
          {isAdmin && (
            <>
              <button
                onClick={() => onEdit(s)}
                className="text-blue-600 hover:underline text-xs"
              >
                تعديل
              </button>
              <button
                onClick={() => onEditBalance(s)}
                className="text-amber-600 hover:bg-amber-50 hover:text-amber-700 text-xs px-2 py-0.5 rounded border border-amber-200 transition-colors"
                title="تعديل الرصيد الابتدائي"
              >
                💰 رصيد
              </button>
              {/* <button onClick={() => onDelete(s._id)} className="text-red-500 hover:underline text-xs">حذف</button> */}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
