// ─── pages/purchase/components/PurchaseTableRow.jsx ─────────────────────────
import React, { memo } from 'react';
import { Link } from 'react-router-dom';

const STATUS_LABEL = {
  pending:   { text: 'معلق',   cls: 'bg-yellow-100 text-yellow-700' },
  approved:  { text: 'مُوافق', cls: 'bg-green-100 text-green-700' },
  suspended: { text: 'موقوف', cls: 'bg-orange-100 text-orange-700' },
  cancelled: { text: 'ملغي',  cls: 'bg-red-100 text-red-700' },
};

const WAREHOUSE_LABEL = { ramses: 'رمسيس', october: 'أكتوبر' };

const PurchaseTableRow = memo(function PurchaseTableRow({
  inv,
  isAdmin,
  onApprove,
  onSuspend,
  onCancel,
  preloadRef,
}) {
  const st = STATUS_LABEL[inv.status] || STATUS_LABEL.pending;

  return (
    <tr
      ref={preloadRef || null}
      className="hover:bg-gray-50 transition-colors"
    >
      <td className="px-4 py-3 font-mono font-medium text-blue-600">
        {inv.invoiceNumber}
      </td>
      <td className="px-4 py-3 text-gray-600">{inv.docNumber}</td>
      <td className="px-4 py-3 font-medium text-gray-800">{inv.supplierName}</td>
      <td className="px-4 py-3 text-gray-500 text-xs">
        {new Date(inv.date).toLocaleDateString('ar-EG')}
      </td>
      <td className="px-4 py-3 text-gray-500 text-xs">
        {WAREHOUSE_LABEL[inv.warehouse] ?? inv.warehouse}
      </td>
      <td className="px-4 py-3 font-medium text-gray-800">
        {inv.totalAmount?.toLocaleString('ar-EG', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}{' '}
        ج.م
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${st.cls}`}>
          {st.text}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2 flex-wrap">
          <Link
            to={`/purchase/${inv._id}`}
            className="text-blue-600 hover:underline text-xs font-medium"
          >
            عرض ←
          </Link>
          {isAdmin && inv.status === 'pending' && (
            <button
              onClick={() => onApprove(inv._id)}
              className="text-green-600 hover:underline text-xs"
            >
              موافقة
            </button>
          )}
          {inv.status === 'pending' && (
            <button
              onClick={() => onSuspend(inv._id)}
              className="text-orange-500 hover:underline text-xs"
            >
              تعليق
            </button>
          )}
          {inv.status !== 'approved' && inv.status !== 'cancelled' && (
            <button
              onClick={() => onCancel(inv._id)}
              className="text-red-500 hover:underline text-xs"
            >
              إلغاء
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

export default PurchaseTableRow;
