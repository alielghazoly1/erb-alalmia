// ─── components/OrdersTable.jsx ──────────────────────────────────────────────
//  ✅ Lazy loading — preload عند 80% بدون إحساس
//  ✅ Error state مع retry
//  ✅ Loading skeleton للأوامر الجاية
//  ✅ docNumber بدل orderNumber
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';

const fmt     = (n, d = 2) => Number(n || 0).toFixed(d);
const fmtDate = (d)         => d ? new Date(d).toLocaleDateString('ar-EG') : '—';

const WH_LABEL = { ramses: 'رمسيس', october: 'أكتوبر', both: 'الاثنين' };

const STATUS_MAP = {
  pending:  { text: 'معلق',   cls: 'bg-yellow-100 text-yellow-700' },
  approved: { text: 'مُوافق', cls: 'bg-green-100  text-green-700'  },
  rejected: { text: 'مرفوض',  cls: 'bg-red-100    text-red-700'    },
};

// ─── Detail row ───────────────────────────────────────────────────────────────
function OrderDetail({ order }) {
  return (
    <tr className="bg-gray-50/80">
      <td colSpan={8} className="px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div>
            <h4 className="text-xs font-semibold text-orange-600 mb-2">📤 الخامات المصروفة</h4>
            <div className="space-y-1">
              {order.rawMaterials?.map((r, i) => (
                <div key={i} className="flex justify-between text-xs py-1 border-b border-orange-50">
                  <span className="text-gray-700">{r.itemName}</span>
                  <span className="text-gray-500">
                    {r.quantity} كرتون × {fmt(r.weight, 3)} ={' '}
                    <b className="text-orange-600">{fmt(r.totalWeight, 3)} ك</b>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-green-600 mb-2">📦 المنتجات الناتجة</h4>
            <div className="space-y-1">
              {order.outputProducts?.map((p, i) => (
                <div key={i} className="flex justify-between text-xs py-1 border-b border-green-50">
                  <span className="text-gray-700">{p.itemName}</span>
                  <span className="text-gray-500">
                    {p.quantity} كرتون × {fmt(p.weight, 3)} ={' '}
                    <b className="text-green-600">{fmt(p.totalWeight, 3)} ك</b>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {(order.notes || order.season?.name) && (
          <div className="flex gap-4 mt-3 text-xs text-gray-400 flex-wrap">
            {order.season?.name && <span>الموسم: <b className="text-gray-600">{order.season.name}</b></span>}
            {order.notes        && <span>ملاحظات: {order.notes}</span>}
          </div>
        )}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function OrdersTable({
  orders, summary,
  loading, loadingMore, hasMore, error,
  triggerIndex, sentinelCallbackRef, retry,
}) {
  const [expanded, setExpanded] = useState(null);
  const toggle = (id) => setExpanded(p => p === id ? null : id);

  // ── First load skeleton ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 bg-gray-800 text-white">
          <h3 className="font-semibold text-sm">📋 أوامر التصنيع</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-3 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-8" />
              <div className="h-3 bg-gray-200 rounded w-20" />
              <div className="h-3 bg-gray-200 rounded w-24" />
              <div className="h-3 bg-gray-200 rounded w-16" />
              <div className="h-3 bg-gray-200 rounded w-16 mr-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="card p-0 overflow-hidden">

      {/* جدول header */}
      <div className="px-4 py-3 bg-gray-800 text-white flex items-center justify-between">
        <h3 className="font-semibold text-sm">
          📋 أوامر التصنيع
          <span className="text-gray-400 font-normal mr-2">
            ({orders.length.toLocaleString('ar-EG')} محمّل
            {summary?.totalCount ? ` من ${summary.totalCount.toLocaleString('ar-EG')}` : ''})
          </span>
        </h3>
        {summary?.pendingOrders > 0 && (
          <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full">
            {summary.pendingOrders} معلق
          </span>
        )}
      </div>

      {/* empty */}
      {orders.length === 0 && !error ? (
        <div className="text-center py-10 text-gray-400">
          <p className="text-3xl mb-2">📭</p>
          <p>مفيش أوامر في الفترة دي</p>
        </div>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs border-b">
                <th className="text-right  px-4 py-2.5">#</th>
                <th className="text-right  px-4 py-2.5">رقم المستند</th>
                <th className="text-center px-4 py-2.5">التاريخ</th>
                <th className="text-center px-4 py-2.5">العنبر</th>
                <th className="text-center px-4 py-2.5">الموسم</th>
                <th className="text-center px-4 py-2.5">خامات (ك)</th>
                <th className="text-center px-4 py-2.5">منتجات (ك)</th>
                <th className="text-center px-4 py-2.5">الحالة</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {orders.map((order, idx) => {
                const st    = STATUS_MAP[order.status] || STATUS_MAP.pending;
                const rawWt = order.rawMaterials?.reduce((s, r) => s + (r.totalWeight || 0), 0) || 0;
                const outWt = order.outputProducts?.reduce((s, p) => s + (p.totalWeight || 0), 0) || 0;
                const isExp = expanded === order._id;

                return (
                  <>
                    <tr
                      key={order._id}
                      // ── الـ sentinel يُعلَّق على العنصر عند 80% ──────────
                      ref={idx === triggerIndex ? sentinelCallbackRef : undefined}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => toggle(order._id)}
                    >
                      <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>

                      <td className="px-4 py-3">
                        {order.docNumber ? (
                          <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold">
                            #{order.docNumber}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs italic">بدون</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center text-gray-600 text-xs">
                        {fmtDate(order.date)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-gray-500">
                          {WH_LABEL[order.warehouse] || order.warehouse}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">
                          {order.season?.name || '—'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-semibold text-orange-600">{fmt(rawWt, 2)}</span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-semibold text-green-700">{fmt(outWt, 2)}</span>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.cls}`}>
                          {st.text}
                        </span>
                      </td>
                    </tr>

                    {isExp && <OrderDetail key={`${order._id}-det`} order={order} />}
                  </>
                );
              })}
            </tbody>

            {/* footer إجمالي */}
            <tfoot>
              <tr className="bg-gray-800 text-white text-xs font-semibold">
                <td colSpan={5} className="px-4 py-3 text-right">
                  الإجمالي ({summary?.totalOrders ?? 0} أمر مُوافق)
                </td>
                <td className="px-4 py-3 text-center text-orange-300">
                  {fmt(summary?.totalRawWeight, 2)} ك
                </td>
                <td className="px-4 py-3 text-center text-green-300">
                  {fmt(summary?.totalOutputWeight, 2)} ك
                </td>
                <td />
              </tr>
            </tfoot>
          </table>

          {/* ── Loading more indicator ─────────────────────────────────────── */}
          {loadingMore && (
            <div className="flex items-center justify-center gap-2 py-4 border-t border-gray-100">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <span className="text-gray-400 text-sm">جاري تحميل المزيد...</span>
            </div>
          )}

          {/* ── Error state ────────────────────────────────────────────────── */}
          {error && (
            <div className="flex items-center justify-between px-4 py-3 bg-red-50 border-t border-red-200">
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
              <button
                onClick={retry}
                className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 font-medium"
              >
                ↻ إعادة المحاولة
              </button>
            </div>
          )}

          {/* ── All loaded ─────────────────────────────────────────────────── */}
          {!hasMore && !error && orders.length > 0 && (
            <p className="text-center text-xs text-gray-300 py-3 border-t border-gray-100">
              ✓ تم عرض كل الأوامر ({orders.length.toLocaleString('ar-EG')})
            </p>
          )}
        </>
      )}
    </div>
  );
}
