// ─── pages/returns/ReturnsListPage.jsx ───────────────────────────────────────
import { useEffect, useRef, useState, useCallback } from 'react';
import { useDispatch, useSelector }                 from 'react-redux';
import { Link }                                     from 'react-router-dom';
import toast                                        from 'react-hot-toast';

import {
  fetchReturns,
  fetchMoreReturns,
  approveReturn,
  rejectReturn,
} from '../../store/slices/returnSlice';

// ── Maps ────────────────────────────────────────────────────────────────────
const STATUS_MAP = {
  pending:  { text: 'معلق',    cls: 'bg-yellow-100 text-yellow-700' },
  approved: { text: 'مُوافق', cls: 'bg-green-100 text-green-700'   },
  rejected: { text: 'مرفوض',  cls: 'bg-red-100 text-red-700'       },
};

const TYPE_MAP = {
  customer_return: { text: 'مرتجع عميل', cls: 'bg-orange-100 text-orange-700' },
  supplier_return: { text: 'مرتجع مورد', cls: 'bg-blue-100 text-blue-700'     },
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('ar-EG') : '—');
const fmtAmt  = (v) => Number(v || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Loading skeleton ────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 bg-gray-200 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function ReturnsListPage() {
  const dispatch = useDispatch();
  const {
    list, total, hasMore, nextCursor, loading, loadingMore,
  } = useSelector((s) => s.returns);
  const { user } = useSelector((s) => s.auth);
  const isAdmin  = user?.role === 'admin';

  const [search,       setSearch]       = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const sentinelRef = useRef(null);

  // ── أول تحميل أو عند تغيير الفلاتر ────────────────────────────────────
  useEffect(() => {
    dispatch(fetchReturns({ type: filterType, status: filterStatus, search }));
  }, [dispatch, filterType, filterStatus, search]);

  // ── lazy loading بـ IntersectionObserver ───────────────────────────────
  const loadMore = useCallback(() => {
    if (!hasMore || !nextCursor || loadingMore || loading) return;
    dispatch(fetchMoreReturns({
      type:   filterType,
      status: filterStatus,
      search,
      cursor: nextCursor,
    }));
  }, [dispatch, hasMore, nextCursor, loadingMore, loading, filterType, filterStatus, search]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { threshold: 0.1, rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const handleApprove = async (id) => {
    if (!window.confirm('هتوافق على المرتجع وتحدث المخزن والخزنة؟')) return;
    const res = await dispatch(approveReturn(id));
    if (!res.error) toast.success('تم الموافقة وتحديث المخزن والخزنة ✅');
    else            toast.error(res.payload || 'خطأ في الموافقة');
  };

  const handleReject = async (id) => {
    if (!window.confirm('هترفض المرتجع ده؟')) return;
    const res = await dispatch(rejectReturn(id));
    if (!res.error) toast.success('تم الرفض');
    else            toast.error(res.payload || 'خطأ في الرفض');
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">المرتجعات</h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? '...' : `${(total ?? list.length).toLocaleString('ar-EG')} مرتجع`}
            {list.length > 0 && total > list.length && (
              <span className="text-orange-500 mr-1">
                — عارض {list.length.toLocaleString('ar-EG')}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/returns/customer/new" className="btn-primary">+ مرتجع عميل</Link>
          <Link to="/returns/supplier/new" className="btn-secondary">+ مرتجع مورد</Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-4 flex gap-3 flex-wrap">
        <input
          className="input-field flex-1 min-w-48"
          placeholder="بحث برقم المرتجع أو الاسم..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input-field w-auto"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">كل الأنواع</option>
          <option value="customer_return">مرتجع عميل</option>
          <option value="supplier_return">مرتجع مورد</option>
        </select>
        <select
          className="input-field w-auto"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">كل الحالات</option>
          <option value="pending">معلق</option>
          <option value="approved">مُوافق</option>
          <option value="rejected">مرفوض</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        {loading && !list.length ? (
          // حالة التحميل الأولي — skeleton كامل
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs">
                {['الرقم','النوع','الاسم','التاريخ','الإجمالي','الحالة','إجراءات'].map(h => (
                  <th key={h} className="text-right px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
            </tbody>
          </table>
        ) : !list.length ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-3xl mb-2">📦</p>
            <p>مفيش مرتجعات</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs sticky top-0 z-10">
                {['الرقم','النوع','الاسم','التاريخ','الإجمالي','الحالة','إجراءات'].map(h => (
                  <th key={h} className="text-right px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {list.map((ret) => {
                const id   = ret._id ?? ret.id;
                const st   = STATUS_MAP[ret.status]  ?? { text: ret.status,  cls: 'bg-gray-100 text-gray-600' };
                const tp   = TYPE_MAP[ret.type]       ?? { text: ret.type,    cls: 'bg-gray-100 text-gray-600' };
                const name = ret.customerName || ret.supplierName || '—';

                const canEdit =
                  ret.status === 'pending' ||
                  (ret.status === 'approved' && isAdmin);

                const editPath = `/returns/${
                  ret.type === 'customer_return' ? 'customer' : 'supplier'
                }/${id}/edit`;

                return (
                  <tr key={id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-orange-600 whitespace-nowrap">
                      {ret.invoiceNumber}
                    </td>

                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${tp.cls}`}>
                        {tp.text}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-medium text-gray-800 max-w-[180px] truncate">
                      {name}
                    </td>

                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {fmtDate(ret.date)}
                    </td>

                    <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                      {fmtAmt(ret.totalAmount)} ج.م
                    </td>

                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${st.cls}`}>
                        {st.text}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap items-center">
                        {canEdit && (
                          <Link
                            to={editPath}
                            className={`text-xs font-medium hover:underline ${
                              ret.status === 'approved' ? 'text-red-500' : 'text-blue-600'
                            }`}
                          >
                            {ret.status === 'approved' ? '⚠️ تعديل' : 'تعديل'}
                          </Link>
                        )}
                        <Link to={`/returns/${id}`} className="text-gray-600 hover:underline text-xs">
                          عرض
                        </Link>
                        {isAdmin && ret.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(id)}
                              className="text-green-600 hover:underline text-xs"
                            >
                              موافقة ✅
                            </button>
                            <button
                              onClick={() => handleReject(id)}
                              className="text-red-500 hover:underline text-xs"
                            >
                              رفض
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* Skeleton rows أثناء تحميل المزيد */}
              {loadingMore && Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={`sk-${i}`} />)}
            </tbody>
          </table>
        )}

        {/* Sentinel للـ lazy loading */}
        {hasMore && (
          <div ref={sentinelRef} className="h-8 flex items-center justify-center py-4">
            {!loadingMore && (
              <span className="text-xs text-gray-300">↓ مرر للمزيد</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
