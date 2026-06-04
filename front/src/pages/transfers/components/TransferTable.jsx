// ─── pages/transfers/components/TransferTable.jsx ────────────────────────────
import TransferRow from './TransferRow';

/**
 * Props:
 *  transfers     — مصفوفة التحويلات
 *  loading       — تحميل أولي
 *  loadingMore   — تحميل infinite scroll
 *  sentinelRef   — ref لعنصر الـ sentinel
 *  isAdmin
 *  activeFiltersCount
 *  onClearFilters
 *  onApprove / onReject / onDelete / onReverseDelete
 */
export default function TransferTable({
  transfers,
  loading,
  loadingMore,
  sentinelRef,
  isAdmin,
  activeFiltersCount,
  onClearFilters,
  onApprove,
  onReject,
  onDelete,
  onReverseDelete,
}) {
  const totalWeight = transfers.reduce((s, t) => s + (t.totalWeight || 0), 0);

  if (loading) {
    return (
      <div className="card">
        <div className="text-center py-16 text-gray-400">
          <p className="text-3xl mb-2">⏳</p>
          <p>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!transfers.length) {
    return (
      <div className="card">
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-lg font-medium text-gray-500">مفيش تحويلات</p>
          {activeFiltersCount > 0 && (
            <button onClick={onClearFilters} className="mt-2 text-sm text-blue-600 hover:underline">
              امسح الفلاتر لعرض الكل
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-gray-600 border-b border-gray-100">
            {['رقم الإذن', 'رقم المستند', 'الاتجاه', 'التاريخ', 'الأصناف', 'الوزن الكلي', 'بواسطة', 'الحالة', 'إجراءات'].map(h => (
              <th key={h} className="text-right px-4 py-3 font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {transfers.map(t => (
            <TransferRow
              key={t._id}
              transfer={t}
              isAdmin={isAdmin}
              onApprove={onApprove}
              onReject={onReject}
              onDelete={onDelete}
              onReverseDelete={onReverseDelete}
            />
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 border-t border-gray-200 font-semibold text-sm">
            <td colSpan={4} className="px-4 py-3 text-right text-gray-500">
              الإجمالي ({transfers.length} تحويل)
            </td>
            <td />
            <td className="px-4 py-3 text-gray-800 whitespace-nowrap">
              {totalWeight.toFixed(2)} ك
            </td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>

      {/* ── Sentinel للـ infinite scroll ─────────────────────────────────── */}
      <div ref={sentinelRef} className="h-4" aria-hidden="true" />

      {/* ── Loading More Spinner ──────────────────────────────────────────── */}
      {loadingMore && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-400 border-t border-gray-100">
          <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          جاري تحميل المزيد...
        </div>
      )}
    </div>
  );
}
