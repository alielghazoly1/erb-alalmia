// ─── components/OrderRow.jsx ──────────────────────────────────────────────────
//  ✅ بيعرض docNumber بدل orderNumber في الجدول
//  ✅ orderNumber بيتخفى (بس موجود للـ expand والطباعة)
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Link } from 'react-router-dom';
import { fmt, STATUS, WH, sumWeight } from '../manufacturingConfig';

export default function OrderRow({
  order, isAdmin, expanded, onToggle,
  onApprove, onReject, onPrint, onWorkerClick,
}) {
  const st    = STATUS[order.status];
  const rawWt = sumWeight(order.rawMaterials);
  const outWt = sumWeight(order.outputProducts);

  return (
    <div className="card">

      {/* ── Row header ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between cursor-pointer gap-2"
        onClick={onToggle}
      >
        {/* Left side */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">

          {/* رقم المستند — العنصر الرئيسي */}
          {order.docNumber ? (
            <span className="font-mono font-bold text-gray-800 text-sm shrink-0">
              #{order.docNumber}
            </span>
          ) : (
            <span className="font-mono text-xs text-gray-400 italic shrink-0">
              بدون مستند
            </span>
          )}

          {/* التاريخ */}
          <span className="text-gray-500 text-sm">
            {new Date(order.date).toLocaleDateString('ar-EG')}
          </span>

          {/* العنبر */}
          <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-100 rounded-full shrink-0">
            {WH[order.warehouse]}
          </span>

          {/* المعلم */}
          {order.workerName && (
            <button
              onClick={e => { e.stopPropagation(); onWorkerClick(); }}
              className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full hover:bg-amber-100 font-medium shrink-0"
            >
              👤 {order.workerName}
            </button>
          )}

          {/* الموسم */}
          {order.season?.name && (
            <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full shrink-0">
              {order.season.name}
            </span>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">

          {/* الأوزان */}
          <div className="hidden sm:flex gap-2 text-xs text-gray-500">
            <span className="text-orange-600">{fmt(rawWt)} ك خامات</span>
            <span>←</span>
            <span className="text-green-600">{fmt(outWt)} ك منتجات</span>
          </div>

          {/* الحالة */}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>
            {st.icon} {st.text}
          </span>

          {/* زرار تعديل */}
          {(order.status === 'pending' || (order.status === 'approved' && isAdmin)) && (
            <Link
              to={`/manufacturing/${order._id}/edit`}
              onClick={e => e.stopPropagation()}
              className={`text-xs px-2.5 py-1 rounded-lg font-medium no-print ${
                order.status === 'approved'
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              {order.status === 'approved' ? '⚠️ تعديل' : '✏️ تعديل'}
            </Link>
          )}

          {/* طباعة */}
          <button
            onClick={e => { e.stopPropagation(); onPrint(); }}
            className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg hover:bg-gray-200 no-print"
          >
            🖨️
          </button>

          {/* موافقة / رفض */}
          {isAdmin && order.status === 'pending' && (
            <div className="flex gap-1 no-print" onClick={e => e.stopPropagation()}>
              <button
                onClick={onApprove}
                className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg hover:bg-green-700"
              >
                ✓ موافقة
              </button>
              <button
                onClick={onReject}
                className="text-xs bg-red-100 text-red-600 px-2.5 py-1 rounded-lg hover:bg-red-200"
              >
                رفض
              </button>
            </div>
          )}

          <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* ── Expanded details ─────────────────────────────────────────────────── */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-100">

          {/* رقم الأمر الداخلي — يظهر هنا بس */}
          <p className="text-xs text-gray-300 mb-3 font-mono">
            رقم الأمر الداخلي: {order.orderNumber}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">

            {/* الخامات */}
            <div>
              <h3 className="text-sm font-semibold text-orange-600 mb-2 flex items-center gap-1">
                📤 الخامات
                <span className="text-xs font-normal text-gray-400">({fmt(rawWt)} كيلو)</span>
              </h3>
              <div className="space-y-1">
                {order.rawMaterials?.map((r, i) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b border-orange-50">
                    <span className="text-gray-700">{r.itemName}</span>
                    <span className="text-gray-500 text-xs">
                      {r.quantity} كرتون — <b>{fmt(r.totalWeight)} ك</b>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* المنتجات */}
            <div>
              <h3 className="text-sm font-semibold text-green-600 mb-2 flex items-center gap-1">
                📦 المنتجات
                <span className="text-xs font-normal text-gray-400">({fmt(outWt)} كيلو)</span>
              </h3>
              <div className="space-y-1">
                {order.outputProducts?.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm py-1 border-b border-green-50">
                    <span className="text-gray-700">{p.itemName}</span>
                    <span className="text-gray-500 text-xs">
                      {p.quantity} كرتون — <b>{fmt(p.totalWeight)} ك</b>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Meta */}
          <div className="flex gap-4 text-xs text-gray-400 flex-wrap">
            {order.createdBy?.name  && <span>بواسطة: {order.createdBy.name}</span>}
            {order.approvedBy?.name && <span>موافق: {order.approvedBy.name}</span>}
            {order.notes            && <span>ملاحظات: {order.notes}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
