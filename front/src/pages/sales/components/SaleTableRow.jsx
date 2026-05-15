import { toNum } from '../../../utils/fmt';
// ─── components/SaleTableRow.jsx ──────────────────────────────────────────────
// ✅ onView: فتح في Modal (نفس الصفحة) بدل Link خارجي
import SaleStatusBadge from './SaleStatusBadge';

const warehouseLabel = { ramses: 'رمسيس', october: 'أكتوبر' };

export default function SaleTableRow({ inv, isAdmin, onApprove, onSuspend, onCancel, onView }) {
  return (
    <tr className="hover:bg-blue-50/30 transition-colors group">
      {/* رقم الفاتورة */}
      <td className="px-4 py-3">
        <span className="font-mono font-bold text-blue-700 text-sm">{inv.invoiceNumber}</span>
      </td>
      {/* رقم المستند */}
      <td className="px-4 py-3 text-gray-500 text-xs font-mono">{inv.docNumber}</td>
      {/* العميل */}
      <td className="px-4 py-3">
        <span className="font-medium text-gray-800">{inv.customerName}</span>
      </td>
      {/* التاريخ */}
      <td className="px-4 py-3 text-gray-500 text-xs">
        {new Date(inv.date).toLocaleDateString('ar-EG')}
      </td>
      {/* بواسطة */}
      <td className="px-4 py-3 text-gray-400 text-xs">{inv.createdBy?.name || '—'}</td>
      {/* المخزن */}
      <td className="px-4 py-3">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          inv.warehouse === 'ramses'
            ? 'bg-blue-50 text-blue-600'
            : 'bg-purple-50 text-purple-600'
        }`}>
          {warehouseLabel[inv.warehouse] || inv.warehouse}
        </span>
      </td>
      {/* الإجمالي */}
      <td className="px-4 py-3 font-bold text-gray-800">
        {toNum(inv.totalAmount).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
      </td>
      {/* الحالة */}
      <td className="px-4 py-3 text-center">
        <SaleStatusBadge status={inv.status} />
      </td>
      {/* الإجراءات */}
      <td className="px-4 py-3">
        <div className="flex gap-1.5 items-center justify-center flex-wrap">
          {/* عرض — Modal بدل Link */}
          {['pending', 'approved', 'suspended'].includes(inv.status) && (
            <button
              onClick={() => onView(inv._id)}
              className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1 rounded-lg font-medium transition-colors border border-blue-200"
            >
              عرض ←
            </button>
          )}
          {isAdmin && inv.status === 'pending' && (
            <button onClick={() => onApprove(inv._id)}
              className="text-xs bg-green-50 text-green-600 hover:bg-green-100 px-2.5 py-1 rounded-lg font-medium transition-colors border border-green-200">
              موافقة
            </button>
          )}
          {isAdmin && inv.status === 'pending' && (
            <button onClick={() => onSuspend(inv._id)}
              className="text-xs bg-orange-50 text-orange-500 hover:bg-orange-100 px-2.5 py-1 rounded-lg font-medium transition-colors border border-orange-200">
              تعليق
            </button>
          )}
          {['pending', 'suspended'].includes(inv.status) && (
            <button onClick={() => onCancel(inv._id)}
              className="text-xs bg-red-50 text-red-500 hover:bg-red-100 px-2.5 py-1 rounded-lg font-medium transition-colors border border-red-200">
              إلغاء
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
