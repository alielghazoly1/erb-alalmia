// ─── components/MovementsTable.jsx ───────────────────────────────────────────
import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { fmt, fmtDate, fmtTime, TYPE_LABEL, METHOD_LABEL } from '../cashRegisterConfig';

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState({ msg }) {
  return (
    <div className="text-center py-10 text-gray-400">
      <p className="text-3xl mb-2">💸</p>
      <p>{msg}</p>
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────────────
function LoadingRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <div className="h-3 bg-gray-200 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

/**
 * MovementsTable
 * ──────────────
 * - يحسب الإشارة من direction (موجب = دخول، سالب = خروج) وليس من amount
 * - يدعم lazy loading: لما يوصل للـ sentinel يستدعي onLoadMore
 * - threshold عند 80% (يجيب البيانات قبل ما المستخدم يوصل للآخر)
 */
export default function MovementsTable({
  movements,
  emptyMsg,
  hasMore     = false,
  loadingMore = false,
  onLoadMore  = null,
  totalIn     = 0,
  totalOut    = 0,
  net         = 0,
}) {
  const sentinelRef = useRef(null);

  // Intersection Observer للـ lazy loading
  useEffect(() => {
    if (!onLoadMore || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '200px' } // يجيب البيانات 200px قبل الـ sentinel
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  if (!movements?.length) return <EmptyState msg={emptyMsg} />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-gray-600 text-xs sticky top-0 z-10">
            {['#', 'التاريخ', 'الوقت', 'النوع', 'طريقة الدفع', 'العميل', 'المرجع', 'المبلغ', 'فتح'].map((h, i) => (
              <th
                key={h}
                className={`px-3 py-2.5 font-medium ${i === 7 ? 'text-center' : 'text-right'}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100">
          {movements.map((m, idx) => {
            // الإشارة الصحيحة: direction=-1 يعني خروج (مرتجع/مصروف)
            const dir    = m.direction ?? (m.amount < 0 ? -1 : 1);
            const isOut  = dir < 0;
            const tp     = TYPE_LABEL[m.type] ?? { text: m.type, cls: 'bg-gray-100 text-gray-600', icon: '•', sign: isOut ? '-' : '+' };
            const refLink = m.referenceModel === 'SaleInvoice'   ? `/sales/${m.referenceId}`
                          : m.referenceModel === 'ReturnInvoice' ? `/returns/${m.referenceId}`
                          : null;

            return (
              <tr
                key={m._id ?? m.id ?? idx}
                className={`hover:bg-gray-50 transition-colors ${isOut ? 'bg-red-50/20' : ''}`}
              >
                <td className="px-3 py-2.5 text-gray-400 text-xs text-center">{idx + 1}</td>

                <td className="px-3 py-2.5 text-gray-600 text-xs whitespace-nowrap">
                  {fmtDate(m.date)}
                </td>

                <td className="px-3 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                  {fmtTime(m.createdAt)}
                </td>

                <td className="px-3 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${tp.cls}`}>
                    {tp.icon} {tp.text}
                  </span>
                </td>

                <td className="px-3 py-2.5 text-xs text-gray-500">
                  {METHOD_LABEL[m.paymentMethod] || m.paymentMethod || '—'}
                </td>

                <td className="px-3 py-2.5 text-xs">
                  <span className="font-medium text-gray-800">{m.customerName || m.supplierName || '—'}</span>
                  {(m.customerCode || m.supplierCode) && (
                    <span className="text-gray-400 text-xs mr-1">
                      ({m.customerCode || m.supplierCode})
                    </span>
                  )}
                </td>

                <td className="px-3 py-2.5 font-mono text-blue-600 text-xs whitespace-nowrap">
                  {m.referenceNumber || '—'}
                </td>

                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                  <span className={`font-bold text-sm ${isOut ? 'text-red-600' : 'text-green-600'}`}>
                    {isOut ? '-' : '+'}{fmt(Math.abs(m.amount))}
                  </span>
                  <span className="text-gray-400 text-xs mr-1">ج.م</span>
                </td>

                <td className="px-3 py-2.5 text-center">
                  {refLink ? (
                    <Link
                      to={refLink}
                      className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors"
                    >
                      فتح ←
                    </Link>
                  ) : '—'}
                </td>
              </tr>
            );
          })}

          {/* Loading skeleton rows */}
          {loadingMore && Array.from({ length: 3 }).map((_, i) => <LoadingRow key={`sk-${i}`} />)}
        </tbody>

        <tfoot>
          <tr className="bg-gray-50 border-t-2 border-gray-200 text-xs font-semibold text-gray-600">
            <td colSpan={7} className="px-3 py-2.5 text-right">الإجماليات</td>
            <td className="px-3 py-2.5 text-center space-y-0.5">
              <div className="text-green-600">+{fmt(totalIn)}</div>
              <div className="text-red-600">-{fmt(totalOut)}</div>
            </td>
            <td />
          </tr>
          <tr className={`font-bold text-sm ${net >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <td colSpan={7} className="px-3 py-2.5 text-right text-gray-700">الصافي</td>
            <td className={`px-3 py-2.5 text-center ${net >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {net >= 0 ? '+' : ''}{fmt(net)} ج.م
            </td>
            <td />
          </tr>
        </tfoot>
      </table>

      {/* Sentinel للـ lazy loading */}
      {hasMore && (
        <div ref={sentinelRef} className="h-10 flex items-center justify-center py-4">
          {loadingMore ? (
            <span className="text-xs text-gray-400 animate-pulse">جاري تحميل المزيد...</span>
          ) : (
            <span className="text-xs text-gray-300">↓ مرر للمزيد</span>
          )}
        </div>
      )}
    </div>
  );
}
