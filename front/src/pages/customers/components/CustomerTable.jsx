// ─── CustomerTable.jsx ───────────────────────────────────────────────────────
// جدول عرض العملاء مع footer الإجماليات وزراير الإجراءات
// مُحسَّن للأداء مع 10,000+ عميل عبر الـ pagination في useCustomerFilters
// ────────────────────────────────────────────────────────────────────────────
import { Link } from 'react-router-dom';
import { fmt } from '../customerUtils';
import Pagination from './Pagination';

export default function CustomerTable({
  paginated, // الصفوف المعروضة في الصفحة الحالية
  filtered, // كل النتائج بعد الفلترة (للعدد)
  totals, // { balance, sales, paid }
  page,
  totalPages,
  setPage,
  isAdmin,
  onStatement, // فتح موديل كشف الحساب السريع
  onEdit,
  onDelete,
  onEditBalance, // فتح موديل تعديل الرصيد الابتدائي
}) {
  if (paginated.length === 0)
    return (
      <div className="text-center py-12 text-gray-400">
        مفيش عملاء بهذه الفلاتر
      </div>
    );

  // إجماليات المستحق عليه والمستحق له من الـ filtered
  const totalOwedByCustomer = filtered.reduce(
    (s, c) => s + Math.max(0, c.balance || 0),
    0,
  );
  const totalOwedToCustomer = filtered.reduce(
    (s, c) => s + Math.max(0, -(c.balance || 0)),
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
                'التليفون',
                'العنوان / ملاحظات',
               
                'إجمالي المبيعات',
                'المدفوعات',
                'المستحق له',
                'المستحق عليه',
                'إجراءات',
              ].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {paginated.map((c) => (
              <CustomerRow
                key={c._id}
                customer={c}
                isAdmin={isAdmin}
                onStatement={onStatement}
                onEdit={onEdit}
                onDelete={onDelete}
                onEditBalance={onEditBalance}
              />
            ))}
          </tbody>

          {/* ── Footer الإجماليات ── */}
          <tfoot>
            <tr className="bg-gray-100 font-semibold text-sm">
              <td colSpan={4} className="px-4 py-2.5 text-right text-gray-600">
                الإجمالي ({filtered.length} عميل)
              </td>
              <td className="px-4 py-2.5 text-center text-gray-700">
                {fmt(totals.sales)}
              </td>
              <td className="px-4 py-2.5 text-center text-green-700">
                {fmt(totals.paid)}
              </td>
              {/* المستحق له = دفع زيادة (balance سالب) */}
              <td className="px-4 py-2.5 text-center text-blue-700">
                {fmt(totalOwedToCustomer)}
              </td>
              {/* المستحق عليه = عليه فلوس (balance موجب) */}
              <td className="px-4 py-2.5 text-center text-red-600">
                {fmt(totalOwedByCustomer)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Pagination ── */}
      <Pagination
        page={page}
        totalPages={totalPages}
        total={filtered.length}
        onPageChange={setPage}
      />
    </>
  );
}

// ─── صف واحد في الجدول ───────────────────────────────────────────────────────
function CustomerRow({
  customer: c,
  isAdmin,
  onStatement,
  onEdit,
  onDelete,
  onEditBalance,
}) {
  const balance = c.balance || 0;

  // balance موجب = عليه فلوس (مستحق عليه)
  // balance سالب = دفع زيادة (مستحق له) — نعرضه كموجب في الخانة دي
  const owedByCustomer = balance > 0 ? balance : 0;
  const owedToCustomer = balance < 0 ? -balance : 0;

  return (
    <tr className="hover:bg-gray-50">
      {/* الكود */}
      <td className="px-4 py-3 font-mono font-medium text-blue-600">
        {c.code}
      </td>

      {/* الاسم */}
      <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>

      {/* التليفون */}
      <td className="px-4 py-3 text-gray-500">{c.phone || '—'}</td>
      {/* العنوان والملاحظات */}
      <td className="px-4 py-3 text-gray-500">
        {c.address || '—'}
      </td>

      {/* نوع العميل
      <td className="px-4 py-3">
        <span
          className={`text-xs px-2 py-1 rounded-full font-medium ${typeClass(c.type)}`}
        >
          {typeLabel(c.type)}
        </span>
      </td> */}

      {/* إجمالي المبيعات */}
      <td className="px-4 py-3 text-center text-gray-700">
        {fmt(c.totalSales)}
      </td>

      {/* المدفوعات */}
      <td className="px-4 py-3 text-center text-green-600">
        {fmt(c.totalPaid)}
      </td>

      {/* المستحق له — دفع زيادة (balance سالب في الـ DB) */}
      <td className="px-4 py-3 text-center">
        {owedToCustomer > 0 ? (
          <span className="font-bold text-blue-600">{fmt(owedToCustomer)}</span>
        ) : (
          <span className="text-black-700">0</span>
        )}
      </td>

      {/* المستحق عليه — عليه فلوس (balance موجب) */}
      <td className="px-4 py-3 text-center">
        {owedByCustomer > 0 ? (
          <span className="font-bold text-red-600">{fmt(owedByCustomer)}</span>
        ) : (
          <span className="text-black-700">0</span>
        )}
      </td>

      {/* إجراءات */}
      <td className="px-4 py-3">
        <div className="flex gap-2 flex-wrap items-center">
          {/* كشف حساب سريع داخل الصفحة */}
          <button
            onClick={() => onStatement(c)}
            className="text-purple-600 hover:underline text-xs"
          >
            كشف سريع
          </button>

          {/* كشف كامل — صفحة منفصلة مع customerId في URL */}
          <Link
            to={`/customers/statement?customerId=${c._id}&customerName=${encodeURIComponent(c.name)}`}
            className="text-blue-500 hover:underline text-xs font-medium"
          >
            كشف كامل ↗
          </Link>

          {/* أدمن فقط */}
          {isAdmin && (
            <>
              <button
                onClick={() => onEdit(c)}
                className="text-blue-600 hover:underline text-xs"
              >
                تعديل
              </button>
              {/* تعديل الرصيد الابتدائي */}
              <button
                onClick={() => onEditBalance(c)}
                className="text-amber-600 hover:bg-amber-50 hover:text-amber-700 text-xs px-2 py-0.5 rounded border border-amber-200 transition-colors"
                title="تعديل الرصيد الابتدائي"
              >
                💰 رصيد
              </button>
              {/* <button
                onClick={() => onDelete(c._id)}
                className="text-red-500 hover:underline text-xs"
              >
                حذف
              </button> */}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
