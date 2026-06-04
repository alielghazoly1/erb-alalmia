// ─── pages/transfers/components/TransferRow.jsx ──────────────────────────────
import { memo } from 'react';
import { Link } from 'react-router-dom';

const statusMap = {
  pending:  { text: 'معلق',   cls: 'bg-yellow-100 text-yellow-800 border border-yellow-200' },
  approved: { text: 'مُوافق', cls: 'bg-green-100 text-green-800 border border-green-200' },
  rejected: { text: 'مرفوض', cls: 'bg-red-100 text-red-800 border border-red-200' },
};

const dirMap = {
  ramses_to_october: { text: 'رمسيس → أكتوبر', cls: 'bg-blue-100 text-blue-800',   icon: '🔵' },
  october_to_ramses: { text: 'أكتوبر → رمسيس', cls: 'bg-purple-100 text-purple-800', icon: '🟣' },
  // دعم اختصارات قديمة
  R2O:               { text: 'رمسيس → أكتوبر', cls: 'bg-blue-100 text-blue-800',   icon: '🔵' },
  O2R:               { text: 'أكتوبر → رمسيس', cls: 'bg-purple-100 text-purple-800', icon: '🟣' },
};

/**
 * Props:
 *  transfer          — كائن التحويل
 *  isAdmin           — boolean
 *  onApprove         (id) => void
 *  onReject          (id) => void
 *  onDelete          (id, transferNumber) => void
 *  onReverseDelete   (id, transferNumber) => void   ← جديد: عكس وحذف المعتمد
 */
const TransferRow = memo(function TransferRow({ transfer: t, isAdmin, onApprove, onReject, onDelete, onReverseDelete }) {
  const st  = statusMap[t.status]    || statusMap.pending;
  const dir = dirMap[t.direction]    || dirMap.R2O;

  const canEdit          = t.status === 'pending' || (t.status === 'approved' && isAdmin);
  const canDelete        = isAdmin && t.status !== 'approved';
  const canReverseDelete = isAdmin && t.status === 'approved';

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 font-mono text-xs text-purple-700 whitespace-nowrap">
        {t.transferNumber}
      </td>
      <td className="px-4 py-3 font-mono font-bold text-gray-600 whitespace-nowrap">
        {t.docNumber}
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${dir.cls}`}>
          {dir.icon} {dir.text}
        </span>
      </td>
      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
        {new Date(t.date).toLocaleDateString('ar-EG')}
      </td>
      <td className="px-4 py-3 text-gray-600 text-center font-medium">
        {t.itemsCount ?? t.items?.length ?? 0}
      </td>
      <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
        {(t.totalWeight || 0).toFixed(2)} ك
      </td>
      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
        {t.createdBy?.name || '—'}
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${st.cls}`}>
          {st.text}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2 items-center flex-wrap">
          <Link
            to={`/transfers/${t._id}`}
            className="text-gray-500 hover:text-gray-700 text-xs hover:underline"
          >
            عرض
          </Link>

          {canEdit && (
            <Link
              to={`/transfers/${t._id}/edit`}
              className={`text-xs hover:underline font-medium ${
                t.status === 'approved' ? 'text-red-500' : 'text-blue-600'
              }`}
            >
              {t.status === 'approved' ? '⚠️ تعديل' : 'تعديل'}
            </Link>
          )}

          {isAdmin && t.status === 'pending' && (
            <>
              <button
                onClick={() => onApprove(t._id)}
                className="text-green-600 hover:underline text-xs font-medium"
              >
                موافقة
              </button>
              <button
                onClick={() => onReject(t._id)}
                className="text-orange-500 hover:underline text-xs"
              >
                رفض
              </button>
            </>
          )}

          {canDelete && (
            <button
              onClick={() => onDelete(t._id, t.transferNumber)}
              className="text-red-400 hover:text-red-600 hover:underline text-xs"
              title="حذف التحويل"
            >
              حذف
            </button>
          )}

          {canReverseDelete && (
            <button
              onClick={() => onReverseDelete(t._id, t.transferNumber)}
              className="text-red-600 hover:text-red-800 hover:underline text-xs font-semibold"
              title="عكس المخزون وحذف التحويل المعتمد"
            >
              ↩ عكس وحذف
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

export default TransferRow;
