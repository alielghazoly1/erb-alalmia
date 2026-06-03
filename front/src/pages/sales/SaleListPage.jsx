// ─── pages/sales/SaleListPage.jsx ────────────────────────────────────────────
// ✅ PERF-001: cursor-based infinite scroll — يدعم 10M+ فاتورة بلا تدهور
// ✅ UX: البحث النصي يُرسَل للـ API (لا فلترة محلية)
// ✅ UX: total يُعرض من آخر COUNT محفوظ
import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector }                  from 'react-redux';
import { useNavigate }                               from 'react-router-dom';
import toast                                         from 'react-hot-toast';
import {
  fetchSaleInvoices,
  fetchMoreSaleInvoices,
  approveSaleInvoice,
  suspendSaleInvoice,
  cancelSaleInvoice,
} from '../../store/slices/saleSlice';
import { useSelectedSeason } from '../../hook/Useselectedseason';
import { useSaleFilters }    from './hooks/useSaleFilters';
import SaleFilters           from './components/SaleFilters';
import SaleTable             from './components/SaleTable';

// ── ConfirmDialog ─────────────────────────────────────────────────────────────
function ConfirmDialog({ open, message, onConfirm, onCancel, withInput, inputLabel, inputValue, onInputChange }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <p className="text-gray-800 font-medium text-center mb-4">{message}</p>
        {withInput && (
          <input className="input-field mb-4" placeholder={inputLabel}
            value={inputValue} onChange={e => onInputChange(e.target.value)} autoFocus />
        )}
        <div className="flex gap-3">
          <button onClick={onConfirm} className="flex-1 btn-primary">تأكيد</button>
          <button onClick={onCancel}  className="flex-1 btn-secondary">إلغاء</button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SaleListPage() {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const seasonId  = useSelectedSeason();
  const { user }  = useSelector(s => s.auth);
  const isAdmin   = user?.role === 'admin';

  const { list, loading, loadingMore, hasMore, total, error } = useSelector(s => s.sales);

  const { filters, setFilters, apiParams } = useSaleFilters();

  // ✅ debounce البحث — لا نرسل طلب لكل حرف
  const searchTimer = useRef(null);

  const sentinelRef = useRef(null);

  const [dialog, setDialog]           = useState({ open: false, type: null, id: null });
  const [suspendReason, setSuspendReason] = useState('');

  const closeDialog = useCallback(() => {
    setDialog({ open: false, type: null, id: null });
    setSuspendReason('');
  }, []);

  // ── جلب عند تغيير الفلاتر ─────────────────────────────────────────────────
  useEffect(() => {
    if (!seasonId) return;
    // debounce لو في بحث نصي
    clearTimeout(searchTimer.current);
    const delay = apiParams.search ? 400 : 0;
    searchTimer.current = setTimeout(() => {
      dispatch(fetchSaleInvoices({ ...apiParams, seasonId }));
    }, delay);
    return () => clearTimeout(searchTimer.current);
  }, [dispatch, seasonId, apiParams]);

  // ── Intersection Observer: تحميل المزيد ───────────────────────────────────
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          dispatch(fetchMoreSaleInvoices({ ...apiParams, seasonId }));
        }
      },
      { threshold: 0.1, rootMargin: '300px' },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, dispatch, apiParams, seasonId]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleApprove = (id) => setDialog({ open: true, type: 'approve', id });
  const handleSuspend = (id) => { setSuspendReason(''); setDialog({ open: true, type: 'suspend', id }); };
  const handleCancel  = (id) => setDialog({ open: true, type: 'cancel',  id });
  const handleView    = (id) => navigate(`/sales/${id}`, { state: { backTo: '/sales', backLabel: 'قائمة المبيعات' } });

  const handleConfirm = async () => {
    const { type, id } = dialog;
    closeDialog();
    if (type === 'approve') {
      const res = await dispatch(approveSaleInvoice(id));
      if (!res.error) toast.success('تم الموافقة وخصم المخزون ✅');
      else toast.error(res.payload || 'خطأ في الموافقة');
    }
    if (type === 'suspend') {
      const res = await dispatch(suspendSaleInvoice({ id, reason: suspendReason }));
      if (!res.error) toast.success('تم التعليق');
      else toast.error(res.payload || 'خطأ في التعليق');
    }
    if (type === 'cancel') {
      const res = await dispatch(cancelSaleInvoice(id));
      if (!res.error) toast.success('تم الإلغاء');
      else toast.error(res.payload || 'خطأ في الإلغاء');
    }
  };

  const dialogConfig = {
    approve: { message: 'هتوافق على الفاتورة وتخصم من المخزن؟' },
    suspend: { message: 'تعليق الفاتورة؟', withInput: true, inputLabel: 'سبب التعليق (اختياري)' },
    cancel:  { message: 'هتلغي الفاتورة دي نهائياً؟' },
  };
  const cfg = dialogConfig[dialog.type] || {};

  const loadedCount = list.length;

  return (
    <div>
      <ConfirmDialog
        open={dialog.open} message={cfg.message} withInput={cfg.withInput}
        inputLabel={cfg.inputLabel} inputValue={suspendReason}
        onInputChange={setSuspendReason} onConfirm={handleConfirm} onCancel={closeDialog}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">فواتير المبيعات</h1>
          <p className="text-sm text-gray-400 mt-1">
            {loadedCount.toLocaleString()} فاتورة محمّلة
            {total > 0 && ` من ${total.toLocaleString()} إجمالاً`}
            {!filters.showAllDates && ` • ${filters.dateFrom === filters.dateTo ? filters.dateFrom : `${filters.dateFrom} → ${filters.dateTo}`}`}
          </p>
        </div>
        <button onClick={() => navigate('/sales/new')} className="btn-primary">+ فاتورة جديدة</button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          ⚠️ {error}
        </div>
      )}

      <SaleFilters filters={filters} onChange={setFilters} />

      <SaleTable
        invoices={list}
        loading={loading}
        showAllDates={filters.showAllDates}
        isAdmin={isAdmin}
        onApprove={handleApprove}
        onSuspend={handleSuspend}
        onCancel={handleCancel}
        onView={handleView}
      />

      {/* Sentinel للـ infinite scroll */}
      <div ref={sentinelRef} className="h-10 flex items-center justify-center mt-2">
        {loadingMore && (
          <div className="flex items-center gap-2 text-blue-500 text-sm py-3">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            جاري تحميل المزيد... ({loadedCount.toLocaleString()}{total > 0 && ` / ${total.toLocaleString()}`})
          </div>
        )}
        {!hasMore && list.length > 0 && !loading && (
          <p className="text-xs text-gray-400 py-2">
            ✓ تم تحميل جميع الفواتير ({list.length.toLocaleString()})
          </p>
        )}
      </div>
    </div>
  );
}
