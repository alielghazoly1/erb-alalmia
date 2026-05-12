// ─── pages/purchase/components/PurchaseTable.jsx ────────────────────────────
import React from 'react';
import PurchaseTableRow from './PurchaseTableRow';
import PurchaseLoadingSpinner from './PurchaseLoadingSpinner';

export default function PurchaseTable({
  list,
  isAdmin,
  onApprove,
  onSuspend,
  onCancel,
  loadingMore,
  hasMore,
  sentinelRef,
  preloadRef,
  preloadIndex,
}) {
  const approvedTotal = list
    .filter((i) => i.status === 'approved')
    .reduce((s, i) => s + (i.totalAmount || 0), 0);

  const hasApproved = list.some((i) => i.status === 'approved');

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-gray-600">
            <th className="text-right px-4 py-3 font-medium">رقم الفاتورة</th>
            <th className="text-right px-4 py-3 font-medium">رقم المستند</th>
            <th className="text-right px-4 py-3 font-medium">المورد</th>
            <th className="text-right px-4 py-3 font-medium">التاريخ</th>
            <th className="text-right px-4 py-3 font-medium">المخزن</th>
            <th className="text-right px-4 py-3 font-medium">الإجمالي</th>
            <th className="text-right px-4 py-3 font-medium">الحالة</th>
            <th className="text-right px-4 py-3 font-medium">إجراءات</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {list.map((inv, index) => (
            <PurchaseTableRow
              key={inv._id}
              inv={inv}
              isAdmin={isAdmin}
              onApprove={onApprove}
              onSuspend={onSuspend}
              onCancel={onCancel}
              // ضع الـ ref على الـ row عند 80%
              preloadRef={index === preloadIndex ? preloadRef : null}
            />
          ))}
        </tbody>

        {hasApproved && (
          <tfoot>
            <tr className="bg-blue-50 font-semibold text-sm">
              <td colSpan={5} className="px-4 py-2.5 text-right text-gray-600">
                إجمالي الموافق عليه
              </td>
              <td className="px-4 py-2.5 text-blue-700">
                {approvedTotal.toLocaleString('ar-EG', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                ج.م
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        )}
      </table>

      {/* Sentinel — نقطة النهاية للـ IntersectionObserver */}
      <div ref={sentinelRef} className="h-1" aria-hidden="true" />

      {/* مؤشر تحميل أسفل القائمة */}
      {loadingMore && <PurchaseLoadingSpinner />}

      {/* نهاية القائمة */}
      {!hasMore && list.length > 0 && (
        <p className="text-center text-xs text-gray-400 py-4">
          — تم عرض جميع الفواتير ({list.length.toLocaleString('ar-EG')}) —
        </p>
      )}
    </div>
  );
}
