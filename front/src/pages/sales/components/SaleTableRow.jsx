// components/SaleTableRow.jsx
import { Link } from 'react-router-dom';
import SaleStatusBadge from './SaleStatusBadge';

export default function SaleTableRow({ inv, isAdmin, onApprove, onSuspend, onCancel }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 text-gray-600">{inv.docNumber}</td>
      <td className="px-4 py-3 font-medium text-gray-800">{inv.customerName}</td>
      <td className="px-4 py-3 text-gray-500 text-xs">
        {new Date(inv.date).toLocaleDateString('ar-EG')}
      </td>
      <td className="px-4 py-3 text-gray-500 text-xs">{inv.createdBy?.name}</td>
      <td className="px-4 py-3 text-gray-500 text-xs">
        {inv.warehouse === 'ramses' ? 'رمسيس' : 'أكتوبر'}
      </td>
      <td className="px-4 py-3 font-medium text-gray-800">
        {inv.totalAmount?.toFixed(2)} ج.م
      </td>
      <td className="px-4 py-3">
        <SaleStatusBadge status={inv.status} />
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2 flex-wrap">
          {isAdmin && inv.status === 'pending' && (
            <button
              onClick={() => onApprove(inv._id)}
              className="text-green-600 hover:underline text-xs"
            >موافقة</button>
          )}
          {isAdmin && inv.status === 'pending' && (
            <button
              onClick={() => onSuspend(inv._id)}
              className="text-orange-500 hover:underline text-xs"
            >تعليق</button>
          )}
          {['pending', 'suspended'].includes(inv.status) && (
            <button
              onClick={() => onCancel(inv._id)}
              className="text-red-500 hover:underline text-xs"
            >إلغاء</button>
          )}
          {['pending', 'approved', 'suspended'].includes(inv.status) && (
            <Link
              to={`/sales/${inv._id}`}
              className="text-blue-600 hover:underline text-xs font-medium"
            >عرض ←</Link>
          )}
        </div>
      </td>
    </tr>
  );
}
