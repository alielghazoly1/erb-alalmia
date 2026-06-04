// ─── pages/transfers/TransferListPage.jsx ────────────────────────────────────
// ✅ Infinite scroll  : يحمّل 100 تحويل، يجلب الـ 100 التاليين عند الاقتراب من النهاية
// ✅ Memoized filters : دي-bounce على البحث بـ 350ms لتجنب flood للـ API
// ✅ Components       : TransferFilters + TransferTable + TransferRow (منفصلين)
// ✅ DELETE           : حذف تحويلات pending/rejected من القائمة
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useRef, useEffect } from 'react';
import { useDispatch, useSelector }                  from 'react-redux';
import { Link }                                       from 'react-router-dom';
import toast                                          from 'react-hot-toast';

import { approveTransfer, rejectTransfer, deleteTransfer, reverseAndDeleteTransfer } from '../../store/slices/transferSlice';
import { useInfiniteTransfers }                             from '../../hook/useInfiniteTransfers';
import TransferFilters                                      from './components/TransferFilters';
import TransferTable                                        from './components/TransferTable';

// ─── constants ────────────────────────────────────────────────────────────────
const INIT_FILTERS = { search: '', status: '', direction: '', dateFrom: '', dateTo: '' };

export default function TransferListPage() {
  const dispatch               = useDispatch();
  const { list, loading, total } = useSelector(s => s.transfers);
  const { user }               = useSelector(s => s.auth);
  const isAdmin                = user?.role === 'admin';

  // ── فلاتر ──────────────────────────────────────────────────────────────────
  const [filters,   setFilters]   = useState(INIT_FILTERS);
  const [apiFilters, setApiFilters] = useState(INIT_FILTERS);

  // de-bounce البحث النصي 350ms، باقي الفلاتر فورية
  const searchTimer = useRef(null);
  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));

    if (key === 'search') {
      clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
        setApiFilters(prev => ({ ...prev, search: value }));
      }, 350);
    } else {
      setApiFilters(prev => ({ ...prev, [key]: value }));
    }
  }, []);

  const handleClearFilters = useCallback(() => {
    clearTimeout(searchTimer.current);
    setFilters(INIT_FILTERS);
    setApiFilters(INIT_FILTERS);
  }, []);

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  // ── Infinite scroll ────────────────────────────────────────────────────────
  const apiParams = {
    ...(apiFilters.status    && { status:    apiFilters.status }),
    ...(apiFilters.direction && { direction: apiFilters.direction }),
    ...(apiFilters.dateFrom  && { startDate: apiFilters.dateFrom }),
    ...(apiFilters.dateTo    && { endDate:   apiFilters.dateTo }),
    ...(apiFilters.search    && { search:    apiFilters.search }),
  };

  const { sentinelRef, loadingMore } = useInfiniteTransfers(apiParams, true);

  const activeFiltersCount = Object.values(filters).filter(Boolean).length;

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleApprove = useCallback(async (id) => {
    if (!window.confirm('هتوافق على التحويل وتحدث المخزنين؟')) return;
    const res = await dispatch(approveTransfer(id));
    if (!res.error) toast.success('تم التحويل وتحديث المخزنين ✅');
    else            toast.error(res.payload || 'خطأ في الموافقة');
  }, [dispatch]);

  const handleReject = useCallback(async (id) => {
    if (!window.confirm('هترفض التحويل ده؟')) return;
    const res = await dispatch(rejectTransfer(id));
    if (!res.error) toast.success('تم الرفض');
    else            toast.error(res.payload || 'خطأ في الرفض');
  }, [dispatch]);

  const handleDelete = useCallback(async (id, transferNumber) => {
    if (!window.confirm(`هتحذف إذن التحويل "${transferNumber}"؟\nالعملية لا يمكن التراجع عنها.`)) return;
    const res = await dispatch(deleteTransfer(id));
    if (!res.error) toast.success(`تم حذف الإذن ${transferNumber} ✅`);
    else            toast.error(res.payload || 'خطأ في الحذف');
  }, [dispatch]);

  const handleReverseDelete = useCallback(async (id, transferNumber) => {
    if (!window.confirm(
      `⚠️ عكس وحذف إذن التحويل "${transferNumber}"؟\n\nسيتم:\n• عكس حركات المخزون (إرجاع الرصيد)\n• حذف التحويل نهائياً\n\nالعملية لا يمكن التراجع عنها.`
    )) return;
    const res = await dispatch(reverseAndDeleteTransfer(id));
    if (!res.error) toast.success(`تم عكس المخزون وحذف الإذن ${transferNumber} ✅`);
    else            toast.error(res.payload || 'خطأ في عكس وحذف التحويل');
  }, [dispatch]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* هيدر */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">إذونات التحويل</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {list.length > 0 && (
              <>
                <span>{list.length}{total && total > list.length ? ` من ${total}` : ''} تحويل</span>
                <span className="mr-2 text-blue-600 font-medium">
                  — {list.reduce((s, t) => s + (t.totalWeight || 0), 0).toFixed(2)} ك إجمالي
                </span>
              </>
            )}
          </p>
        </div>
        <Link to="/transfers/new" className="btn-primary">+ إذن تحويل جديد</Link>
      </div>

      {/* فلاتر */}
      <TransferFilters
        filters={filters}
        onChange={handleFilterChange}
        onClear={handleClearFilters}
      />

      {/* جدول + infinite scroll */}
      <TransferTable
        transfers={list}
        loading={loading}
        loadingMore={loadingMore}
        sentinelRef={sentinelRef}
        isAdmin={isAdmin}
        activeFiltersCount={activeFiltersCount}
        onClearFilters={handleClearFilters}
        onApprove={handleApprove}
        onReject={handleReject}
        onDelete={handleDelete}
        onReverseDelete={handleReverseDelete}
      />
    </div>
  );
}
